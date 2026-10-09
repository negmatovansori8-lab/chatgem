/**
 * Structured map command produced from a chat/voice utterance.
 * The chat server sends it with the SSE `action` event; the embedded map runs
 * `href` (a Maps deep link) and, when `report` is set, sends its REAL result
 * back to the chat. Pure module — safe on server and client.
 */
import type { MapCategoryKey } from "@/lib/maps/intent";
import type { TravelMode } from "@/providers/maps/types";

export const MAP_ACTION_TYPES = [
  "MAP_CURRENT_LOCATION",
  "MAP_SEARCH_PLACE",
  "MAP_NEARBY_SEARCH",
  "MAP_ROUTE",
  "MAP_DISTANCE",
  "MAP_ETA",
  "MAP_ADDRESS",
  "MAP_CATEGORY",
  "MAP_CITY_SEARCH",
  "MAP_COUNTRY_SEARCH",
] as const;

export type MapActionType = (typeof MAP_ACTION_TYPES)[number];

/**
 * Where an action applies: the device position, the place selected on the map
 * (or the last result), or a named place ("London, UK").
 */
export type MapActionLocation = "current" | "selected_place" | (string & {});

/** Which real result the map reports back to the chat when it finishes. */
export type MapReportKind = "places" | "route" | "locate";

export type MapAction = {
  type: MapActionType;
  category?: MapCategoryKey;
  query?: string;
  /** Search centre for place/category searches. */
  location?: MapActionLocation;
  origin?: MapActionLocation;
  destination?: MapActionLocation;
  mode?: TravelMode;
  /** Maps deep link that performs the action. */
  href: string;
  report?: MapReportKind;
};

export function isMapAction(v: unknown): v is MapAction {
  if (!v || typeof v !== "object") return false;
  const a = v as Partial<MapAction>;
  return (
    typeof a.type === "string" &&
    (MAP_ACTION_TYPES as readonly string[]).includes(a.type) &&
    typeof a.href === "string" &&
    a.href.startsWith("/app/maps")
  );
}
