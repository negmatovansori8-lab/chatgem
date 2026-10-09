"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { preconnect } from "react-dom";
import type L from "leaflet";
import { DEFAULT_TILES, tileOrigins } from "@/lib/maps/tiles";
import {
  Check,
  Compass,
  Crosshair,
  Layers,
  Loader2,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Search,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { AppBackButton } from "@/components/layout/app-back-button";
import { useI18n } from "@/components/i18n/locale-provider";
import { CategoryBar } from "@/features/maps/components/category-bar";
import { PlaceCard, PlaceCardSkeleton, type PlaceMetrics } from "@/features/maps/components/place-card";
import { MODE_EMOJI, RoutePanel, isLeg, routeView, type RouteState } from "@/features/maps/components/route-panel";
import { SearchBox } from "@/features/maps/components/search-box";
import { PointSheet, formatCoords, pointTitle } from "@/features/maps/components/point-sheet";
import { useCompass, useIsDark, useMediaQuery } from "@/features/maps/hooks";
import type { MapInsets, MapRouteLine } from "@/features/maps/map-canvas";
import { useGeolocation } from "@/features/maps/use-geolocation";
import { usePointLookup, usePointMetrics } from "@/features/maps/use-point-lookup";
import {
  MapsApiError,
  errorKey,
  fetchMapsStatus,
  fetchMatrix,
  fetchRoute,
  reverseGeocode,
  searchPlaces,
  type MapsStatus,
} from "@/lib/maps/client";
import type { MapReportKind } from "@/lib/maps/map-action";
import type { MapCommand, MapResult, MapResultBody, MapResultPlace } from "@/lib/maps/map-result";
import type { ClarifyCountry } from "@/lib/maps/search-service";
import { isGpsFix, locationErrorKey } from "@/lib/maps/location";
import { formatClock, formatDistance, formatDuration, haversineMeters } from "@/lib/maps/geo";
import { categoryLabel, isCategoryKey, localizePlaceName, nearestTitle } from "@/lib/maps/labels";
import type { MapCategoryKey } from "@/lib/maps/intent";
import { saveMapSession } from "@/lib/maps/session";
import {
  addRecentSearch,
  clearRecentSearches,
  findSaved,
  removeSavedPlace,
  savePlace,
  useRecentSearches,
  useSavedPlaces,
  type RecentSearch,
  type SavedKind,
  type SavedPlace,
} from "@/lib/maps/storage";
import {
  TRAVEL_MODES,
  type BBox,
  type LatLng,
  type LocationErrorCode,
  type LocationFix,
  type MapPlace,
  type RouteLeg,
  type TravelMode,
} from "@/providers/maps/types";
import { cn } from "@/lib/utils";

const MapCanvas = dynamic(() => import("@/features/maps/map-canvas").then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => <div className="h-full w-full cg-skeleton" />,
});

const DEFAULT_STATUS: MapsStatus = {
  tiles: DEFAULT_TILES,
  dark: null,
  satellite: null,
  transitAvailable: false,
  trafficAvailable: false,
};

const MAX_RESULTS = 15;

/** Street-level view once a real GPS fix is in hand. */
const GPS_ZOOM = 17;

function fixPoints(fix: LocationFix): LatLng[] {
  return [fix.location];
}

function areaCorners(area: { bbox: BBox; center: LatLng }): LatLng[] {
  const b = area.bbox;
  const east = b.east < b.west ? b.east + 360 : b.east;
  // Russia crosses the antimeridian, France/USA include far-away territories:
  // frame the main part around the centre instead.
  if (east - b.west > 300 || b.north - b.south > 60) {
    const { lat, lng } = area.center;
    return [
      { lat: Math.max(b.south, lat - 12), lng: lng - 30 },
      { lat: Math.min(b.north, lat + 12), lng: lng + 30 },
    ];
  }
  return [
    { lat: b.south, lng: b.west },
    { lat: b.north, lng: east },
  ];
}

type SearchState =
  | { kind: "idle" }
  | { kind: "loading"; nearby: boolean }
  | { kind: "done" }
  /** "Дар Англия дорухона" from outside England → which city, or near me? */
  | { kind: "clarify"; info: ClarifyCountry }
  | { kind: "error"; code: string; retry: () => void };

type Layer = "auto" | "standard" | "dark" | "satellite";
type SheetState = "min" | "peek" | "full";
const SHEET_ORDER: SheetState[] = ["min", "peek", "full"];

/** Beyond this the map shows the destination first and routes on request. */
const AUTO_ROUTE_MAX_METERS = 80_000;
const WALK_DEFAULT_MAX_METERS = 3_000;
const DESKTOP_PANEL_PX = 396;

type RouteCache = Record<string, Partial<Record<TravelMode, RouteState>>>;

function parseLatLng(v: string | null): LatLng | null {
  if (!v) return null;
  const [lat, lng] = v.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat!) > 90 || Math.abs(lng!) > 180) return null;
  return { lat: lat!, lng: lng! };
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function sheetSnapPx(state: SheetState, h: number): number {
  return state === "min" ? 92 : state === "peek" ? Math.round(h * 0.44) : h - 128;
}

function toResultPlace(p: MapPlace, m?: PlaceMetrics): MapResultPlace {
  return {
    id: p.id,
    name: p.name,
    address: p.address || undefined,
    lat: p.location.lat,
    lng: p.location.lng,
    category: p.category,
    walk: m?.walk ?? null,
    drive: m?.drive ?? null,
  };
}

export type MapsWorkspaceProps = {
  /** Inside the chat: fills its container; commands come from `command`, not the URL. */
  embedded?: boolean;
  /** Embedded on a phone with the chat visible below: map + one-line summary only. */
  compact?: boolean;
  /** Shown where the standalone page has its back button (close / expand / minimise). */
  headerActions?: React.ReactNode;
  /** Compact sheet tapped → the host should give the map more room. */
  onExpand?: () => void;
  command?: MapCommand | null;
  /** Real result of a command that asked for a report (`command.report`). */
  onResult?: (result: MapResult) => void;
  /** Place selected on the map — Map → Chat context ("Ин ҷой", "Ба ҳамин ҷо рав"). */
  onSelectionChange?: (place: { id: string; name: string } | null) => void;
};

