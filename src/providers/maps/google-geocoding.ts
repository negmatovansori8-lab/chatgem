/**
 * Google Geocoding for tap-on-map addresses — opt-in via MAPS_REVERSE_GEOCODER=google
 * (uses GOOGLE_MAPS_SERVER_KEY, server-side only). Forward search and area lookups
 * stay on the base provider; if Google fails, reverse falls back to it as well.
 */
import { addressTitle } from "@/lib/maps/address";
import { haversineMeters } from "@/lib/maps/geo";
import { TtlCache, coordKey } from "@/providers/maps/cache";
import { MapsError, fetchJson } from "@/providers/maps/errors";
import type { AreaQuery, GeocodingProvider, LatLng, MapArea, MapPlace, PostalAddress } from "@/providers/maps/types";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

type Component = { long_name: string; short_name: string; types: string[] };
type GeocodeResult = {
  place_id: string;
  formatted_address: string;
  types: string[];
  address_components: Component[];
  geometry: { location: { lat: number; lng: number } };
};
type GeocodeResponse = { status: string; results?: GeocodeResult[] };

/** Google has no Tajik; Russian is what street signs in Tajikistan use besides Tajik. */
function language(locale: string): string {
  const l = locale.split("-")[0]?.toLowerCase();
  return !l || l === "tg" ? "ru" : l;
}

function postalOf(components: Component[]): PostalAddress | undefined {
  const find = (...types: string[]) => components.find((c) => types.some((t) => c.types.includes(t)));
  const country = find("country");
  const postal: PostalAddress = {
    road: find("route")?.long_name,
    houseNumber: find("street_number")?.long_name,
    neighbourhood: find("neighborhood", "sublocality_level_2")?.long_name,
    district: find("sublocality_level_1", "sublocality", "administrative_area_level_2")?.long_name,
    city: find("locality", "postal_town")?.long_name,
    state: find("administrative_area_level_1")?.long_name,
    postcode: find("postal_code")?.long_name,
    country: country?.long_name,
    countryCode: country?.short_name?.toLowerCase(),
  };
  const entries = Object.entries(postal).filter(([, v]) => v);
  return entries.length ? (Object.fromEntries(entries) as PostalAddress) : undefined;
}

export class GoogleReverseGeocoder implements GeocodingProvider {
  readonly id = "google-geocoding";
  private readonly cache = new TtlCache<MapPlace | null>(400, 10 * 60_000);

  constructor(
    private readonly apiKey: string,
    private readonly base: GeocodingProvider,
  ) {}

  geocode(text: string, opts?: { near?: LatLng; locale?: string }): Promise<MapPlace[]> {
    return this.base.geocode(text, opts);
  }

  resolveArea(query: AreaQuery): Promise<MapArea | null> {
    return this.base.resolveArea(query);
  }

  async reverse(location: LatLng, locale = "tg"): Promise<MapPlace | null> {
    const key = `${coordKey(location, 4)}|${locale}`;
    return this.cache.getOrLoad(key, async () => {
      try {
        return await this.fetchReverse(location, locale);
      } catch {
        return this.base.reverse(location, locale);
      }
    });
  }

  private async fetchReverse(location: LatLng, locale: string): Promise<MapPlace | null> {
    const params = new URLSearchParams({
      latlng: `${location.lat},${location.lng}`,
      language: language(locale),
      key: this.apiKey,
    });
    const data = await fetchJson<GeocodeResponse>(`${GEOCODE_URL}?${params}`, { timeoutMs: 10_000 });
    if (data.status === "ZERO_RESULTS") return null;
    if (data.status === "OVER_QUERY_LIMIT") throw new MapsError("rate_limit");
    if (data.status !== "OK") throw new MapsError("api_error", `google_${data.status}`);
    // The first result is often only a Plus Code — skip to a real address.
    const result = data.results?.find((r) => !r.types.every((t) => t === "plus_code"));
    if (!result) return null;
    const postal = postalOf(result.address_components);
    const point = { lat: result.geometry.location.lat, lng: result.geometry.location.lng };
    return {
      id: `google:${result.place_id}`,
      name: addressTitle(postal) || result.formatted_address.split(",")[0]!.trim(),
      address: result.formatted_address,
      location: point,
      category: result.types[0],
      distanceMeters: haversineMeters(location, point),
      locality: postal?.city ?? postal?.state,
      country: postal?.country,
      countryCode: postal?.countryCode,
      postal,
      source: "google",
    };
  }
}
