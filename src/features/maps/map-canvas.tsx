"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { LatLng, LocationFix, MapPlace, MapTiles, TravelMode } from "@/providers/maps/types";
import { CATEGORY_EMOJI, type MapCategoryKey } from "@/lib/maps/intent";
import { WORLD_CENTER, WORLD_ZOOM } from "@/providers/maps/types";
import "leaflet/dist/leaflet.css";

/**
 * Leaflet leaves a tile blank forever after one failed request. Reloading the same URL
 * a few times fills the gaps left by a dropped connection; Leaflet's own load listener
 * then reveals the tile.
 */
const TILE_RETRY_DELAYS_MS = [1_000, 3_000, 8_000];
const TILE_EVENTS: L.LeafletEventHandlerFnMap = {
  tileerror: (e) => {
    const img = (e as L.TileErrorEvent).tile as HTMLImageElement & { cgRetries?: number };
    const src = img.src;
    const attempt = img.cgRetries ?? 0;
    if (!src || attempt >= TILE_RETRY_DELAYS_MS.length) return;
    img.cgRetries = attempt + 1;
    window.setTimeout(() => {
      if (!img.isConnected) return;
      img.src = "";
      img.src = src;
    }, TILE_RETRY_DELAYS_MS[attempt]);
  },
};

const CLUSTER_CELL_PX = 60;
/** From this zoom every place is shown individually. */
const CLUSTER_MAX_ZOOM = 16;