export function MapsWorkspace({
  embedded = false,
  compact = false,
  headerActions,
  onExpand,
  command,
  onResult,
  onSelectionChange,
}: MapsWorkspaceProps = {}) {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const geo = useGeolocation();
  const now = useNow();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  /** Side-panel layout; the embedded map always uses the compact sheet layout. */
  const wide = isDesktop && !embedded;
  const isDark = useIsDark();
  const compass = useCompass();
  const recent = useRecentSearches();
  const savedList = useSavedPlaces();

  const [status, setStatus] = useState<MapsStatus>(DEFAULT_STATUS);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MapCategoryKey | null>(null);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [metrics, setMetrics] = useState<Record<string, PlaceMetrics>>({});
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<TravelMode>("walking");
  const [altIndex, setAltIndex] = useState(0);
  const [routes, setRoutesState] = useState<RouteCache>({});
  const routesRef = useRef<RouteCache>({});
  const setRoutes = useCallback((next: RouteCache | ((prev: RouteCache) => RouteCache)) => {
    routesRef.current = typeof next === "function" ? next(routesRef.current) : next;
    setRoutesState(routesRef.current);
  }, []);
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const [scopeLabel, setScopeLabel] = useState<string | null>(null);
  const [area, setArea] = useState<{ name: string; location: LatLng } | null>(null);
  const [layer, setLayer] = useState<Layer>("auto");
  const [layersOpen, setLayersOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [online, setOnline] = useState(true);
  const [fit, setFit] = useState<{ key: string; points: LatLng[] }>({ key: "", points: [] });
  const [sheet, setSheet] = useState<SheetState>("peek");
  const [sheetPx, setSheetPx] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const mapRef = useRef<L.Map | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nearbyInputRef = useRef<HTMLInputElement>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const searchSeq = useRef(0);
  const routeInflight = useRef(new Set<string>());
  const preferredMode = useRef<TravelMode | null>(null);
  const metricsFor = useRef<string>("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  /** Current results belong to a named city/country (keep relevance order). */
  const scopedResults = useRef(false);
  const placesRef = useRef<MapPlace[]>([]);
  const metricsRef = useRef<Record<string, PlaceMetrics>>({});
  /** Named start of an A→B route; routes and metrics are measured from it instead of the user. */
  const [origin, setOriginState] = useState<{ location: LatLng; name: string } | null>(null);
  const originRef = useRef<{ location: LatLng; name: string } | null>(null);
  const setOrigin = useCallback((next: { location: LatLng; name: string } | null) => {
    originRef.current = next;
    setOriginState(next);
  }, []);
  /** Chat command waiting for its real result. */
  const pendingRef = useRef<{ id: number; expect: MapReportKind } | null>(null);
  const onResultRef = useRef(onResult);
  const onSelectionRef = useRef(onSelectionChange);
  useEffect(() => {
    onResultRef.current = onResult;
    onSelectionRef.current = onSelectionChange;
  }, [onResult, onSelectionChange]);

  /** Report to the chat once; `expect` null = any pending command (errors, fallbacks). */
  const emit = useCallback((expect: MapReportKind | null, body: MapResultBody) => {
    const pending = pendingRef.current;
    if (!pending || (expect && pending.expect !== expect)) return;
    pendingRef.current = null;
    onResultRef.current?.({ ...body, commandId: pending.id });
  }, []);

  /** Where routes start: the named origin, else the device. */
  const routeStart = useCallback(
    (): LatLng | null => originRef.current?.location ?? geo.getLatest()?.location ?? null,
    [geo],
  );

  const userLocation = geo.location;
  // Tap on map → reverse geocode that exact point (never on pan/zoom).
  const pointLookup = usePointLookup(locale);
  const { lookup: lookupPoint, clear: clearPoint } = pointLookup;
  const pointState = pointLookup.state;
  const pin = pointState.status === "idle" ? null : pointState.point;
  const pointMetrics = usePointMetrics(pin, userLocation);
  const pointSheetRef = useRef<HTMLElement>(null);
  const [pointSheetPx, setPointSheetPx] = useState(0);
  const selected = useMemo(() => places.find((p) => p.id === selectedId) ?? null, [places, selectedId]);
  const selectedRoutes = selected ? routes[selected.id] ?? {} : {};
  const activeRoute = selectedRoutes[mode];
  const activeLeg = isLeg(activeRoute) ? activeRoute : null;
  const selectedSaved = selected ? findSaved(savedList, selected.location) : undefined;

  const tr = useCallback((key: string, vars?: Record<string, string | number>) => {
    let s = t(key);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }, [t]);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  }, []);

  const liftSheet = useCallback(() => setSheet((s) => (s === "min" ? "peek" : s)), []);

  // ---------------------------------------------------------------- status / online
  useEffect(() => {
    void fetchMapsStatus().then(setStatus).catch(() => undefined);
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  // Mobile sheet height → map padding and floating controls.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || wide) return;
    const ro = new ResizeObserver(() => setSheetPx(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [wide]);

  const pointOpen = pin !== null;
  useEffect(() => {
    const el = pointSheetRef.current;
    if (!el || wide || !pointOpen) return;
    const ro = new ResizeObserver(() => setPointSheetPx(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [pointOpen, wide]);

  // The embedded panel is shown/hidden and resized by the chat — keep Leaflet's size in sync.
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => mapRef.current?.invalidateSize());
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    placesRef.current = places;
    metricsRef.current = metrics;
  }, [metrics, places]);

  // ---------------------------------------------------------------- routing
  const ensureRoute = useCallback(
    async (place: MapPlace, m: TravelMode, from: LatLng) => {
      const key = `${place.id}|${m}`;
      if (routeInflight.current.has(key)) return;
      const report = (leg: RouteLeg) =>
        leg.available
          ? emit("route", {
              kind: "route",
              place: toResultPlace(place, metricsRef.current[place.id]),
              mode: m,
              distanceMeters: leg.distanceMeters,
              durationSeconds: leg.durationSeconds,
              originName: originRef.current?.name,
            })
          : emit("route", { kind: "error", code: leg.unavailableReason ?? "route_not_found", source: "route" });
      const existing = routesRef.current[place.id]?.[m];
      if (isLeg(existing)) {
        if (existing.geometry.length > 1) {
          setFit({ key: `route:${key}:${Date.now()}`, points: existing.geometry });
        }
        report(existing);
        return;
      }
      const put = (v: RouteState) =>
        setRoutes((prev) => ({ ...prev, [place.id]: { ...prev[place.id], [m]: v } }));

      if (m === "transit" && !status.transitAvailable) {
        put({ error: "transit_unavailable" });
        emit("route", { kind: "error", code: "transit_unavailable", source: "route" });
        return;
      }
      routeInflight.current.add(key);
      put("loading");
      try {
        const leg = await fetchRoute({ from, to: place.location, mode: m, locale });
        put(leg);
        if (leg.available && leg.geometry.length > 1) {
          setFit({ key: `route:${key}`, points: [from, ...leg.geometry, place.location] });
        }
        report(leg);
      } catch (e) {
        const code = e instanceof MapsApiError ? e.code : "api_error";
        put({ error: code });
        emit("route", { kind: "error", code, source: "route" });
      } finally {
        routeInflight.current.delete(key);
      }
    },
    [emit, locale, setRoutes, status.transitAvailable],
  );

  // ---------------------------------------------------------------- matrix metrics
  /**
   * Real network distance/time to every result, then sort by route distance.
   * Results of a named city/country keep the provider's relevance order.
   */
  const loadMetrics = useCallback(
    async (
      list: MapPlace[],
      from: LatLng,
      seq: number,
      sort = true,
    ): Promise<{ list: MapPlace[]; metrics: Record<string, PlaceMetrics> }> => {
      if (!list.length) return { list, metrics: {} };
      setMetricsLoading(true);
      try {
        const res = await fetchMatrix(from, list.map((p) => p.location));
        if (seq !== searchSeq.current) return { list, metrics: {} };
        const next: Record<string, PlaceMetrics> = {};
        list.forEach((p, i) => {
          next[p.id] = { walk: res.walking?.[i] ?? null, drive: res.driving?.[i] ?? null };
        });
        const rank = (p: MapPlace) =>
          next[p.id]?.walk?.distanceMeters ?? next[p.id]?.drive?.distanceMeters ?? Number.POSITIVE_INFINITY;
        const sorted = sort ? [...list].sort((a, b) => rank(a) - rank(b)) : list;
        setMetrics(next);
        setPlaces(sorted);
        return { list: sorted, metrics: next };
      } catch {
        if (seq === searchSeq.current) setMetrics({});
        return { list, metrics: {} };
      } finally {
        if (seq === searchSeq.current) setMetricsLoading(false);
      }
    },
    [],
  );

  const pickDefaultMode = useCallback((m: PlaceMetrics | undefined): TravelMode => {
    if (preferredMode.current) return preferredMode.current;
    const walk = m?.walk;
    if (walk && walk.durationSeconds <= 40 * 60) return "walking";
    return m?.drive || walk ? "driving" : "walking";
  }, []);

  /** Mode before metrics exist: walking for short hops, driving otherwise. */
  const modeByDistance = useCallback((from: LatLng, to: LatLng): TravelMode => {
    if (preferredMode.current) return preferredMode.current;
    return haversineMeters(from, to) <= WALK_DEFAULT_MAX_METERS ? "walking" : "driving";
  }, []);

  // ---------------------------------------------------------------- search
  type SearchInput = { q?: string; category?: MapCategoryKey; around?: LatLng; aroundName?: string };
  const runSearchRef = useRef<((input: SearchInput) => Promise<void>) | null>(null);

  const runSearch = useCallback(
    async (input: SearchInput) => {
      const q = input.q?.trim();
      if (!q && !input.category) return;
      searchAbort.current?.abort();
      const ctrl = new AbortController();
      searchAbort.current = ctrl;
      const seq = ++searchSeq.current;

      setCategory(input.category ?? null);
      setSelectedId(null);
      setAltIndex(0);
      setPlaces([]);
      setMetrics({});
      setRoutes({});
      setScopeLabel(null);
      metricsFor.current = "";
      setSearch({ kind: "loading", nearby: Boolean(input.category) });
      liftSheet();

      const retry = () => void runSearchRef.current?.(input);
      let near = geo.getLatest()?.location ?? null;
      // An explicit place ("near there") or a chosen city beats the device position.
      const around = input.around ?? area?.location ?? null;
      const aroundName = input.around ? input.aroundName : area?.name;

      const locationFailed = () => {
        setSearch({ kind: "idle" });
        emit(null, { kind: "error", code: geo.getLastError() ?? "gps_unavailable", source: "location" });
      };

      // Nearby categories need the device location (the user asked for it).
      if (input.category && !near && !around) {
        const fix = await geo.locate();
        if (seq !== searchSeq.current) return;
        if (!fix) {
          locationFailed();
          return;
        }
        near = fix.location;
      }

      try {
        let res = await searchPlaces(
          { q, category: input.category, near, area: area?.location, around, locale },
          ctrl.signal,
        );
        if (res.needsLocation && res.intent.type === "nearby" && !res.places.length) {
          setCategory(res.intent.category);
          const fix = await geo.locate();
          if (seq !== searchSeq.current) return;
          if (!fix) {
            locationFailed();
            return;
          }
          near = fix.location;
          res = await searchPlaces({ category: res.intent.category, near, locale }, ctrl.signal);
        }
        if (seq !== searchSeq.current) return;
        if (res.clarify) {
          // The chat already asked the same question ("near you or which city?").
          pendingRef.current = null;
          setCategory(res.clarify.category);
          setSearch({ kind: "clarify", info: res.clarify });
          if (res.area) setFit({ key: `area:${seq}`, points: areaCorners(res.area) });
          return;
        }
        // The silent location check may have finished while the search was in flight.
        near = near ?? geo.getLatest()?.location ?? null;
        if (res.intent.type === "nearby") setCategory(res.intent.category);
        if ((res.intent.type === "search" || res.intent.type === "route") && res.intent.mode) {
          preferredMode.current = res.intent.mode;
        }
        const scoped = Boolean(res.scoped);
        const aroundScoped = scoped && !res.area && Boolean(around);
        scopedResults.current = scoped;
        setScopeLabel(
          scoped && res.area ? res.area.name : aroundScoped && aroundName ? tr("maps.nearPlace", { name: aroundName }) : null,
        );

        let list = res.places.slice(0, MAX_RESULTS).map((p) => ({
          ...p,
          name: localizePlaceName(p.name, locale, p.category),
        }));
        setPlaces(list);
        setSearch({ kind: "done" });
        if (!list.length) {
          emit(null, { kind: "error", code: "place_not_found", source: "search" });
          return;
        }
        if (scoped && list[0]) {
          setSelectedId(list[0].id);
          if (near) setMode(modeByDistance(near, list[0].location));
        }
        // The area itself (country, region, district, city): show all of it.
        const areaOnly = Boolean(res.area && list.length === 1 && list[0]!.id.startsWith("area:"));
        if (areaOnly && res.area) {
          setFit({ key: `search:${seq}`, points: areaCorners(res.area) });
        } else {
          // Named city/country: frame the results there, not the user's position.
          const framed = list.slice(0, 8).map((p) => p.location);
          const nearInFrame = near && (!scoped || list.some((p) => haversineMeters(near!, p.location) <= AUTO_ROUTE_MAX_METERS));
          setFit({
            key: `search:${seq}`,
            points: [...framed, ...(near && nearInFrame ? [near] : []), ...(aroundScoped && around ? [around] : [])],
          });
        }

        let loaded: Record<string, PlaceMetrics> = {};
        if (near) {
          metricsFor.current = `${seq}`;
          const r = await loadMetrics(list, near, seq, !scoped);
          if (seq !== searchSeq.current) return;
          list = r.list;
          loaded = r.metrics;
        }
        const first = list[0];
        const willRoute = Boolean(
          first &&
            near &&
            (res.intent.type === "route" ||
              (!areaOnly && (haversineMeters(near, first.location) <= AUTO_ROUTE_MAX_METERS || preferredMode.current))),
        );
        // A route request reports its route (from ensureRoute); everything else reports the list.
        if (pendingRef.current?.expect !== "route" || !willRoute) {
          emit(null, {
            kind: "places",
            category: res.intent.type === "nearby" ? res.intent.category : undefined,
            scope:
              scoped && res.area
                ? { kind: "area", name: res.area.name }
                : aroundScoped && aroundName
                  ? { kind: "around", name: aroundName }
                  : undefined,
            hasLocation: Boolean(near),
            places: list.slice(0, 5).map((p) => toResultPlace(p, loaded[p.id])),
          });
        }
        if (first) {
          setSelectedId(first.id);
          if (near) {
            const nextMode = loaded[first.id] ? pickDefaultMode(loaded[first.id]) : modeByDistance(near, first.location);
            setMode(nextMode);
            if (willRoute) void ensureRoute(first, nextMode, near);
          }
        }
      } catch (e) {
        if (seq !== searchSeq.current) return;
        const code = e instanceof MapsApiError ? e.code : "api_error";
        if (code === "aborted") return;
        setSearch({ kind: "error", code, retry });
        emit(null, { kind: "error", code, source: "search" });
      }
    },
    [area, emit, ensureRoute, geo, liftSheet, loadMetrics, locale, modeByDistance, pickDefaultMode, setRoutes, tr],
  );

  /** One known place (deep link, suggestion, saved place): show it and route when sensible. */
  const showSinglePlace = useCallback(
    (place: MapPlace) => {
      searchAbort.current?.abort();
      const seq = ++searchSeq.current;
      scopedResults.current = false;
      metricsFor.current = "";
      setScopeLabel(null);
      setCategory(null);
      setQuery(place.name);
      setPlaces([place]);
      setMetrics({});
      setRoutes({});
      setSelectedId(place.id);
      setAltIndex(0);
      setMode(preferredMode.current ?? "walking");
      setSearch({ kind: "done" });
      setFit({ key: `one:${place.id}:${seq}`, points: [place.location] });
      liftSheet();
      const to = place.location;
      const routeFrom = (from: LatLng) => {
        metricsFor.current = `${seq}`;
        const nextMode = modeByDistance(from, to);
        setMode(nextMode);
        // A far place found by name ("Big Ben") stays in view; routing is one tap / "how do I get there?".
        const willRoute = Boolean(preferredMode.current) || haversineMeters(from, to) <= AUTO_ROUTE_MAX_METERS;
        void loadMetrics([place], from, seq).then((r) => {
          if (seq !== searchSeq.current) return;
          if (pendingRef.current?.expect !== "route" || !willRoute) {
            emit(null, {
              kind: "places",
              hasLocation: true,
              originName: originRef.current?.name,
              places: [toResultPlace(place, r.metrics[place.id])],
            });
          }
        });
        if (willRoute) void ensureRoute(place, nextMode, from);
      };
      const from = routeStart();
      if (from) routeFrom(from);
      else
        void geo.locate().then((fix) => {
          if (seq !== searchSeq.current) return;
          if (fix) routeFrom(fix.location);
          else if (pendingRef.current?.expect === "route") {
            emit(null, { kind: "error", code: geo.getLastError() ?? "gps_unavailable", source: "location" });
          } else {
            emit(null, { kind: "places", hasLocation: false, places: [toResultPlace(place)] });
          }
        });
    },
    [emit, ensureRoute, geo, liftSheet, loadMetrics, modeByDistance, routeStart, setRoutes],
  );

  /** A place already in the list (chat link, "Ба ҳамин ҷо рав"): select it and route, keep the list. */
  const focusPlace = useCallback(
    (place: MapPlace) => {
      setSelectedId(place.id);
      setAltIndex(0);
      setSheet((s) => (s === "full" || s === "min" ? "peek" : s));
      const go = (from: LatLng) => {
        const nextMode = preferredMode.current ?? pickDefaultMode(metricsRef.current[place.id]);
        setMode(nextMode);
        const willRoute = Boolean(preferredMode.current) || haversineMeters(from, place.location) <= AUTO_ROUTE_MAX_METERS;
        if (pendingRef.current?.expect !== "route" || !willRoute) {
          emit(null, {
            kind: "places",
            hasLocation: true,
            originName: originRef.current?.name,
            places: [toResultPlace(place, metricsRef.current[place.id])],
          });
        }
        if (willRoute) void ensureRoute(place, nextMode, from);
        else setFit({ key: `sel:${place.id}:${Date.now()}`, points: [place.location] });
      };
      const from = routeStart();
      if (from) {
        go(from);
        return;
      }
      setFit({ key: `sel:${place.id}:${Date.now()}`, points: [place.location] });
      void geo.locate().then((fix) => {
        if (fix) go(fix.location);
        else emit(null, { kind: "error", code: geo.getLastError() ?? "gps_unavailable", source: "location" });
      });
    },
    [emit, ensureRoute, geo, pickDefaultMode, routeStart],
  );

  // ---------------------------------------------------------------- deep links (chat / voice)
  const openDeepLink = useCallback(
    (sp: URLSearchParams) => {
      clearPoint();
      const m = sp.get("mode");
      preferredMode.current = TRAVEL_MODES.includes(m as TravelMode) ? (m as TravelMode) : null;
      const cat = sp.get("cat");
      const q = sp.get("q");
      const to = parseLatLng(sp.get("to"));
      const at = parseLatLng(sp.get("at"));
      const from = parseLatLng(sp.get("from"));
      setOrigin(
        from && to
          ? { location: from, name: sp.get("fromName")?.slice(0, 120) || `${from.lat.toFixed(5)}, ${from.lng.toFixed(5)}` }
          : null,
      );

      if (to) {
        const existing = from ? undefined : placesRef.current.find((p) => haversineMeters(p.location, to) < 30);
        if (existing) {
          focusPlace(existing);
          return;
        }
        showSinglePlace({
          id: `to:${to.lat.toFixed(6)},${to.lng.toFixed(6)}`,
          name: sp.get("name")?.slice(0, 120) || `${to.lat.toFixed(5)}, ${to.lng.toFixed(5)}`,
          address: sp.get("addr")?.slice(0, 300) ?? "",
          location: to,
          source: "link",
        });
        return;
      }
      if (isCategoryKey(cat)) {
        setQuery("");
        void runSearchRef.current?.(
          at ? { category: cat, around: at, aroundName: sp.get("atName")?.slice(0, 120) || undefined } : { category: cat },
        );
        return;
      }
      if (q) {
        setQuery(q);
        void runSearchRef.current?.({ q });
        return;
      }
      if (sp.get("locate") === "1") {
        void geo.locate().then(async (fix) => {
          if (!fix) {
            emit(null, { kind: "error", code: geo.getLastError() ?? "gps_unavailable", source: "location" });
            return;
          }
          setFit({ key: `me:${Date.now()}`, points: fixPoints(fix) });
          if (pendingRef.current?.expect !== "locate") return;
          // Only for the chat reply; the address is not stored anywhere.
          const place = await reverseGeocode(fix.location, locale).catch(() => null);
          emit("locate", {
            kind: "locate",
            address: place?.address || place?.name || undefined,
            accuracyMeters: fix.accuracyMeters,
          });
        });
      }
    },
    [clearPoint, emit, focusPlace, geo, locale, setOrigin, showSinglePlace],
  );

  const deepLinkRef = useRef(openDeepLink);
  useEffect(() => {
    runSearchRef.current = runSearch;
    deepLinkRef.current = openDeepLink;
  }, [openDeepLink, runSearch]);

  const paramsKey = searchParams.toString();
  useEffect(() => {
    if (embedded) return;
    deepLinkRef.current(new URLSearchParams(paramsKey));
  }, [embedded, paramsKey]);

  // Chat → Map: run each new command once; the map itself is reused, never reloaded.
  const commandRef = useRef(command);
  useEffect(() => {
    commandRef.current = command;
  }, [command]);
  const commandId = command?.id ?? 0;
  useEffect(() => {
    const c = commandRef.current;
    if (!c || !commandId) return;
    pendingRef.current = c.report ? { id: c.id, expect: c.report } : null;
    const q = c.href.indexOf("?");
    deepLinkRef.current(new URLSearchParams(q >= 0 ? c.href.slice(q + 1) : ""));
  }, [commandId]);

  // Map → Chat: the selected place is what "Ин ҷой" / "Ба ҳамин ҷо рав" refer to.
  const selectedName = selected?.name ?? null;
  useEffect(() => {
    onSelectionRef.current?.(selectedId && selectedName ? { id: selectedId, name: selectedName } : null);
  }, [selectedId, selectedName]);

  // When location arrives after results were shown → real metrics + route.
  const onLocationRef = useRef<(fix: LocationFix) => void>(() => undefined);
  useEffect(() => {
    onLocationRef.current = (fix: LocationFix) => {
      const loc = fix.location;
      // Routes of an A→B request start at the named origin, not at the user.
      if (originRef.current) return;
      if (!places.length) {
        // A running search or deep link picks the fix up itself and fits the results.
        // Via `fit` so it also applies when the map mounts after the fix arrived.
        if (search.kind !== "loading") setFit({ key: `me:${Date.now()}`, points: fixPoints(fix) });
        return;
      }
      const seq = searchSeq.current;
      if (metricsFor.current !== `${seq}`) {
        metricsFor.current = `${seq}`;
        void loadMetrics(places, loc, seq, !scopedResults.current);
      }
      if (selected && haversineMeters(loc, selected.location) <= AUTO_ROUTE_MAX_METERS) {
        void ensureRoute(selected, mode, loc);
      }
    };
  }, [ensureRoute, loadMetrics, mode, places, search.kind, selected]);

  const fixStamp = geo.fix?.timestamp ?? 0;
  const getLatestFix = geo.getLatest;
  const handledFixRank = useRef<number | null>(null);
  useEffect(() => {
    const fix = getLatestFix();
    if (!fix) return;
    // 0 = city estimate, 1 = coarse Wi-Fi area, 2 = real GPS. A better fix may reframe the map.
    const rank = isGpsFix(fix) ? 2 : 0;
    if (handledFixRank.current != null && handledFixRank.current >= rank) return;
    handledFixRank.current = rank;
    onLocationRef.current(fix);
  }, [fixStamp, getLatestFix]);

  // Share the latest real result with Chat / Voice for follow-up questions.
  useEffect(() => {
    if (!places.length) return;
    const top = places.slice(0, 5);
    if (selected && !top.some((p) => p.id === selected.id)) top[top.length - 1] = selected;
    saveMapSession({
      category: category ?? undefined,
      query: query || undefined,
      selectedId: selected?.id,
      origin: origin ? { name: origin.name, lat: origin.location.lat, lng: origin.location.lng } : undefined,
      transitAvailable: status.transitAvailable,
      places: top.map((p) => {
        const transit = routes[p.id]?.transit;
        const leg = isLeg(transit) && transit.available ? transit : null;
        return {
          id: p.id,
          name: p.name,
          address: p.address || undefined,
          lat: p.location.lat,
          lng: p.location.lng,
          walk: metrics[p.id]?.walk ?? null,
          drive: metrics[p.id]?.drive ?? null,
          transit: leg ? { distanceMeters: leg.distanceMeters, durationSeconds: leg.durationSeconds } : null,
          transitLines: leg?.transitLines?.slice(0, 8).map((l) => ({
            vehicle: l.vehicle,
            name: l.name.slice(0, 40),
          })),
        };
      }),
    });
  }, [category, metrics, origin, places, query, routes, selected, status.transitAvailable]);

  // ---------------------------------------------------------------- handlers
  /** The user took over: drop the chat's pending report and any named start. */
  function manualAction() {
    pendingRef.current = null;
    setOrigin(null);
    clearPoint();
  }

  function submitText(value: string) {
    const q = value.trim();
    if (!q) return;
    manualAction();
    setQuery(q);
    addRecentSearch({ label: q, q });
    void runSearch({ q });
  }

  function pickCategory(key: MapCategoryKey) {
    manualAction();
    setQuery("");
    addRecentSearch({ label: categoryLabel(key, locale), cat: key });
    void runSearch({ category: key });
  }

  function pickRecent(r: RecentSearch) {
    if (r.cat) pickCategory(r.cat);
    else submitText(r.q ?? r.label);
  }

  function pickPlace(place: MapPlace) {
    manualAction();
    addRecentSearch({ label: place.name, q: place.name });
    showSinglePlace({ ...place, name: localizePlaceName(place.name, locale, place.category) });
  }

  function openSaved(s: SavedPlace) {
    manualAction();
    showSinglePlace({
      id: `saved:${s.id}`,
      name: s.name,
      address: s.address ?? "",
      location: { lat: s.lat, lng: s.lng },
      category: s.category,
      source: "saved",
    });
  }

  function clearSearch() {
    manualAction();
    searchAbort.current?.abort();
    searchSeq.current += 1;
    setQuery("");
    setCategory(null);
    setPlaces([]);
    setMetrics({});
    setRoutes({});
    setSelectedId(null);
    setAltIndex(0);
    setSearch({ kind: "idle" });
    setScopeLabel(null);
    scopedResults.current = false;
  }

  const selectPlace = useCallback(
    (place: MapPlace) => {
      clearPoint();
      setSelectedId(place.id);
      setAltIndex(0);
      setSheet((s) => (s === "full" || s === "min" ? "peek" : s));
      const loc = routeStart();
      if (loc && haversineMeters(loc, place.location) <= AUTO_ROUTE_MAX_METERS) {
        const nextMode = preferredMode.current ?? mode;
        void ensureRoute(place, nextMode, loc);
      } else {
        setFit({ key: `sel:${place.id}:${Date.now()}`, points: [place.location] });
      }
    },
    [clearPoint, ensureRoute, mode, routeStart],
  );

  // ---------------------------------------------------------------- tap on map
  const handleMapTap = useCallback(
    (p: LatLng) => {
      setLayersOpen(false);
      lookupPoint(p);
    },
    [lookupPoint],
  );

  /** The tapped point as a place — for routing / saving / sharing like any search result. */
  function pointAsPlace(): MapPlace | null {
    if (pointState.status === "idle") return null;
    const at = pointState.point;
    const found = pointState.status === "done" ? pointState.place : null;
    return {
      id: `pin:${at.lat.toFixed(6)},${at.lng.toFixed(6)}`,
      name: pointTitle(found, at),
      address: found?.address ?? "",
      location: at,
      category: found?.category,
      postal: found?.postal,
      source: found?.source ?? "pin",
    };
  }

  function routeToPoint() {
    const place = pointAsPlace();
    if (!place) return;
    manualAction();
    showSinglePlace(place);
  }

  function savePoint() {
    const place = pointAsPlace();
    if (!place) return;
    savePlace({
      kind: "favorite",
      name: place.name,
      address: place.address || undefined,
      lat: place.location.lat,
      lng: place.location.lng,
      category: place.category,
    });
    showNotice(`${t("maps.point.saved")} ✓`);
  }

  async function copyPoint() {
    const place = pointAsPlace();
    if (!place) return;
    const text = [...new Set([place.name, place.address, formatCoords(place.location)].filter(Boolean))].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showNotice(t("maps.point.copied"));
    } catch {
      showNotice(text.replace(/\n/g, " · "));
    }
  }

  // Keep the pin visible above the sheet / beside the desktop panel.
  const pinRef = useRef(pin);
  useEffect(() => {
    pinRef.current = pin;
  }, [pin]);
  const pinKey = pin ? `${pin.lat},${pin.lng}` : "";
  useEffect(() => {
    const map = mapRef.current;
    const p = pinRef.current;
    if (!map || !p || (!wide && !pointSheetPx)) return;
    map.panInside([p.lat, p.lng], {
      paddingTopLeft: [24, wide ? 24 : embedded ? 72 : 132],
      paddingBottomRight: [wide ? DESKTOP_PANEL_PX + 72 : 64, wide ? 24 : pointSheetPx + 24],
      animate: true,
    });
  }, [embedded, pinKey, pointSheetPx, wide]);

  useEffect(() => {
    if (!pinKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearPoint();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearPoint, pinKey]);

  function changeMode(m: TravelMode) {
    setMode(m);
    setAltIndex(0);
    preferredMode.current = m;
    const loc = routeStart();
    if (selected && loc) void ensureRoute(selected, m, loc);
  }

  const pickAlt = useCallback(
    (i: number) => {
      setAltIndex(i);
      if (activeLeg?.available) {
        const g = routeView(activeLeg, i).geometry;
        if (g.length > 1) setFit({ key: `alt:${i}:${Date.now()}`, points: g });
      }
    },
    [activeLeg],
  );

  function saveSelected(kind: SavedKind) {
    if (!selected) return;
    savePlace({
      kind,
      name: selected.name,
      address: selected.address || undefined,
      lat: selected.location.lat,
      lng: selected.location.lng,
      category: selected.category,
    });
    showNotice(t(`maps.saved.${kind}`) + " ✓");
  }

  async function shareSelected() {
    if (!selected) return;
    const url = new URL("/app/maps", window.location.origin);
    url.searchParams.set("to", `${selected.location.lat.toFixed(6)},${selected.location.lng.toFixed(6)}`);
    url.searchParams.set("name", selected.name);
    if (selected.address) url.searchParams.set("addr", selected.address);
    const data = { title: selected.name, text: selected.address || selected.name, url: url.toString() };
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data);
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      showNotice(t("maps.linkCopied"));
    } catch {
      showNotice(url.toString());
    }
  }

  async function locateMe() {
    const fix = await geo.locate({ fresh: true });
    if (!fix || !isGpsFix(fix)) return;
    const map = mapRef.current;
    if (map) map.flyTo([fix.location.lat, fix.location.lng], GPS_ZOOM, { duration: 0.7 });
    else setFit({ key: `me:${Date.now()}`, points: fixPoints(fix) });
    if (!places.length) nearbyInputRef.current?.focus({ preventScroll: true });
  }

  async function submitNearby(value: string) {
    if (!value.trim()) return;
    if (!isGpsFix(geo.getLatest())) {
      const fix = await geo.locate({ fresh: true });
      if (!fix) return;
    }
    submitText(value);
  }

  function recenter() {
    const map = mapRef.current;
    if (!map) return;
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], Math.max(map.getZoom(), GPS_ZOOM));
    } else if (selected) map.flyTo([selected.location.lat, selected.location.lng], 16);
  }

  async function toggleCompass() {
    const result = await compass.toggle();
    if (result === "unavailable") showNotice(t("maps.compassUnavailable"));
  }

  async function toggleFullscreen() {
    const el = shellRef.current;
    try {
      if (!document.fullscreenElement && el?.requestFullscreen) {
        await el.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        setFullscreen((f) => !f); // iOS Safari: CSS fallback
      }
    } catch {
      setFullscreen((f) => !f);
    }
  }

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => mapRef.current?.invalidateSize(), 250);
    return () => window.clearTimeout(id);
  }, [fullscreen, wide]);

  // ---------------------------------------------------------------- mobile sheet drag
  function onSheetPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = sheetRef.current;
    if (!el || compact) return;
    drag.current = { y: e.clientY, h: el.offsetHeight, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onSheetPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const el = sheetRef.current;
    if (!d || !el) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) < 6) return;
    d.moved = true;
    el.dataset.dragging = "true";
    const shellH = shellRef.current?.offsetHeight ?? window.innerHeight;
    el.style.height = `${Math.min(Math.max(d.h - dy, 72), shellH - 96)}px`;
  }

  function onSheetPointerUp() {
    if (compact) {
      onExpand?.();
      return;
    }
    const d = drag.current;
    const el = sheetRef.current;
    drag.current = null;
    if (!d || !el) return;
    if (!d.moved) {
      setSheet((s) => SHEET_ORDER[(SHEET_ORDER.indexOf(s) + 1) % SHEET_ORDER.length]!);
      return;
    }
    const h = el.offsetHeight;
    const shellH = shellRef.current?.offsetHeight ?? window.innerHeight;
    const next = SHEET_ORDER.reduce((best, s) =>
      Math.abs(sheetSnapPx(s, shellH) - h) < Math.abs(sheetSnapPx(best, shellH) - h) ? s : best,
    );
    delete el.dataset.dragging;
    el.style.height = "";
    setSheet(next);
  }

  const onMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  const placeIsHere = useCallback((name: string) => tr("maps.placeIsHere", { name }), [tr]);

  const effectiveLayer: Exclude<Layer, "auto"> = layer === "auto" ? (isDark ? "dark" : "standard") : layer;
  const tiles =
    effectiveLayer === "satellite" && status.satellite
      ? status.satellite
      : effectiveLayer === "dark" && status.dark
        ? status.dark
        : status.tiles;
  /** No dedicated dark basemap configured → darken the standard tiles in CSS. */
  const dimTiles = effectiveLayer === "dark" && !status.dark;
  // Tiles load as plain (no-CORS) images, so the warm connection must not be CORS.
  for (const origin of tileOrigins(tiles)) preconnect(origin);

  const routeLines = useMemo<MapRouteLine[]>(() => {
    if (!activeLeg?.available) return [];
    return [activeLeg.geometry, ...(activeLeg.alternatives ?? []).map((a) => a.geometry)].map((geometry, index) => ({
      index,
      geometry,
      active: index === altIndex,
    }));
  }, [activeLeg, altIndex]);
  const view = activeLeg?.available ? routeView(activeLeg, altIndex) : null;

  const insets = useMemo<MapInsets>(
    () =>
      wide
        ? { top: 0, bottom: 0, right: selected || pointOpen ? DESKTOP_PANEL_PX + 24 : 0 }
        : { top: compact ? 64 : 120, bottom: pointOpen ? pointSheetPx : sheetPx, right: 56 },
    [compact, pointOpen, pointSheetPx, selected, sheetPx, wide],
  );
  const bottomCover = wide ? 0 : pointOpen && pointSheetPx ? pointSheetPx : sheetPx;

  const locating = geo.status === "locating";
  const loading = search.kind === "loading";
  const resultsTitle = [
    category ? nearestTitle(category, locale) : tr("maps.results", { n: places.length }),
    scopeLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  // ---------------------------------------------------------------- render pieces
  const searchBox = (
    <SearchBox
      value={query}
      loading={loading}
      near={userLocation ?? area?.location ?? null}
      locale={locale}
      recent={recent}
      saved={savedList}
      t={t}
      onChange={setQuery}
      onSubmit={submitText}
      onClear={clearSearch}
      onPickCategory={pickCategory}
      onPickPlace={pickPlace}
      inputRef={inputRef}
    />
  );

  const categoryBar = (
    <CategoryBar
      active={category}
      t={t}
      onPick={pickCategory}
      onOther={() => {
        setCategory(null);
        inputRef.current?.focus();
      }}
    />
  );

  const routePanel = selected ? (
    <RoutePanel
      place={selected}
      mode={mode}
      routes={selectedRoutes}
      metrics={metrics[selected.id]}
      altIndex={altIndex}
      hasLocation={Boolean(userLocation || origin)}
      locating={locating}
      now={now}
      locale={locale}
      saved={selectedSaved}
      t={t}
      errorText={(code) => t(errorKey(code))}
      onMode={changeMode}
      onAlt={pickAlt}
      onLocate={() => void locateMe()}
      onClose={() => setSelectedId(null)}
      onSave={saveSelected}
      onUnsave={() => selectedSaved && removeSavedPlace(selectedSaved.id)}
      onShare={() => void shareSelected()}
    />
  ) : null;

  const pointSheet = (variant: "sheet" | "panel") =>
    pointState.status === "idle" ? null : (
      <PointSheet
        state={pointState}
        metrics={pointMetrics}
        userFix={geo.fix}
        locating={locating}
        locationError={geo.error}
        locale={locale}
        variant={variant}
        t={t}
        sheetRef={variant === "sheet" ? pointSheetRef : undefined}
        onClose={clearPoint}
        onRetry={() => lookupPoint(pointState.point)}
        onRoute={routeToPoint}
        onSave={savePoint}
        onCopy={() => void copyPoint()}
        onLocate={() => void locateMe()}
      />
    );

  const panelBody = (withRoutePanel: boolean) => (
    <>
      <LocationStatus
        status={geo.status}
        error={geo.error}
        accuracy={geo.fix?.accuracyMeters}
        hasLocation={Boolean(userLocation)}
        autoChecked={geo.autoChecked}
        t={t}
        tr={tr}
        onLocate={() => void locateMe()}
      />

      {search.kind === "idle" && !selected ? (
        <NearbySearch inputRef={nearbyInputRef} busy={loading || locating} t={t} onSubmit={(q) => void submitNearby(q)} />
      ) : null}

      {search.kind === "idle" && !selected && !compact ? (
        <p className="mb-3 flex items-center gap-2 text-[12.5px] text-[var(--fg-subtle)]">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden />
          {t("maps.point.hint")}
        </p>
      ) : null}

      {area ? (
        <p className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-[var(--accent-muted)] px-3 py-2 text-[12.5px] font-medium text-[var(--fg)]">
          🏙️ {tr("maps.areaCity", { city: area.name })}
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-full text-[var(--fg-subtle)] hover:bg-[var(--surface)]"
            onClick={() => setArea(null)}
            aria-label={t("maps.clear")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </p>
      ) : null}

      {withRoutePanel && routePanel ? <div className="mb-3">{routePanel}</div> : null}

      {search.kind === "error" ? (
        <div role="alert" className="mb-3 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger-muted)] p-3 text-[13px] text-[var(--fg)]">
          <p>{t(errorKey(search.code))}</p>
          <button
            type="button"
            onClick={search.retry}
            className="mt-2 rounded-full bg-[var(--pill)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--pill-fg)]"
          >
            {t("maps.retry")}
          </button>
        </div>
      ) : null}

      {search.kind === "clarify" ? (
        <ClarifyCard
          info={search.info}
          tr={tr}
          t={t}
          onCity={submitText}
          onNearMe={() => {
            setQuery("");
            void runSearch({ category: search.info.category });
          }}
        />
      ) : null}

      {loading ? (
        <>
          <p className="mb-2 text-[12.5px] font-medium text-[var(--fg-muted)]">
            {search.nearby ? t("maps.loading.nearby") : t("maps.loading.search")}
          </p>
          <ul className="space-y-2">
            {[0, 1, 2].map((i) => (
              <PlaceCardSkeleton key={i} />
            ))}
          </ul>
        </>
      ) : places.length ? (
        <>
          <h3 className="mb-2 flex items-center justify-between gap-2 text-[13px] font-semibold text-[var(--fg)]">
            <span className="min-w-0 truncate">📍 {resultsTitle}</span>
            {metricsLoading ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-normal text-[var(--fg-subtle)]">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("maps.calculating")}
              </span>
            ) : null}
          </h3>
          <ul className="space-y-2">
            {places.map((p, i) => (
              <PlaceCard
                key={p.id}
                place={p}
                closest={i === 0 && Boolean(category)}
                metrics={metrics[p.id]}
                metricsLoading={metricsLoading}
                hasLocation={Boolean(userLocation)}
                selected={p.id === selectedId}
                now={now}
                locale={locale}
                t={t}
                onSelect={selectPlace}
              />
            ))}
          </ul>
        </>
      ) : search.kind === "done" ? (
        <p role="status" className="rounded-2xl bg-[var(--surface-2)] p-3 text-[13px] text-[var(--fg-muted)]">
          {t("maps.err.notFound")}
        </p>
      ) : search.kind === "idle" ? (
        <EmptyState
          t={t}
          saved={savedList}
          recent={recent}
          onSaved={openSaved}
          onRemoveSaved={(s) => removeSavedPlace(s.id)}
          onRecent={pickRecent}
          onClearRecent={clearRecentSearches}
        />
      ) : null}
    </>
  );

  const sheetSummary = selected
    ? view
      ? `${MODE_EMOJI[mode]} ${formatDuration(view.durationSeconds, locale)} · ${formatDistance(view.distanceMeters, locale)} · 🕐 ${formatClock(view.durationSeconds, now)}`
      : selected.name
    : loading
      ? t("maps.loading.search")
      : places.length
        ? resultsTitle
        : t("maps.emptyTitle");

  const layerOptions: { id: Exclude<Layer, "auto">; label: string; available: boolean }[] = [
    { id: "standard", label: t("maps.layer.standard"), available: true },
    { id: "dark", label: t("maps.layer.dark"), available: true },
    { id: "satellite", label: t("maps.layer.satellite"), available: Boolean(status.satellite) },
  ];

  // ---------------------------------------------------------------- render
  return (
    <div
      ref={shellRef}
      className={cn(
        "cg-map relative overflow-hidden bg-[var(--bg)] text-[var(--fg)]",
        embedded ? "cg-map--embedded h-full min-h-0" : "h-[100dvh] min-h-[520px]",
        compact && "cg-map--compact",
        fullscreen && "fixed inset-0 z-50",
        dimTiles && "cg-map--dim",
      )}
      style={{ "--sheet-h": `${bottomCover}px` } as React.CSSProperties}
    >
      <div className="flex h-full">
        {wide ? (
          <aside className="z-20 flex h-full w-[400px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg)]">
            <header className="border-b border-[var(--border)] bg-[var(--surface)] pt-3">
              <div className="flex items-center gap-2 px-3 pb-2.5">
                <AppBackButton />
                {searchBox}
              </div>
              {categoryBar}
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4">{panelBody(false)}</div>
          </aside>
        ) : null}

        {/* Map */}
        <div className="relative min-w-0 flex-1">
          <MapCanvas
            tiles={tiles}
            userFix={geo.fix}
            heading={compass.state === "on" ? compass.heading : null}
            places={places}
            selectedId={selectedId}
            routeLines={routeLines}
            routeMode={mode}
            fitKey={fit.key}
            fitPoints={fit.points}
            insets={insets}
            youAreHereLabel={t("maps.youAreHere")}
            placeIsHereLabel={placeIsHere}
            onSelectPlace={selectPlace}
            onPickRoute={pickAlt}
            onReady={onMapReady}
            origin={origin}
            onMapTap={compact ? undefined : handleMapTap}
            droppedPin={pin}
            droppedPinLabel={t("maps.point.title")}
          />

          {!wide ? (
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 top-0 z-[900]",
                embedded ? "pt-2" : "pt-[max(0.5rem,env(safe-area-inset-top))]",
              )}
            >
              <div className="pointer-events-auto mx-3 mb-2 flex items-center gap-1.5 rounded-full bg-[var(--surface)] p-1 shadow-[var(--shadow-lg)] ring-1 ring-[var(--border)]">
                {embedded ? null : <AppBackButton />}
                {searchBox}
                {headerActions}
              </div>
              {compact ? null : (
                <div className="pointer-events-auto [&_button]:shadow-[var(--shadow-sm)]">{categoryBar}</div>
              )}
            </div>
          ) : null}

          {/* Controls */}
          <div
            className={cn(
              "absolute right-3 z-[700] flex flex-col gap-1.5",
              wide
                ? "top-3"
                : compact
                  ? "top-[4.25rem]"
                  : embedded
                    ? "top-[7.75rem]"
                    : "top-[calc(max(0.5rem,env(safe-area-inset-top))+7.25rem)]",
            )}
          >
            <ControlBtn label={t("maps.zoomIn")} onClick={() => mapRef.current?.zoomIn()}>
              <Plus className="h-[18px] w-[18px]" />
            </ControlBtn>
            <ControlBtn label={t("maps.zoomOut")} onClick={() => mapRef.current?.zoomOut()}>
              <Minus className="h-[18px] w-[18px]" />
            </ControlBtn>
            {compact ? null : (
            <>
            <ControlBtn
              label={compass.state === "unavailable" ? t("maps.compassUnavailable") : t("maps.compass")}
              onClick={() => void toggleCompass()}
              active={compass.state === "on"}
              muted={compass.state === "unavailable"}
            >
              <Compass
                className={cn("h-[18px] w-[18px] transition-transform", compass.state === "starting" && "animate-pulse")}
                style={compass.state === "on" && compass.heading != null ? { transform: `rotate(${-compass.heading}deg)` } : undefined}
              />
            </ControlBtn>
            <div className="relative">
              <ControlBtn label={t("maps.layers")} onClick={() => setLayersOpen((o) => !o)} active={layersOpen}>
                <Layers className="h-[18px] w-[18px]" />
              </ControlBtn>
              {layersOpen ? (
                <LayersMenu
                  options={layerOptions}
                  current={effectiveLayer}
                  trafficNote={status.trafficAvailable ? t("maps.trafficOnRoutes") : null}
                  title={t("maps.layers")}
                  onPick={(id) => {
                    setLayer(id);
                    setLayersOpen(false);
                  }}
                  onClose={() => setLayersOpen(false)}
                />
              ) : null}
            </div>
            <ControlBtn
              label={fullscreen ? t("maps.exitFullscreen") : t("maps.fullscreen")}
              onClick={() => void toggleFullscreen()}
            >
              {fullscreen ? <Minimize2 className="h-[18px] w-[18px]" /> : <Maximize2 className="h-[18px] w-[18px]" />}
            </ControlBtn>
            {wide ? (
              <ControlBtn label={t("maps.recenter")} onClick={recenter}>
                <Crosshair className="h-[18px] w-[18px]" />
              </ControlBtn>
            ) : null}
            </>
            )}
          </div>

          {!wide && !userLocation && geo.error ? (
            <div
              role="alert"
              className="absolute left-3 z-[700] max-w-[min(22rem,calc(100%-5.5rem))] rounded-2xl border border-[var(--warning)]/30 bg-[var(--surface)] p-3 text-[13px] text-[var(--fg)] shadow-[var(--shadow-lg)]"
              style={{ bottom: "calc(var(--sheet-h, 0px) + 4.25rem)" }}
            >
              <p className="font-medium">{t(locationErrorKey(geo.error))}</p>
              <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                {geo.error === "permission_denied" ? t("maps.err.permissionHelp") : t("maps.err.gpsHelp")}
              </p>
              <button
                type="button"
                onClick={() => void locateMe()}
                disabled={locating}
                className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--pill)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--pill-fg)] disabled:opacity-60"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                {geo.error === "permission_denied" ? t("maps.allowLocation") : t("maps.retry")}
              </button>
            </div>
          ) : null}

          {/* My location */}
          <button
            type="button"
            onClick={() => void locateMe()}
            disabled={locating}
            aria-label={t("maps.locateMe")}
            className={cn(
              "absolute z-[700] inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--surface)] px-4 text-[13.5px] font-semibold text-[var(--fg)] shadow-[var(--shadow-lg)] ring-1 ring-[var(--border)] transition hover:scale-[1.02] active:scale-95 disabled:opacity-70",
              wide ? "bottom-5 right-3" : "bottom-[calc(var(--sheet-h)+0.75rem)] right-3",
              wide && (selected || pointOpen) && "right-[calc(396px+2.25rem)]",
              compact && "min-h-10 px-3",
            )}
          >
            {locating ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
            ) : (
              <LocateFixed className={cn("h-[18px] w-[18px]", userLocation && "text-[#2563eb]")} />
            )}
            <span className={cn(!wide && "sr-only", !wide && !compact && "min-[400px]:not-sr-only")}>
              {t("maps.locateMe")}
            </span>
          </button>

          {/* ETA pill (desktop; mobile shows it in the sheet handle) */}
          {wide && selected && view ? (
            <div className="pointer-events-none absolute bottom-5 left-3 z-[600] max-w-[min(26rem,calc(100%-30rem))] rounded-2xl bg-[var(--pill)] px-3.5 py-2 text-[var(--pill-fg)] shadow-[var(--shadow-lg)] [animation:njRise_220ms_ease-out]">
              <p className="truncate text-[11.5px] opacity-80">{placeIsHere(selected.name)}</p>
              <p className="truncate text-[14px] font-semibold tabular-nums">
                {MODE_EMOJI[mode]} {formatDuration(view.durationSeconds, locale)} · {formatDistance(view.distanceMeters, locale)} · 🕐{" "}
                {formatClock(view.durationSeconds, now)}
              </p>
            </div>
          ) : null}

          {/* Route / place details overlay (desktop) */}
          {wide && (pointOpen || routePanel) ? (
            <div className="absolute right-[4.25rem] top-3 z-[650] max-h-[calc(100%-1.5rem)] w-[396px] overflow-y-auto overscroll-contain rounded-3xl [scrollbar-width:thin]">
              {pointOpen ? pointSheet("panel") : routePanel}
            </div>
          ) : null}

          {!online ? (
            <div
              className={cn(
                "absolute left-1/2 z-[950] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--danger)] px-3.5 py-1.5 text-[12.5px] font-medium text-white shadow-lg",
                wide ? "top-3" : compact ? "top-[4.25rem]" : "top-[calc(max(0.5rem,env(safe-area-inset-top))+7.25rem)]",
              )}
            >
              <WifiOff className="h-3.5 w-3.5" />
              {t("maps.err.offline")}
            </div>
          ) : null}

          {notice ? (
            <div
              role="status"
              className={cn(
                "absolute left-1/2 z-[950] max-w-[calc(100%-2rem)] -translate-x-1/2 truncate rounded-full bg-[var(--pill)] px-4 py-2 text-[12.5px] font-medium text-[var(--pill-fg)] shadow-[var(--shadow-lg)] [animation:njRise_180ms_ease-out]",
                wide ? "bottom-5" : "bottom-[calc(var(--sheet-h)+4.5rem)]",
              )}
            >
              {notice}
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom sheet (mobile) */}
      {!wide ? (
        <section
          ref={sheetRef}
          data-state={compact ? "min" : sheet}
          aria-label={t("maps.results").replace("{n}", String(places.length))}
          className="cg-sheet absolute inset-x-0 bottom-0 z-[800] flex flex-col rounded-t-[28px] border-t border-[var(--border)] bg-[var(--bg)] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)]"
        >
          <div
            role="button"
            tabIndex={0}
            aria-label={t("maps.sheetToggle")}
            onPointerDown={onSheetPointerDown}
            onPointerMove={onSheetPointerMove}
            onPointerUp={onSheetPointerUp}
            onPointerCancel={onSheetPointerUp}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (compact) onExpand?.();
                else setSheet((s) => SHEET_ORDER[(SHEET_ORDER.indexOf(s) + 1) % SHEET_ORDER.length]!);
              }
            }}
            className="shrink-0 cursor-grab touch-none select-none px-4 pb-2 pt-2.5"
          >
            <span className="mx-auto block h-1.5 w-11 rounded-full bg-[var(--border-strong)]" />
            <p className="mt-2 truncate text-center text-[13px] font-semibold tabular-nums text-[var(--fg)]">{sheetSummary}</p>
          </div>
          {compact ? null : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {panelBody(true)}
            </div>
          )}
        </section>
      ) : null}

      {/* Tapped point (mobile) — slides over the results sheet */}
      {!wide ? pointSheet("sheet") : null}
    </div>
  );
}

