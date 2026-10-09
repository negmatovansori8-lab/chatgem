"use client";

import type { MapsErrorCode } from "@/providers/maps/errors";
import type { MapIntent, MapCategoryKey } from "@/lib/maps/intent";
import type { ClarifyCountry } from "@/lib/maps/search-service";
import type { LatLng, MapArea, MapPlace, MapTiles, RouteLeg, RouteMetrics, TravelMode } from "@/providers/maps/types";

export type ClientErrorCode = MapsErrorCode | "offline" | "aborted";

export class MapsApiError extends Error {
  constructor(readonly code: ClientErrorCode) {
    super(code);
    this.name = "MapsApiError";
  }
}

async function post<T>(url: string, body: unknown, signal?: AbortSignal, timeoutMs = 30_000): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new MapsApiError("offline");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
  const onAbort = () => ctrl.abort("aborted");
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: { code?: MapsErrorCode } };
    if (!res.ok || data.error) {
      throw new MapsApiError(data.error?.code ?? (res.status === 429 ? "rate_limit" : "api_error"));
    }
    return data;
  } catch (e) {
    if (e instanceof MapsApiError) throw e;
    if (signal?.aborted) throw new MapsApiError("aborted");
    if (ctrl.signal.aborted) throw new MapsApiError("timeout");
    throw new MapsApiError(navigator.onLine === false ? "offline" : "network");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export type SearchResponse = {
  intent: MapIntent;
  places: MapPlace[];
  area?: MapArea;
  /** Results are inside the country/city the user named, not around the user. */
  scoped?: boolean;
  needsLocation?: boolean;
  clarify?: ClarifyCountry;
};

export function searchPlaces(
  input: {
    q?: string;
    category?: MapCategoryKey;
    near?: LatLng | null;
    area?: LatLng | null;
    around?: LatLng | null;
    locale: string;
  },
  signal?: AbortSignal,
) {
  return post<SearchResponse>(
    "/api/maps/search",
    {
      q: input.q,
      category: input.category,
      near: input.near ?? undefined,
      area: input.area ?? undefined,
      around: input.around ?? undefined,
      locale: input.locale,
    },
    signal,
    45_000,
  );
}

export function suggestPlaces(input: { q: string; near?: LatLng | null; locale: string }, signal?: AbortSignal) {
  return post<{ places: MapPlace[] }>(
    "/api/maps/suggest",
    { q: input.q, near: input.near ?? undefined, locale: input.locale },
    signal,
    8_000,
  );
}

export type MatrixResponse = {
  walking?: (RouteMetrics | null)[];
  driving?: (RouteMetrics | null)[];
  /** Modes whose routing provider failed (their entries are missing, not "no route"). */
  errors?: Partial<Record<"walking" | "driving", string>>;
};

export function fetchMatrix(from: LatLng, to: LatLng[], signal?: AbortSignal) {
  return post<MatrixResponse>("/api/maps/matrix", { from, to, modes: ["walking", "driving"] }, signal);
}

export async function fetchRoute(
  input: { from: LatLng; to: LatLng; mode: TravelMode; locale: string },
  signal?: AbortSignal,
): Promise<RouteLeg> {
  const data = await post<{ route: RouteLeg }>("/api/maps/route", input, signal);
  return data.route;
}

/** In-memory only (~11 m cells, like the server cache); taps on the same spot don't refetch. */
const reverseCache = new Map<string, MapPlace | null>();
const REVERSE_CACHE_MAX = 120;

function reverseKey(point: LatLng, locale: string) {
  return `${point.lat.toFixed(4)},${point.lng.toFixed(4)}|${locale}`;
}

/** Cached address of a point: `undefined` when it hasn't been looked up yet. */
export function peekReverseGeocode(point: LatLng, locale: string): MapPlace | null | undefined {
  return reverseCache.get(reverseKey(point, locale));
}

/** Address of a point (the user's own fix is sent only for this lookup, never stored). */
export async function reverseGeocode(point: LatLng, locale: string, signal?: AbortSignal): Promise<MapPlace | null> {
  const key = reverseKey(point, locale);
  if (reverseCache.has(key)) return reverseCache.get(key)!;
  let place: MapPlace | null;
  try {
    const data = await post<{ place?: MapPlace }>(
      "/api/maps/reverse",
      { lat: point.lat, lng: point.lng, locale },
      signal,
      10_000,
    );
    place = data.place ?? null;
  } catch (e) {
    if (!(e instanceof MapsApiError && e.code === "place_not_found")) throw e;
    place = null;
  }
  if (reverseCache.size >= REVERSE_CACHE_MAX) reverseCache.delete(reverseCache.keys().next().value!);
  reverseCache.set(key, place);
  return place;
}

export type MapsStatus = {
  tiles: MapTiles;
  dark: MapTiles | null;
  satellite: MapTiles | null;
  transitAvailable: boolean;
  trafficAvailable: boolean;
};

export async function fetchMapsStatus(): Promise<MapsStatus> {
  const res = await fetch("/api/maps/status");
  if (!res.ok) throw new MapsApiError("api_error");
  return (await res.json()) as MapsStatus;
}

/** i18n key for an API/location error code. */
export function errorKey(code: string): string {
  switch (code) {
    case "offline":
      return "maps.err.offline";
    case "network":
      return "maps.err.network";
    case "timeout":
      return "maps.err.timeout";
    case "rate_limit":
      return "maps.err.rateLimit";
    case "place_not_found":
      return "maps.err.notFound";
    case "route_not_found":
      return "maps.err.route";
    case "transit_unavailable":
      return "maps.transitUnavailable";
    case "permission_denied":
      return "maps.err.permissionDenied";
    case "gps_unavailable":
      return "maps.err.gpsUnavailable";
    case "insecure_context":
      return "maps.err.insecure";
    case "unsupported":
      return "maps.err.unsupported";
    default:
      return "maps.err.api";
  }
}
