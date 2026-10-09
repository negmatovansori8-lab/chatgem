import { decodeOsrmPolyline, haversineMeters } from "@/lib/maps/geo";
import { TtlCache, coordKey } from "@/providers/maps/cache";
import { MapsError, fetchJson } from "@/providers/maps/errors";
import type {
  LatLng,
  MatrixQuery,
  RouteAlternative,
  RouteLeg,
  RouteMetrics,
  RouteQuery,
  RoutingProvider,
  TrafficProvider,
  TransitProvider,
  TravelMode,
} from "@/providers/maps/types";

/**
 * Separate OSRM instances per profile. The FOSSGIS servers run real foot, bike
 * and car graphs (the public project-osrm.org demo only has a car graph, so its
 * "foot" durations are not walking times).
 */
const FOOT_BASE =
  process.env.OSRM_FOOT_URL?.trim() || "https://routing.openstreetmap.de/routed-foot";
const BIKE_BASE =
  process.env.OSRM_BIKE_URL?.trim() || "https://routing.openstreetmap.de/routed-bike";
const CAR_BASE =
  process.env.OSRM_CAR_URL?.trim() || "https://routing.openstreetmap.de/routed-car";

const UA = "ChatGem/1.0 (maps-module)";
const MAX_MATRIX_DESTINATIONS = 24;
const SIMPLIFY_OVER_METERS = 50_000;
/** Alternatives on continent-scale routes are slow to compute and rarely useful. */
const ALTERNATIVES_MAX_METERS = 300_000;

type OsrmMode = Exclude<TravelMode, "transit">;

const routeCache = new TtlCache<RouteLeg>(500, 5 * 60_000);
const matrixCache = new TtlCache<(RouteMetrics | null)[]>(300, 3 * 60_000);

function baseFor(mode: OsrmMode): string {
  const base = mode === "walking" ? FOOT_BASE : mode === "cycling" ? BIKE_BASE : CAR_BASE;
  return base.replace(/\/+$/, "");
}

function lngLat(p: LatLng) {
  return `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
}

export function unavailableLeg(mode: RouteLeg["mode"], provider: string): RouteLeg {
  return {
    mode,
    distanceMeters: 0,
    durationSeconds: 0,
    geometry: [],
    available: false,
    unavailableReason: mode === "transit" ? "transit_unavailable" : "route_not_found",
    provider,
  };
}

type OsrmRoute = { distance: number; duration: number; geometry: string };

export class OsrmRoutingProvider implements RoutingProvider {
  readonly id = "osrm";

  async route(query: RouteQuery): Promise<RouteLeg> {
    if (query.mode === "transit") return unavailableLeg("transit", this.id);
    const mode = query.mode;
    const key = `${mode}|${coordKey(query.from)}|${coordKey(query.to)}`;

    return routeCache.getOrLoad(key, async () => {
      const straight = haversineMeters(query.from, query.to);
      // Cross-country routes: a simplified line keeps the payload and the map light.
      const overview = straight > SIMPLIFY_OVER_METERS ? "simplified" : "full";
      const alternatives = straight <= ALTERNATIVES_MAX_METERS ? "2" : "false";
      // OSRM ignores the profile segment; each base URL serves one graph.
      const url = `${baseFor(mode)}/route/v1/driving/${lngLat(query.from)};${lngLat(query.to)}?overview=${overview}&geometries=polyline&steps=false&alternatives=${alternatives}`;
      const data = await fetchJson<{ code?: string; routes?: OsrmRoute[] }>(url, {
        headers: { "User-Agent": UA },
        timeoutMs: 15_000,
      });

      const [r, ...others] = data.routes ?? [];
      if (data.code !== "Ok" || !r) return unavailableLeg(mode, this.id);
      const alts: RouteAlternative[] = others.map((o) => ({
        distanceMeters: o.distance,
        durationSeconds: o.duration,
        geometry: decodeOsrmPolyline(o.geometry),
      }));
      return {
        mode,
        distanceMeters: r.distance,
        durationSeconds: r.duration,
        geometry: decodeOsrmPolyline(r.geometry),
        available: true,
        ...(alts.length ? { alternatives: alts } : {}),
        provider: this.id,
      };
    });
  }

  async matrix(query: MatrixQuery): Promise<(RouteMetrics | null)[]> {
    const targets = query.to.slice(0, MAX_MATRIX_DESTINATIONS);
    if (!targets.length) return [];
    const key = `${query.mode}|${coordKey(query.from)}|${targets.map((t) => coordKey(t)).join(";")}`;

    return matrixCache.getOrLoad(key, async () => {
      const coords = [query.from, ...targets].map(lngLat).join(";");
      const url = `${baseFor(query.mode)}/table/v1/driving/${coords}?sources=0&annotations=duration,distance`;
      const data = await fetchJson<{
        code?: string;
        durations?: (number | null)[][];
        distances?: (number | null)[][];
      }>(url, { headers: { "User-Agent": UA }, timeoutMs: 15_000 });

      if (data.code !== "Ok") throw new MapsError("api_error", `osrm_${data.code}`);
      const durations = data.durations?.[0] ?? [];
      const distances = data.distances?.[0] ?? [];
      return targets.map((_, i) => {
        const duration = durations[i + 1];
        const distance = distances[i + 1];
        if (duration == null || distance == null) return null;
        return { distanceMeters: distance, durationSeconds: duration };
      });
    });
  }
}

/** Honest default: no live traffic source configured → the UI shows no traffic. */
export class UnavailableTrafficProvider implements TrafficProvider {
  readonly id = "traffic-unavailable";
  readonly available = false;

  async driving(): Promise<null> {
    return null;
  }
}

/** Honest default: no public-transport feed configured → report unavailable. */
export class UnavailableTransitProvider implements TransitProvider {
  readonly id = "transit-unavailable";
  readonly available = false;

  async route(): Promise<RouteLeg> {
    return unavailableLeg("transit", this.id);
  }
}