function LayersMenu({
  options,
  current,
  trafficNote,
  title,
  onPick,
  onClose,
}: {
  options: { id: Exclude<Layer, "auto">; label: string; available: boolean }[];
  current: Exclude<Layer, "auto">;
  trafficNote: string | null;
  title: string;
  onPick: (id: Exclude<Layer, "auto">) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !ref.current?.parentElement?.contains(target)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const swatch: Record<Exclude<Layer, "auto">, string> = {
    standard: "bg-[linear-gradient(135deg,#e8f1e4,#cfe3f5)]",
    dark: "bg-[linear-gradient(135deg,#1f2937,#0b1220)]",
    satellite: "bg-[linear-gradient(135deg,#3f5f3a,#8a7b56)]",
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={title}
      className="absolute right-[calc(100%+0.5rem)] top-0 w-52 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-lg)] [animation:njRise_160ms_ease-out]"
    >
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">{title}</p>
      {options
        .filter((o) => o.available)
        .map((o) => (
          <button
            key={o.id}
            type="button"
            role="menuitemradio"
            aria-checked={current === o.id}
            onClick={() => onPick(o.id)}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-[13px] font-medium text-[var(--fg)] hover:bg-[var(--surface-2)]"
          >
            <span className={cn("h-7 w-7 shrink-0 rounded-lg ring-1 ring-[var(--border)]", swatch[o.id])} />
            <span className="flex-1">{o.label}</span>
            {current === o.id ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
          </button>
        ))}
      {trafficNote ? (
        <p className="mt-1 border-t border-[var(--border)] px-2.5 pb-1 pt-2 text-[11.5px] leading-snug text-[var(--fg-muted)]">
          🚦 {trafficNote}
        </p>
      ) : null}
    </div>
  );
}

function LocationStatus({
  status,
  error,
  accuracy,
  hasLocation,
  autoChecked,
  t,
  tr,
  onLocate,
}: {
  status: string;
  error: LocationErrorCode | null;
  accuracy?: number;
  hasLocation: boolean;
  autoChecked: boolean;
  t: (key: string) => string;
  tr: (key: string, vars?: Record<string, string | number>) => string;
  onLocate: () => void;
}) {
  if (hasLocation && !error) {
    return (
      <p className="mb-3 flex items-center gap-2 text-[12.5px] text-[var(--fg-muted)]">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2563eb] opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
        </span>
        <span className="font-medium text-[var(--fg)]">{t("maps.youAreHere")}</span>
        {accuracy ? <span>· {tr("maps.accuracy", { m: Math.round(accuracy) })}</span> : null}
      </p>
    );
  }
  if (status === "locating") {
    return (
      <p className="mb-3 flex items-center gap-2 text-[12.5px] text-[var(--fg-muted)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("maps.loading.location")}
      </p>
    );
  }
  if (error || (autoChecked && !hasLocation)) {
    const denied = error === "permission_denied" || !error;
    const gpsOff = error === "gps_unavailable" || error === "timeout";
    return (
      <div role="alert" className="mb-3 rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning-muted)] p-3 text-[13px] text-[var(--fg)]">
        <p className="font-medium">{error ? t(locationErrorKey(error)) : t("maps.needLocation")}</p>
        {denied ? <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{t("maps.err.permissionHelp")}</p> : null}
        {gpsOff ? <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{t("maps.err.gpsHelp")}</p> : null}
        <button
          type="button"
          onClick={onLocate}
          disabled={status === "locating"}
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--pill)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--pill-fg)] disabled:opacity-60"
        >
          <LocateFixed className="h-3.5 w-3.5" />
          {denied ? t("maps.allowLocation") : t("maps.retry")}
        </button>
      </div>
    );
  }
  return null;
}

