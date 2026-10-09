/**
 * Provider-agnostic map contracts.
 * UI and API routes depend only on these interfaces, so any backend
 * (OSM, Google, Mapbox, 2GIS, self-hosted OSRM…) can be swapped in
 * `src/providers/maps/index.ts` without touching the rest of the app.
 */

export type LatLng = { lat: number; lng: number };

export type MapPlace = {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  category?: string;
  rating?: number;
  /** Straight-line distance — used only for pre-ranking, never shown as travel distance. */
  distanceMeters?: number;
  /** City / town the place is in, and its country (from the geocoder). */
  locality?: string;
  country?: string;
  countryCode?: string;
  /** Contact/hours exactly as published in the provider data (never guessed). */
  details?: PlaceDetails;
  /** Structured address parts exactly as the geocoder returned them. */
  postal?: PostalAddress;
  source: string;
};

/** Only fields the provider actually has are set — a missing house number stays missing. */
export type PostalAddress = {
  road?: string;
  houseNumber?: string;
  /** Mahalla / neighbourhood / suburb. */
  neighbourhood?: string;
  /** City district or rural district (ноҳия). */
  district?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countryCode?: string;
};

export type PlaceDetails = {
  phone?: string;
  website?: string;
  /** Raw opening_hours value ("Mo-Fr 08:00-20:00"). */
  openingHours?: string;
  cuisine?: string;
  wheelchair?: "yes" | "no" | "limited";
  operator?: string;
};

export type BBox = { south: number; north: number; west: number; east: number };

/** A resolved city/country the user scoped a search to. */
export type MapArea = {
  kind: "country" | "city";
  name: string;
  displayName: string;
  center: LatLng;
  bbox: BBox;
  countryCode?: string;
  /** Provider type: "state", "county", "city", "village"… */
  type?: string;
};

export type AreaQuery = {
  query: string;
  kind: "country" | "city" | "auto";
  countryCode?: string;
  locale?: string;
  /** "auto" only: rank areas of this country first (the user's country). */
  preferCountryCode?: string;
  /** "auto" only: rank this admin level first ("вилоят" → state). */
  level?: "state" | "district" | "settlement";
  /** "auto" only: the area's name must contain the typed name. */
  exactName?: boolean;
};

export type TransitVehicle = "bus" | "metro" | "train" | "tram" | "ferry" | "other";

export type TransitLine = {
  vehicle: TransitVehicle;
  name: string;
  durationSeconds: number;
};

/** One step of a real public-transport itinerary. */
export type TransitStep =
  | { kind: "walk"; durationSeconds: number; distanceMeters: number }
  | {
      kind: "ride";
      vehicle: TransitVehicle;
      name: string;
      durationSeconds: number;
      stops?: number;
      headsign?: string;
      from?: string;
      to?: string;
    };

export type TravelMode = "walking" | "cycling" | "driving" | "transit";

export const TRAVEL_MODES: TravelMode[] = ["walking", "cycling", "driving", "transit"];

export type TrafficLevel = "normal" | "moderate" | "heavy";

/** Live traffic for a driving route — only from a real traffic provider. */
export type RouteTraffic = {
  durationInTrafficSeconds: number;
  level: TrafficLevel;
  provider: string;
};

/** Another real route between the same points (provider alternatives). */
export type RouteAlternative = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: LatLng[];
};

/** Real network distance/duration returned by a routing provider. */
export type RouteMetrics = {
  distanceMeters: number;
  durationSeconds: number;
};

export type RouteLeg = {
  mode: TravelMode;
  distanceMeters: number;
  durationSeconds: number;
  geometry: LatLng[];
  available: boolean;
  unavailableReason?: "route_not_found" | "transit_unavailable";
  /** Real public-transport lines of a transit leg (from the transit provider). */
  transitLines?: TransitLine[];
  transitSteps?: TransitStep[];
  /** Other real routes the provider returned (the leg itself is route 1). */
  alternatives?: RouteAlternative[];
  traffic?: RouteTraffic;
  provider: string;
};

export type SearchQuery = {
  text: string;
  near?: LatLng;
  locale?: string;
  limit?: number;
};

export type NearbyQuery = {
  category: string;
  near: LatLng;
  radiusMeters?: number;
  locale?: string;
  limit?: number;
};

export type RouteQuery = {
  from: LatLng;
  to: LatLng;
  mode: TravelMode;
  locale?: string;
};

export type MatrixQuery = {
  from: LatLng;
  to: LatLng[];
  mode: Exclude<TravelMode, "transit">;
};

/** Tile / basemap configuration (rendered client-side by Leaflet). */
export type MapTiles = {
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string;
};

export interface MapProvider {
  readonly id: string;
  tiles(): MapTiles;
  darkTiles(): MapTiles | null;
  satelliteTiles(): MapTiles | null;
}

export type LocationFix = {
  location: LatLng;
  accuracyMeters: number;
  timestamp: number;
  /** City-level estimate from the network (IP) because GPS was unavailable. */
  approximate?: boolean;
  /** "Dushanbe, Tajikistan" for approximate fixes. */
  place?: string;
};

