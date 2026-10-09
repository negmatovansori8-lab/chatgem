import { addressTitle, addressVariants, houseNumberOf, looksLikeAddress } from "@/lib/maps/address";
import { areaNameMatches } from "@/lib/maps/area-query";
import { haversineMeters } from "@/lib/maps/geo";
import { localizePlaceName, nominatimAcceptLanguage } from "@/lib/maps/labels";
import { hasCyrillic, transliterate } from "@/lib/maps/translit";
import { TtlCache, coordKey } from "@/providers/maps/cache";
import { fetchJson } from "@/providers/maps/errors";
import { detailsFromTags } from "@/providers/maps/osm-tags";
import {
  TAJIKISTAN_BBOX,
  type AreaQuery,
  type GeocodingProvider,
  type LatLng,
  type MapArea,
  type MapPlace,
  type PostalAddress,
  type SearchProvider,
  type SearchQuery,
} from "@/providers/maps/types";

const BASE = (
  process.env.NOMINATIM_BASE_URL?.trim() || "https://nominatim.openstreetmap.org"
).replace(/\/+$/, "");
const CONTACT = process.env.NOMINATIM_CONTACT_EMAIL?.trim();
const UA = `ChatGem/1.0 (maps-module${CONTACT ? `; ${CONTACT}` : ""})`;

type NominatimAddress = Partial<
  Record<
    | "house_number"
    | "road"
    | "pedestrian"
    | "footway"
    | "path"
    | "cycleway"
    | "square"
    | "neighbourhood"
    | "quarter"
    | "suburb"
    | "residential"
    | "city_district"
    | "district"
    | "borough"
    | "city"
    | "town"
    | "village"
    | "hamlet"
    | "municipality"
    | "county"
    | "state"
    | "region"
    | "postcode"
    | "country"
    | "country_code",
    string
  >
>;

type NominatimItem = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  type?: string;
  class?: string;
  category?: string;
  addresstype?: string;
  importance?: number;
  boundingbox?: [string, string, string, string];
  address?: NominatimAddress;
  extratags?: Record<string, string> | null;
};

const searchCache = new TtlCache<MapPlace[]>(400, 10 * 60_000);
const reverseCache = new TtlCache<MapPlace | null>(400, 10 * 60_000);
const areaCache = new TtlCache<MapArea | null>(300, 24 * 60 * 60_000);

/** Nominatim usage policy: max 1 request/second per application. */
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Streets named "Pharmacy Ave" etc. are not places of interest. */
function isStreetNoise(item: NominatimItem): boolean {
  const cls = (item.class || item.category || "").toLowerCase();
  const typ = (item.type || "").toLowerCase();
  if (cls === "highway" || cls === "railway" || cls === "route") return true;
  return ["residential", "primary", "secondary", "tertiary", "trunk", "motorway", "unclassified"].includes(typ);
}

const AREA_TYPES = new Set([
  "country",
  "state",
  "region",
  "province",
  "county",
  "city",
  "town",
  "village",
  "municipality",
  "city_district",
  "district",
  "borough",
  "suburb",
  "island",
  "hamlet",
]);

const LEVEL_TYPES: Record<NonNullable<AreaQuery["level"]>, Set<string>> = {
  state: new Set(["state", "region", "province"]),
  district: new Set(["county", "district", "city_district", "municipality", "borough"]),
  settlement: new Set(["city", "town", "village", "hamlet", "suburb"]),
};

function areaType(item: NominatimItem): string {
  return (item.addresstype || item.type || "").toLowerCase();
}

/**
 * Picks the area the user most likely meant: the typed name, the typed level,
 * the user's own country, then Nominatim importance
 * ("Бадахшон" in Tajikistan → the region, not a village or the Afghan province).
 */