const meIconCache = new Map<string, L.DivIcon>();
function meIcon(heading: number | null): L.DivIcon {
  const bucket = heading == null ? "none" : String(Math.round(heading / 5) * 5);
  let icon = meIconCache.get(bucket);
  if (!icon) {
    const cone =
      heading == null ? "" : `<div class="cg-me__cone" style="transform:rotate(${bucket}deg)"></div>`;
    icon = L.divIcon({
      className: "",
      html: `<div class="cg-me">${cone}<div class="cg-me__pulse"></div><div class="cg-me__dot"></div></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    meIconCache.set(bucket, icon);
  }
  return icon;
}

const iconCache = new Map<string, L.DivIcon>();
function placeIcon(category: string | undefined, active: boolean): L.DivIcon {
  const emoji = CATEGORY_EMOJI[category as MapCategoryKey] ?? "📍";
  const key = `${emoji}|${active}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const size = active ? 44 : 34;
    icon = L.divIcon({
      className: "",
      html: `<div class="cg-pin${active ? " cg-pin--active" : ""}"><span>${emoji}</span></div>`,
      iconSize: [size, size],
      // rotated pin tip sits ~0.707·size below the box centre
      iconAnchor: [size / 2, Math.round(size * 1.2)],
      tooltipAnchor: [0, -Math.round(size * 1.1)],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

const clusterCache = new Map<string, L.DivIcon>();
function clusterIcon(count: number, emoji: string): L.DivIcon {
  const key = `${count}|${emoji}`;
  let icon = clusterCache.get(key);
  if (!icon) {
    const size = count >= 10 ? 48 : 42;
    icon = L.divIcon({
      className: "",
      html: `<div class="cg-cluster" style="width:${size}px;height:${size}px"><span class="cg-cluster__emoji">${emoji}</span><span class="cg-cluster__count">${count}</span></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    clusterCache.set(key, icon);
  }
  return icon;
}

let dropIcon: L.DivIcon | null = null;
function droppedPinIcon(): L.DivIcon {
  dropIcon ??= L.divIcon({
    className: "",
    html: `<div class="cg-drop"><div class="cg-drop__pin"><span class="cg-drop__dot"></span></div><span class="cg-drop__shadow"></span></div>`,
    iconSize: [40, 54],
    // Rotated 36px teardrop: its tip is ~46px below the icon top — exactly on the tapped point.
    iconAnchor: [20, 46],
  });
  return dropIcon;
}

/** Long enough to tell a single tap from the first half of a double-tap zoom. */
const TAP_DELAY_MS = 260;

/** Single taps/clicks on the map itself (markers and route lines don't bubble here). */
function TapHandler({ onTap }: { onTap: (point: LatLng) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTapRef = useRef(onTap);
  useEffect(() => {
    onTapRef.current = onTap;
  }, [onTap]);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useMapEvents({
    click(e) {
      cancel();
      const ll = e.latlng.wrap();
      timer.current = setTimeout(() => {
        timer.current = null;
        onTapRef.current({ lat: ll.lat, lng: ll.lng });
      }, TAP_DELAY_MS);
    },
    dblclick: cancel,
    zoomstart: cancel,
  });

  useEffect(() => cancel, [cancel]);
  return null;
}

let originIcon: L.DivIcon | null = null;
function startIcon(): L.DivIcon {
  originIcon ??= L.divIcon({
    className: "",
    html: `<div class="cg-pin cg-pin--start"><span>🏁</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 41],
    tooltipAnchor: [0, -37],
  });
  return originIcon;
}

export type MapInsets = { bottom: number; right: number; top: number };

function Controller({
  onReady,
  fitKey,
  fitPoints,
  insets,
}: {
  onReady: (map: L.Map) => void;
  fitKey: string;
  fitPoints: LatLng[];
  insets: MapInsets;
}) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  // Panels/sheets resize the container without a window resize; without this
  // Leaflet keeps the old size and leaves grey, misplaced tiles.
  useEffect(() => {
    const el = map.getContainer();
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [map]);

  // Fit only when the *content* changes (new search / new route), not on every render.
  useEffect(() => {
    if (!fitKey || !fitPoints.length) return;
    if (fitPoints.length === 1) {
      const p = fitPoints[0]!;
      const zoom = Math.max(map.getZoom(), 17);
      // Centre the point in the part of the map not covered by panels.
      const shift = L.point(insets.right / 2, (insets.bottom - insets.top) / 2);
      const target = map.unproject(map.project([p.lat, p.lng], zoom).add(shift), zoom);
      map.flyTo(target, zoom, { duration: 0.6 });
      return;
    }
    map.flyToBounds(L.latLngBounds(fitPoints.map((p) => [p.lat, p.lng])), {
      paddingTopLeft: [48, 48 + insets.top],
      paddingBottomRight: [48 + insets.right, 48 + insets.bottom],
      maxZoom: 17,
      duration: 0.6,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);

  return null;
}

type Cluster = { key: string; members: MapPlace[]; center: LatLng };

/** Grid clustering in screen space; recomputed only when the zoom changes. */
function PlaceMarkers({
  places,
  selectedId,
  placeIsHereLabel,
  onSelectPlace,
}: {
  places: MapPlace[];
  selectedId?: string | null;
  placeIsHereLabel: (name: string) => string;
  onSelectPlace: (place: MapPlace) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const { singles, clusters } = useMemo(() => {
    if (places.length < 3 || zoom >= CLUSTER_MAX_ZOOM) return { singles: places, clusters: [] as Cluster[] };
    const buckets = new Map<string, MapPlace[]>();
    const singlesOut: MapPlace[] = [];
    for (const p of places) {
      if (p.id === selectedId) {
        singlesOut.push(p);
        continue;
      }
      const pt = map.project([p.location.lat, p.location.lng], zoom);
      const key = `${Math.floor(pt.x / CLUSTER_CELL_PX)}:${Math.floor(pt.y / CLUSTER_CELL_PX)}`;
      const list = buckets.get(key);
      if (list) list.push(p);
      else buckets.set(key, [p]);
    }
    const clustersOut: Cluster[] = [];
    for (const [key, members] of buckets) {
      if (members.length === 1) {
        singlesOut.push(members[0]!);
        continue;
      }
      const lat = members.reduce((s, m) => s + m.location.lat, 0) / members.length;
      const lng = members.reduce((s, m) => s + m.location.lng, 0) / members.length;
      clustersOut.push({ key, members, center: { lat, lng } });
    }
    return { singles: singlesOut, clusters: clustersOut };
  }, [map, places, selectedId, zoom]);

  return (
    <>
      {clusters.map((c) => {
        const emoji = CATEGORY_EMOJI[c.members[0]!.category as MapCategoryKey] ?? "📍";
        return (
          <Marker
            key={`cluster:${c.key}`}
            position={[c.center.lat, c.center.lng]}
            icon={clusterIcon(c.members.length, emoji)}
            title={String(c.members.length)}
            eventHandlers={{
              click: () => {
                const bounds = L.latLngBounds(c.members.map((m) => [m.location.lat, m.location.lng]));
                if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
                  map.flyTo(bounds.getCenter(), Math.min(zoom + 3, CLUSTER_MAX_ZOOM + 1), { duration: 0.5 });
                } else {
                  map.flyToBounds(bounds, { padding: [60, 60], maxZoom: CLUSTER_MAX_ZOOM + 1, duration: 0.5 });
                }
              },
            }}
          />
        );
      })}
      {singles.map((p) => {
        const active = p.id === selectedId;
        return (
          <Marker
            key={p.id}
            position={[p.location.lat, p.location.lng]}
            icon={placeIcon(p.category, active)}
            zIndexOffset={active ? 1000 : 0}
            eventHandlers={{ click: () => onSelectPlace(p) }}
            title={p.name}
            alt={p.name}
          >
            {active ? (
              <Tooltip permanent direction="top" className="cg-tip">
                {placeIsHereLabel(p.name)}
              </Tooltip>
            ) : null}
          </Marker>
        );
      })}
    </>
  );
}

const MODE_COLOR: Record<TravelMode, string> = {
  walking: "#0d9488",
  cycling: "#16a34a",
  driving: "#2563eb",
  transit: "#7c3aed",
};

export type MapRouteLine = { index: number; geometry: LatLng[]; active: boolean };

export type MapCanvasProps = {
  tiles: MapTiles;
  userFix: LocationFix | null;
  heading: number | null;
  places: MapPlace[];
  selectedId?: string | null;
  routeLines: MapRouteLine[];
  routeMode: TravelMode;
  fitKey: string;
  fitPoints: LatLng[];
  insets: MapInsets;
  youAreHereLabel: string;
  placeIsHereLabel: (name: string) => string;
  /** Named start of an A→B route ("Аз Душанбе …"), shown instead of routing from the user. */
  origin?: { location: LatLng; name: string } | null;
  onSelectPlace: (place: MapPlace) => void;
  onPickRoute: (index: number) => void;
  onReady: (map: L.Map) => void;
  /** Tap on an empty spot of the map; omitted = tapping does nothing. */
  onMapTap?: (point: LatLng) => void;
  /** The tapped point, marked with a pin. */
  droppedPin?: LatLng | null;
  droppedPinLabel?: string;
};

function MapCanvasImpl({
  tiles,
  userFix,
  heading,
  places,
  selectedId,
  origin,
  routeLines,
  routeMode,
  fitKey,
  fitPoints,
  insets,
  youAreHereLabel,
  placeIsHereLabel,
  onSelectPlace,
  onPickRoute,
  onReady,
  onMapTap,
  droppedPin,
  droppedPinLabel,
}: MapCanvasProps) {
  const lines = useMemo(
    () =>
      routeLines
        .filter((l) => l.geometry.length > 1)
        .map((l) => ({ ...l, positions: l.geometry.map((g) => [g.lat, g.lng] as [number, number]) }))
        // Active route on top.
        .sort((a, b) => Number(a.active) - Number(b.active)),
    [routeLines],
  );
  const color = MODE_COLOR[routeMode];

  return (
    <MapContainer
      center={[WORLD_CENTER.lat, WORLD_CENTER.lng]}
      zoom={WORLD_ZOOM}
      minZoom={2}
      maxZoom={tiles.maxZoom}
      worldCopyJump
      className="h-full w-full"
      zoomControl={false}
      attributionControl
      preferCanvas
    >
      <TileLayer
        key={tiles.url}
        url={tiles.url}
        attribution={tiles.attribution}
        maxZoom={tiles.maxZoom}
        {...(tiles.subdomains ? { subdomains: tiles.subdomains } : {})}
        keepBuffer={4}
        updateWhenZooming={false}
        eventHandlers={TILE_EVENTS}
      />
      <Controller onReady={onReady} fitKey={fitKey} fitPoints={fitPoints} insets={insets} />
      {onMapTap ? <TapHandler onTap={onMapTap} /> : null}

      {lines.map((l) =>
        l.active ? (
          <Fragment key={`r${l.index}`}>
            <Polyline positions={l.positions} pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.9, lineCap: "round" }} />
            <Polyline
              positions={l.positions}
              pathOptions={{
                color,
                weight: 5,
                opacity: 1,
                lineCap: "round",
                dashArray: routeMode === "walking" ? "1 9" : undefined,
              }}
            />
          </Fragment>
        ) : (
          <Polyline
            key={`r${l.index}`}
            positions={l.positions}
            pathOptions={{ color: "#64748b", weight: 6, opacity: 0.55, lineCap: "round" }}
            bubblingMouseEvents={false}
            eventHandlers={{ click: () => onPickRoute(l.index) }}
          />
        ),
      )}

      <PlaceMarkers
        places={places}
        selectedId={selectedId}
        placeIsHereLabel={placeIsHereLabel}
        onSelectPlace={onSelectPlace}
      />

      {origin ? (
        <Marker position={[origin.location.lat, origin.location.lng]} icon={startIcon()} zIndexOffset={900} title={origin.name}>
          <Tooltip permanent direction="top" className="cg-tip">
            {origin.name}
          </Tooltip>
        </Marker>
      ) : null}

      {userFix ? (
        <>
          {userFix.accuracyMeters > 25 ? (
            <Circle
              center={[userFix.location.lat, userFix.location.lng]}
              radius={userFix.accuracyMeters}
              pathOptions={{ color: "#2563eb", weight: 1, fillColor: "#2563eb", fillOpacity: 0.08 }}
              interactive={false}
            />
          ) : null}
          <Marker
            position={[userFix.location.lat, userFix.location.lng]}
            icon={meIcon(heading)}
            zIndexOffset={2000}
            keyboard={false}
          >
            <Tooltip permanent direction="top" offset={[0, -14]} className="cg-tip">
              {youAreHereLabel}
            </Tooltip>
          </Marker>
        </>
      ) : null}

      {droppedPin ? (
        <Marker
          // New key per point replays the drop animation.
          key={`pin:${droppedPin.lat},${droppedPin.lng}`}
          position={[droppedPin.lat, droppedPin.lng]}
          icon={droppedPinIcon()}
          zIndexOffset={2500}
          interactive={false}
          keyboard={false}
          alt={droppedPinLabel}
        />
      ) : null}
    </MapContainer>
  );
}

export const MapCanvas = memo(MapCanvasImpl);