export type LocationErrorCode =
  | "permission_denied"
  | "gps_unavailable"
  | "timeout"
  | "insecure_context"
  | "unsupported";

/** Client-side device location source (browser Geolocation, native bridge…). */
export interface LocationProvider {
  readonly id: string;
  isSupported(): boolean;
  getCurrentPosition(opts?: { timeoutMs?: number; maximumAge?: number }): Promise<LocationFix>;
}

export interface SearchProvider {
  readonly id: string;
  search(query: SearchQuery): Promise<MapPlace[]>;
  /** Named place inside a resolved city/country ("Big Ben" in London). */
  searchIn(text: string, area: MapArea, opts?: { locale?: string; limit?: number }): Promise<MapPlace[]>;
}

export interface GeocodingProvider {
  readonly id: string;
  geocode(text: string, opts?: { near?: LatLng; locale?: string }): Promise<MapPlace[]>;
  reverse(location: LatLng, locale?: string): Promise<MapPlace | null>;
  /** City/country boundary lookup; null when the text is not such a place. */
  resolveArea(query: AreaQuery): Promise<MapArea | null>;
}

export interface NearbyProvider {
  readonly id: string;
  nearby(query: NearbyQuery): Promise<MapPlace[]>;
}

export interface RoutingProvider {
  readonly id: string;
  route(query: RouteQuery): Promise<RouteLeg>;
  /** One-to-many real network metrics; `null` where no route exists. */
  matrix(query: MatrixQuery): Promise<(RouteMetrics | null)[]>;
}

export interface TransitProvider {
  readonly id: string;
  /** False when no real public-transport data source is configured. */
  readonly available: boolean;
  route(query: RouteQuery): Promise<RouteLeg>;
}

export interface TrafficProvider {
  readonly id: string;
  /** False when no real traffic source is configured — the UI then hides traffic. */
  readonly available: boolean;
  driving(query: Omit<RouteQuery, "mode">): Promise<RouteTraffic | null>;
}

/** Type-ahead suggestions (prefix + typo tolerant). */
export interface AutocompleteProvider {
  readonly id: string;
  suggest(text: string, opts: { near?: LatLng; locale?: string; limit?: number }): Promise<MapPlace[]>;
}

export type MapsStack = {
  map: MapProvider;
  search: SearchProvider;
  geocoding: GeocodingProvider;
  nearby: NearbyProvider;
  routing: RoutingProvider;
  transit: TransitProvider;
  traffic: TrafficProvider;
  autocomplete: AutocompleteProvider;
};

export const WORLD_CENTER: LatLng = { lat: 20, lng: 0 };
export const WORLD_ZOOM = 2;

/** Tajikistan bounding box (lonW, latS, lonE, latN). */
export const TAJIKISTAN_BBOX = {
  west: 67.3,
  south: 36.65,
  east: 75.15,
  north: 41.05,
} as const;

export const TAJIKISTAN_CENTER: LatLng = { lat: 38.861, lng: 71.276 };

export function isInTajikistan(p: LatLng): boolean {
  return (
    p.lat >= TAJIKISTAN_BBOX.south &&
    p.lat <= TAJIKISTAN_BBOX.north &&
    p.lng >= TAJIKISTAN_BBOX.west &&
    p.lng <= TAJIKISTAN_BBOX.east
  );
}

export const CITY_PRESETS: { id: string; name: string; nameTg: string; location: LatLng }[] = [
  { id: "dushanbe", name: "Dushanbe", nameTg: "Душанбе", location: { lat: 38.5598, lng: 68.7738 } },
  { id: "khujand", name: "Khujand", nameTg: "Хуҷанд", location: { lat: 40.2822, lng: 69.622 } },
  { id: "vahdat", name: "Vahdat", nameTg: "Ваҳдат", location: { lat: 38.556, lng: 69.014 } },
  { id: "hisor", name: "Hisor", nameTg: "Ҳисор", location: { lat: 38.525, lng: 68.551 } },
  { id: "tursunzoda", name: "Tursunzoda", nameTg: "Турсунзода", location: { lat: 38.512, lng: 68.23 } },
  { id: "bokhtar", name: "Bokhtar", nameTg: "Бохтар", location: { lat: 37.837, lng: 68.78 } },
  { id: "kulob", name: "Kulob", nameTg: "Кӯлоб", location: { lat: 37.909, lng: 69.781 } },
  { id: "istaravshan", name: "Istaravshan", nameTg: "Истаравшан", location: { lat: 39.91, lng: 69.0 } },
  { id: "panjakent", name: "Panjakent", nameTg: "Панҷакент", location: { lat: 39.495, lng: 67.609 } },
  { id: "rasht", name: "Rasht", nameTg: "Рашт", location: { lat: 39.019, lng: 70.375 } },
  { id: "khorugh", name: "Khorugh", nameTg: "Хоруғ", location: { lat: 37.49, lng: 71.556 } },
];