function ClarifyCard({
  info,
  t,
  tr,
  onCity,
  onNearMe,
}: {
  info: ClarifyCountry;
  t: (key: string) => string;
  tr: (key: string, vars?: Record<string, string | number>) => string;
  onCity: (q: string) => void;
  onNearMe: () => void;
}) {
  const chip =
    "min-h-9 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-2)]";
  return (
    <div role="status" className="mb-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[13px] text-[var(--fg)]">
      <p className="font-medium">{tr("maps.clarifyCountry", { country: info.country })}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {info.cities.map((c) => (
          <button key={c.q} type="button" className={chip} onClick={() => onCity(c.q)}>
            {c.name}
          </button>
        ))}
        <button type="button" className={cn(chip, "border-transparent bg-[var(--pill)] text-[var(--pill-fg)] hover:bg-[var(--pill)]")} onClick={onNearMe}>
          📍 {t("maps.nearMe")}
        </button>
      </div>
    </div>
  );
}

/** "What's near me?" — free text like «магазин» / «назди дорухона», searched around the user. */
function NearbySearch({
  inputRef,
  busy,
  t,
  onSubmit,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  busy: boolean;
  t: (key: string) => string;
  onSubmit: (q: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      role="search"
      className="mb-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <label htmlFor="cg-nearby" className="mb-1.5 block text-[13px] font-semibold text-[var(--fg)]">
        {t("maps.nearby.title")}
      </label>
      <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 ps-3.5 shadow-sm focus-within:border-[var(--accent)]">
        <Search className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
        <input
          id="cg-nearby"
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("maps.nearby.placeholder")}
          enterKeyHint="search"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-[var(--pill)] px-4 text-[12.5px] font-semibold text-[var(--pill-fg)] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("maps.search")}
        </button>
      </div>
    </form>
  );
}

