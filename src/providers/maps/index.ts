import { GoogleTrafficProvider, GoogleTransitProvider } from "@/providers/maps/google";
import { GoogleReverseGeocoder } from "@/providers/maps/google-geocoding";
import { NominatimSearchProvider } from "@/providers/maps/nominatim";
import { OsmMapProvider } from "@/providers/maps/osm-map";
import { OverpassNearbyProvider } from "@/providers/maps/overpass";
import {
  OsrmRoutingProvider,
  UnavailableTrafficProvider,
  UnavailableTransitProvider,
} from "@/providers/maps/osrm";
import { PhotonAutocompleteProvider } from "@/providers/maps/photon";
import type { MapsStack } from "@/providers/maps/types";

/**
 * Maps provider factory — the ONLY place that knows concrete backends.
 * Default (no keys): OSM tiles + Nominatim + Photon + Overpass + OSRM (FOSSGIS foot/bike/car).
 * GOOGLE_MAPS_SERVER_KEY (server-only) enables real public-transit routes and live traffic;
 * with MAPS_REVERSE_GEOCODER=google it also answers tap-on-map addresses (Nominatim as fallback).
 * To switch vendors, implement the interfaces in ./types and return them here.
 */
export function createMapsStack(): MapsStack {
  const nominatim = new NominatimSearchProvider();
  const googleKey = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
  const googleReverse = googleKey && process.env.MAPS_REVERSE_GEOCODER?.trim().toLowerCase() === "google";

  return {
    map: new OsmMapProvider(),
    search: nominatim,
    geocoding: googleReverse ? new GoogleReverseGeocoder(googleKey, nominatim) : nominatim,
    nearby: new OverpassNearbyProvider(),
    routing: new OsrmRoutingProvider(),
    transit: googleKey ? new GoogleTransitProvider(googleKey) : new UnavailableTransitProvider(),
    traffic: googleKey ? new GoogleTrafficProvider(googleKey) : new UnavailableTrafficProvider(),
    autocomplete: new PhotonAutocompleteProvider(),
  };
}

let cached: MapsStack | null = null;

export function getMapsStack(): MapsStack {
  if (!cached) cached = createMapsStack();
  return cached;
}
