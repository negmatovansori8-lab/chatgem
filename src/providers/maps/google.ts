/**
 * Google Directions — enabled only when GOOGLE_MAPS_SERVER_KEY is set.
 * The key is used server-side only; the browser never sees it.
 */
import { decodeOsrmPolyline } from "@/lib/maps/geo";
import { TtlCache, coordKey } from "@/providers/maps/cache";
import { MapsError, fetchJson } from "@/providers/maps/errors";
import { unavailableLeg } from "@/providers/maps/osrm";
import type {
  RouteLeg,
  RouteQuery,
  RouteTraffic,
  TrafficLevel,
  TrafficProvider,
  TransitLine,
  TransitProvider,
  TransitStep,
  TransitVehicle,
} from "@/providers/maps/types";

const DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";

type GoogleStep = {
  travel_mode?: string;
  duration?: { value: number };
  distance?: { value: number };
  transit_details?: {
    num_stops?: number;
    headsign?: string;
    departure_stop?: { name?: string };
    arrival_stop?: { name?: string };
    line?: { name?: string; short_name?: string; vehicle?: { type?: string } };
  };
};

type GoogleLeg = {
  distance: { value: number };
  duration: { value: number };
  duration_in_traffic?: { value: number };
  steps?: GoogleStep[];
};

type DirectionsResponse = {
  status: string;
  routes?: { overview_polyline?: { points: string }; legs?: GoogleLeg[] }[];
};

/** Google vehicle types → our line kinds (https://developers.google.com/maps/documentation/directions/get-directions#VehicleType). */
function vehicleOf(type: string | undefined): TransitVehicle {
  switch (type) {
    case "BUS":
    case "INTERCITY_BUS":
    case "TROLLEYBUS":
    case "SHARE_TAXI":
      return "bus";
    case "SUBWAY":
    case "METRO_RAIL":
      return "metro";
    case "RAIL":
    case "HEAVY_RAIL":
    case "COMMUTER_TRAIN":
    case "HIGH_SPEED_TRAIN":
    case "LONG_DISTANCE_TRAIN":
    case "MONORAIL":
      return "train";
    case "TRAM":
    case "CABLE_CAR":
    case "FUNICULAR":
      return "tram";
    case "FERRY":
      return "ferry";
    default:
      return "other";
  }
}

function language(locale: string | undefined): string {
  const l = locale?.split("-")[0];
  return l === "en" ? "en" : "ru";
}

async function directions(params: Record<string, string>): Promise<DirectionsResponse> {
  const data = await fetchJson<DirectionsResponse>(`${DIRECTIONS_URL}?${new URLSearchParams(params)}`, {
    timeoutMs: 15_000,
  });
  if (data.status === "OVER_QUERY_LIMIT") throw new MapsError("rate_limit");
  if (data.status === "REQUEST_DENIED") throw new MapsError("api_error", "google_denied");
  return data;
}

function stepsOf(leg: GoogleLeg): TransitStep[] {
  const steps: TransitStep[] = [];
  for (const s of leg.steps ?? []) {
    const duration = s.duration?.value ?? 0;
    if (s.travel_mode === "TRANSIT" && s.transit_details?.line) {
      const d = s.transit_details;
      const name = d.line?.short_name || d.line?.name;
      if (!name) continue;
      steps.push({
        kind: "ride",
        vehicle: vehicleOf(d.line?.vehicle?.type),
        name: name.slice(0, 40),
        durationSeconds: duration,
        ...(d.num_stops != null ? { stops: d.num_stops } : {}),
        ...(d.headsign ? { headsign: d.headsign.slice(0, 80) } : {}),
        ...(d.departure_stop?.name ? { from: d.departure_stop.name.slice(0, 80) } : {}),
        ...(d.arrival_stop?.name ? { to: d.arrival_stop.name.slice(0, 80) } : {}),
      });
    } else if (s.travel_mode === "WALKING" && duration > 0) {
      const prev = steps[steps.length - 1];
      if (prev?.kind === "walk") {
        prev.durationSeconds += duration;
        prev.distanceMeters += s.distance?.value ?? 0;
      } else {
        steps.push({ kind: "walk", durationSeconds: duration, distanceMeters: s.distance?.value ?? 0 });
      }
    }
  }
  return steps;
}

export class GoogleTransitProvider implements TransitProvider {
  readonly id = "google-directions";
  readonly available = true;
  private readonly cache = new TtlCache<RouteLeg>(300, 2 * 60_000);

  constructor(private readonly apiKey: string) {}

  async route(query: RouteQuery): Promise<RouteLeg> {
    const key = `${coordKey(query.from)}|${coordKey(query.to)}|${query.locale ?? ""}`;
    return this.cache.getOrLoad(key, async () => {
      const data = await directions({
        origin: `${query.from.lat},${query.from.lng}`,
        destination: `${query.to.lat},${query.to.lng}`,
        mode: "transit",
        departure_time: "now",
        key: this.apiKey,
        language: language(query.locale),
      });
      const route = data.routes?.[0];
      const leg = route?.legs?.[0];
      if (data.status !== "OK" || !leg) return unavailableLeg("transit", this.id);
      const poly = route.overview_polyline?.points;
      const transitSteps = stepsOf(leg);
      const transitLines: TransitLine[] = transitSteps.flatMap((s) =>
        s.kind === "ride" ? [{ vehicle: s.vehicle, name: s.name, durationSeconds: s.durationSeconds }] : [],
      );
      return {
        mode: "transit",
        distanceMeters: leg.distance.value,
        durationSeconds: leg.duration.value,
        geometry: poly ? decodeOsrmPolyline(poly) : [],
        available: true,
        ...(transitLines.length ? { transitLines, transitSteps } : {}),
        provider: this.id,
      };
    });
  }
}

function levelOf(ratio: number): TrafficLevel {
  if (ratio <= 1.1) return "normal";
  if (ratio <= 1.35) return "moderate";
  return "heavy";
}

/** Live traffic from Google Directions (`duration_in_traffic`, departure now). */
export class GoogleTrafficProvider implements TrafficProvider {
  readonly id = "google-traffic";
  readonly available = true;
  private readonly cache = new TtlCache<RouteTraffic | null>(300, 2 * 60_000);

  constructor(private readonly apiKey: string) {}

  async driving(query: Omit<RouteQuery, "mode">): Promise<RouteTraffic | null> {
    const key = `${coordKey(query.from)}|${coordKey(query.to)}`;
    return this.cache.getOrLoad(key, async () => {
      const data = await directions({
        origin: `${query.from.lat},${query.from.lng}`,
        destination: `${query.to.lat},${query.to.lng}`,
        mode: "driving",
        departure_time: "now",
        key: this.apiKey,
      });
      const leg = data.routes?.[0]?.legs?.[0];
      const inTraffic = leg?.duration_in_traffic?.value;
      if (data.status !== "OK" || !leg || !inTraffic || !leg.duration.value) return null;
      return {
        durationInTrafficSeconds: inTraffic,
        level: levelOf(inTraffic / leg.duration.value),
        provider: this.id,
      };
    });
  }
}