const SAVED_EMOJI: Record<SavedKind, string> = { home: "🏠", work: "💼", favorite: "⭐" };

function EmptyState({
  t,
  saved,
  recent,
  onSaved,
  onRemoveSaved,
  onRecent,
  onClearRecent,
}: {
  t: (key: string) => string;
  saved: SavedPlace[];
  recent: RecentSearch[];
  onSaved: (s: SavedPlace) => void;
  onRemoveSaved: (s: SavedPlace) => void;
  onRecent: (r: RecentSearch) => void;
  onClearRecent: () => void;
}) {
  const sortedSaved = [...saved].sort(
    (a, b) => (a.kind === "home" ? 0 : a.kind === "work" ? 1 : 2) - (b.kind === "home" ? 0 : b.kind === "work" ? 1 : 2),
  );
  const heading = "mb-2 mt-5 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]";

  if (!sortedSaved.length && !recent.length) return null;

  return (
    <div className="py-1 [&>*:first-child]:mt-0">
      {sortedSaved.length ? (
        <>
          <h3 className={heading}>{t("maps.savedPlaces")}</h3>
          <ul className="space-y-1.5">
            {sortedSaved.map((s) => (
              <li key={s.id} className="flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] pe-1">
                <button type="button" onClick={() => onSaved(s)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-start">
                  <span className="text-[18px]">{SAVED_EMOJI[s.kind]}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">
                      {s.kind === "favorite" ? s.name : t(`maps.saved.${s.kind}`)}
                    </span>
                    <span className="block truncate text-[12px] text-[var(--fg-muted)]">
                      {s.kind === "favorite" ? s.address : s.name}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveSaved(s)}
                  aria-label={t("maps.unsave")}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--fg-subtle)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {recent.length ? (
        <>
          <div className="mt-5 flex items-center justify-between">
            <h3 className={cn(heading, "m-0")}>{t("maps.recent")}</h3>
            <button type="button" onClick={onClearRecent} className="-me-2 min-h-9 rounded-full px-2 text-[12px] font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]">
              {t("maps.clearRecent")}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recent.map((r) => (
              <button
                key={`${r.label}-${r.at}`}
                type="button"
                onClick={() => onRecent(r)}
                className="min-h-9 max-w-full truncate rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-medium hover:bg-[var(--surface-2)]"
              >
                🕘 {r.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ControlBtn({
  children,
  onClick,
  label,
  active,
  muted,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "grid h-11 w-11 place-items-center rounded-2xl bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-md)] ring-1 ring-[var(--border)] transition hover:bg-[var(--surface-2)] active:scale-95 lg:h-10 lg:w-10",
        active && "bg-[var(--pill)] text-[var(--pill-fg)] hover:bg-[var(--pill)]",
        muted && "opacity-50",
      )}
    >
      {children}
    </button>
  );
}