function bestArea(items: NominatimItem[], q: string, query: AreaQuery): NominatimItem | undefined {
  let best: { item: NominatimItem; score: number } | undefined;
  for (const item of items) {
    const name = item.name || item.display_name.split(",")[0]!.trim();
    if (query.exactName && !areaNameMatches(q, name)) continue;
    const type = areaType(item);
    let score = item.importance ?? 0;
    if (query.level && LEVEL_TYPES[query.level].has(type)) score += 0.4;
    if (query.preferCountryCode && item.address?.country_code?.toLowerCase() === query.preferCountryCode) score += 0.3;
    // Larger units first when nothing else decides.
    if (type === "country" || LEVEL_TYPES.state.has(type)) score += 0.1;
    else if (type === "hamlet" || type === "suburb") score -= 0.1;
    if (!best || score > best.score) best = { item, score };
  }
  return best?.item;
}

function localityOf(a: NominatimAddress | undefined): string | undefined {
  return a?.city || a?.town || a?.village || a?.municipality || a?.county || a?.state;
}

function postalOf(a: NominatimAddress | undefined): PostalAddress | undefined {
  if (!a) return undefined;
  const postal: PostalAddress = {
    road: a.road || a.pedestrian || a.footway || a.path || a.cycleway || a.square,
    houseNumber: a.house_number,
    neighbourhood: a.neighbourhood || a.quarter || a.suburb || a.residential,
    district: a.city_district || a.district || a.borough || a.county,
    city: a.city || a.town || a.village || a.hamlet || a.municipality,
    state: a.state || a.region,
    postcode: a.postcode,
    country: a.country,
    countryCode: a.country_code?.toLowerCase(),
  };
  const entries = Object.entries(postal).filter(([, v]) => typeof v === "string" && v.trim());
  return entries.length ? (Object.fromEntries(entries) as PostalAddress) : undefined;
}

function toPlace(item: NominatimItem, near: LatLng | undefined, locale: string): MapPlace {
  const location = { lat: Number(item.lat), lng: Number(item.lon) };
  const postal = postalOf(item.address);
  const ownName = item.name?.trim();
  const parts = item.display_name.split(",").map((s) => s.trim());
  // Unnamed buildings would otherwise be called "25": use "street, house" instead.
  const rawName = ownName || addressTitle(postal) || parts[0] || "";
  // The display name starts with the place's own name — keep only the address part.
  const address = ownName && parts[0] === ownName && parts.length > 1 ? parts.slice(1).join(", ") : item.display_name;
  return {
    id: `nominatim:${item.place_id}`,
    name: localizePlaceName(rawName, locale, item.type || item.class),
    address,
    location,
    category: item.type || item.class,
    distanceMeters: near ? haversineMeters(near, location) : undefined,
    locality: localityOf(item.address),
    country: item.address?.country,
    countryCode: item.address?.country_code?.toLowerCase(),
    details: detailsFromTags(item.extratags ?? undefined),
    postal,
    source: "nominatim",
  };
}

function viewbox(near: LatLng, deltaDeg: number): string {
  // west,north,east,south
  return [near.lng - deltaDeg, near.lat + deltaDeg, near.lng + deltaDeg, near.lat - deltaDeg].join(",");
}

const TJ_VIEWBOX = [
  TAJIKISTAN_BBOX.west,
  TAJIKISTAN_BBOX.north,
  TAJIKISTAN_BBOX.east,
  TAJIKISTAN_BBOX.south,
].join(",");

function byImportance(items: { place: MapPlace; importance: number }[]): MapPlace[] {
  return items.sort((a, b) => b.importance - a.importance).map((x) => x.place);
}

export class NominatimSearchProvider implements SearchProvider, GeocodingProvider {
  readonly id = "nominatim";

  async search(query: SearchQuery): Promise<MapPlace[]> {
    const places = await this.geocode(query.text, { near: query.near, locale: query.locale });
    return places.slice(0, query.limit ?? 12);
  }

