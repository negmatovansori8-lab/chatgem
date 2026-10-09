/**
 * Map → Chat: what the embedded map actually found for a chat command.
 * Every value comes from the search/routing providers.
 */
import type { MapCategoryKey } from "@/lib/maps/intent";
import type { MapReportKind } from "@/lib/maps/map-action";
import type { RouteMetrics, TravelMode } from "@/providers/maps/types";

/** A command for the embedded map: a Maps deep link plus what to report back. */
export type MapCommand = { id: number; href: string; report?: MapReportKind };

export type MapResultPlace = {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  category?: string;
  walk?: RouteMetrics | null;
  drive?: RouteMetrics | null;
};

export type MapResultBody =
  | {
      kind: "places";
      category?: MapCategoryKey;
      /** The search ran in a named city/country or around a named place, not around the user. */
      scope?: { kind: "area" | "around"; name: string };
      /** Metrics are measured from here (a named start) instead of the user. */
      originName?: string;
      hasLocation: boolean;
      places: MapResultPlace[];
    }
  | {
      kind: "route";
      place: MapResultPlace;
      mode: TravelMode;
      distanceMeters: number;
      durationSeconds: number;
      originName?: string;
    }
  | { kind: "locate"; address?: string; accuracyMeters?: number; approximate?: boolean }
  | { kind: "error"; code: string; source: "location" | "search" | "route" };

export type MapResult = MapResultBody & { commandId: number };