  private async fetchItems(q: string, locale: string, extra: Record<string, string>): Promise<NominatimItem[]> {
    const params = new URLSearchParams({
      q,
      format: "jsonv2",
      addressdetails: "1",
      extratags: "1",
      limit: "12",
      "accept-language": nominatimAcceptLanguage(locale),
      ...extra,
    });
    if (CONTACT) params.set("email", CONTACT);
    const items = await throttled(() =>
      fetchJson<NominatimItem[]>(`${BASE}/search?${params}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        timeoutMs: 12_000,
      }),
    );
    return Array.isArray(items) ? items : [];
  }

  /** POIs ranked by Nominatim importance (Big Ben the tower before a "Big Ben" pub). */
  private async fetchPlaces(
    q: string,
    locale: string,
    extra: Record<string, string>,
    near?: LatLng,
  ): Promise<MapPlace[]> {
    const items = await this.fetchItems(q, locale, extra);
    // A street address may resolve to the street itself when the house isn't mapped.
    const address = looksLikeAddress(q);
    const ranked = byImportance(
      items
        .filter((i) => address || !isStreetNoise(i))
        .map((i) => ({ place: toPlace(i, near, locale), importance: i.importance ?? 0 })),
    );
    const house = address ? houseNumberOf(q) : undefined;
    if (!house) return ranked;
    const exact = (p: MapPlace) => p.postal?.houseNumber?.replace(/\s/g, "").toLowerCase() === house;
    return [...ranked.filter(exact), ...ranked.filter((p) => !exact(p))];
  }

  /**
   * Query variants: as typed, then Latin transliteration ("Биг Бен" → "Big Ben");
   * street addresses: without street words and in Russian spelling ("кӯчаи Рӯдакӣ 25" → "Рудаки 25").
   */
  private variants(q: string): string[] {
    if (looksLikeAddress(q)) return addressVariants(q);
    if (!hasCyrillic(q)) return [q];
    const latin = transliterate(q);
    return latin !== q ? [q, latin] : [q];
  }

  /**
   * Street address: near the user first, then worldwide (the text usually names the city).
   * With a house number, every spelling is tried before settling for the bare street —
   * OSM often has "проспект Рудаки 25" only under its Russian spelling.
   */
  private async geocodeAddress(q: string, locale: string, near?: LatLng): Promise<MapPlace[]> {
    const tiers: Record<string, string>[] = near ? [{ viewbox: viewbox(near, 1.4), bounded: "1" }, {}] : [{}];
    const house = houseNumberOf(q);
    const hasHouse = (p: MapPlace | undefined) => p?.postal?.houseNumber?.replace(/\s/g, "").toLowerCase() === house;
    for (const extra of tiers) {
      let fallback: MapPlace[] = [];
      for (const variant of this.variants(q)) {
        const places = await this.fetchPlaces(variant, locale, extra, near);
        if (!places.length) continue;
        if (!house || hasHouse(places[0])) return places;
        if (!fallback.length) fallback = places;
      }
      if (fallback.length) return fallback;
    }
    return [];
  }

  /**
   * Tiered search: near the user (~15 km) → region (~150 km) →
   * all of Tajikistan → worldwide. Stops at the first tier with results.
   * Local tiers are ordered by distance, wide tiers by importance.
   */
  async geocode(text: string, opts?: { near?: LatLng; locale?: string }): Promise<MapPlace[]> {
    const q = text.trim().slice(0, 200);
    if (!q) return [];
    const locale = opts?.locale || "tg";
    const near = opts?.near;
    const key = `${q.toLowerCase()}|${locale}|${near ? coordKey(near, 2) : "-"}`;

    return searchCache.getOrLoad(key, async () => {
      if (looksLikeAddress(q)) return this.geocodeAddress(q, locale, near);
      const tiers: { extra: Record<string, string>; local: boolean }[] = [];
      if (near) {
        tiers.push({ extra: { viewbox: viewbox(near, 0.15), bounded: "1" }, local: true });
        tiers.push({ extra: { viewbox: viewbox(near, 1.4), bounded: "1" }, local: true });
      }
      tiers.push({ extra: { viewbox: TJ_VIEWBOX, bounded: "1", countrycodes: "tj" }, local: false });
      tiers.push({ extra: {}, local: false });

      for (const tier of tiers) {
        const places = await this.fetchPlaces(q, locale, tier.extra, near);
        if (places.length) {
          if (near && tier.local) places.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
          return places;
        }
      }
      // Cyrillic spelling of a foreign name: one more worldwide try in Latin.
      const [, latin] = this.variants(q);
      return latin ? this.fetchPlaces(latin, locale, {}, near) : [];
    });
  }

  async searchIn(text: string, area: MapArea, opts?: { locale?: string; limit?: number }): Promise<MapPlace[]> {
    const q = text.trim().slice(0, 200);
    if (!q) return [];
    const locale = opts?.locale || "tg";
    const key = `in|${q.toLowerCase()}|${area.kind}|${coordKey(area.center, 2)}|${locale}`;

    const places = await searchCache.getOrLoad(key, async () => {
      const { south, north, west, east } = area.bbox;
      const inside: Record<string, string> =
        area.kind === "city"
          ? { viewbox: [west, north, east, south].join(","), bounded: "1" }
          : area.countryCode
            ? { countrycodes: area.countryCode }
            : { viewbox: [west, north, east, south].join(","), bounded: "1" };

      for (const variant of this.variants(q)) {
        const found = await this.fetchPlaces(variant, locale, inside, area.center);
        if (found.length) return found;
      }
      if (area.kind === "city") {
        // Places just outside the city boundary ("Heathrow, London").
        const country: Record<string, string> = area.countryCode ? { countrycodes: area.countryCode } : {};
        for (const variant of this.variants(q)) {
          const found = await this.fetchPlaces(`${variant}, ${area.name}`, locale, country, area.center);
          if (found.length) return found;
        }
      }
      return [];
    });
    return places.slice(0, opts?.limit ?? 12);
  }

  async resolveArea(query: AreaQuery): Promise<MapArea | null> {
    const q = query.query.trim().slice(0, 120);
    if (!q) return null;
    const locale = query.locale || "tg";
    const key = [
      q.toLowerCase(),
      query.kind,
      query.countryCode ?? "-",
      locale,
      query.preferCountryCode ?? "-",
      query.level ?? "-",
      query.exactName ? "x" : "-",
    ].join("|");

    return areaCache.getOrLoad(key, async () => {
      const extra: Record<string, string> = {};
      if (query.kind === "country") extra.featureType = "country";
      if (query.kind === "city") extra.featureType = "settlement";
      if (query.countryCode && query.kind !== "country") extra.countrycodes = query.countryCode;

      let items = await this.fetchItems(q, locale, { ...extra, limit: query.kind === "auto" ? "10" : "5" });
      if (!items.length && query.kind === "city") {
        // Some capitals/districts are not tagged as settlements.
        const fallback: Record<string, string> = { limit: "5" };
        if (query.countryCode) fallback.countrycodes = query.countryCode;
        items = await this.fetchItems(q, locale, fallback);
      }
      const areas = items.filter((i) => AREA_TYPES.has(areaType(i)) && i.boundingbox);
      const item =
        query.kind === "auto" && (query.preferCountryCode || query.level || query.exactName)
          ? bestArea(areas, q, query)
          : areas[0];
      if (!item?.boundingbox) return null;

      const [s, n, w, e] = item.boundingbox.map(Number) as [number, number, number, number];
      const isCountry = (item.addresstype || "").toLowerCase() === "country" || query.kind === "country";
      return {
        kind: isCountry ? "country" : "city",
        name: item.name || item.display_name.split(",")[0]!.trim(),
        displayName: item.display_name,
        center: { lat: Number(item.lat), lng: Number(item.lon) },
        bbox: { south: s, north: n, west: w, east: e },
        countryCode: item.address?.country_code?.toLowerCase() ?? query.countryCode,
        type: areaType(item),
      };
    });
  }

  async reverse(location: LatLng, locale = "tg"): Promise<MapPlace | null> {
    const key = `${coordKey(location, 4)}|${locale}`;
    return reverseCache.getOrLoad(key, async () => {
      const params = new URLSearchParams({
        lat: String(location.lat),
        lon: String(location.lng),
        format: "jsonv2",
        zoom: "18",
        addressdetails: "1",
        "accept-language": nominatimAcceptLanguage(locale),
      });
      const data = await throttled(() =>
        fetchJson<NominatimItem & { error?: string }>(`${BASE}/reverse?${params}`, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          timeoutMs: 12_000,
        }),
      );
      if (data.error || !data.lat) return null;
      return { ...toPlace(data, location, locale), address: data.display_name };
    });
  }
}
