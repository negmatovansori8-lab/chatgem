import { CATEGORY_TAGS, type MapCategoryKey } from "@/lib/maps/intent";
import { categoryLabel, isCategoryKey } from "@/lib/maps/labels";
import { haversineMeters } from "@/lib/maps/geo";
import { TtlCache, coordKey } from "@/providers/maps/cache";
import { MapsError, fetchJson, toMapsError } from "@/providers/maps/errors";
import { detailsFromTags } from "@/providers/maps/osm-tags";
import type { LatLng, MapPlace, NearbyProvider, NearbyQuery } from "@/providers/maps/types";

const ENDPOINTS = (
  process.env.OVERPASS_URLS?.trim() ||
  "https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter,https://overpass.kumi.systems/api/interpreter"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Public Overpass mirrors are often overloaded: start the next one if the previous is slow. */
const HEDGE_DELAY_MS = 3_000;

type OverpassResponse = { elements?: OverpassElement[] };

function queryOverpass(ql: string): Promise<OverpassResponse> {
  const winner = new AbortController();
  const body = `data=${encodeURIComponent(ql)}`;

  return new Promise((resolve, reject) => {
    let pending = ENDPOINTS.length;
    let lastError = new MapsError("api_error");
    const timers: ReturnType<typeof setTimeout>[] = [];
    const startNow: Array<() => void> = [];

    const finish = () => {
      if (--pending === 0 && !winner.signal.aborted) reject(lastError);
    };

    ENDPOINTS.forEach((endpoint, i) => {
      let started = false;
      const start = async () => {
        if (started) return;
        started = true;
        clearTimeout(timers[i]);
        if (winner.signal.aborted) return finish();
        try {
          const json = await fetchJson<OverpassResponse>(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": "ChatGem/1.0 (maps-module)",
            },
            body,
            timeoutMs: 18_000,
            // The other mirrors are the retry.
            retries: 0,
            signal: winner.signal,
          });
          if (!winner.signal.aborted) {
            winner.abort();
            timers.forEach(clearTimeout);
            resolve(json);
          }
        } catch (e) {
          if (!winner.signal.aborted) lastError = toMapsError(e);
          // A fast failure should not wait for the hedge delay.
          startNow[i + 1]?.();
        } finally {
          finish();
        }
      };
      startNow[i] = () => void start();
      timers[i] = setTimeout(startNow[i]!, i * HEDGE_DELAY_MS);
    });
  });
}

const cache = new TtlCache<MapPlace[]>(300, 5 * 60_000);

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function pickName(tags: Record<string, string>, category: MapCategoryKey, locale: string): string {
  const lang = locale.split("-")[0]?.toLowerCase() ?? "tg";
  const order =
    lang === "tg"
      ? ["name:tg", "name", "name:ru", "name:en"]
      : lang === "ru"
        ? ["name:ru", "name", "name:tg", "name:en"]
        : ["name:en", "name", "name:ru", "name:tg"];
  for (const k of order) if (tags[k]) return tags[k];
  return tags.brand || tags.operator || categoryLabel(category, locale);
}

const POI_AMENITY: Record<string, MapCategoryKey> = {
  restaurant: "restaurant",
  fast_food: "restaurant",
  cafe: "cafe",
  pharmacy: "pharmacy",
  bank: "bank",
  atm: "atm",
  fuel: "fuel",
  hospital: "hospital",
  clinic: "hospital",
  marketplace: "marketplace",
};
const POI_SHOP: Record<string, MapCategoryKey> = {
  supermarket: "supermarket",
  convenience: "supermarket",
  mall: "shop",
  department_store: "shop",
};
const POI_TOURISM: Record<string, MapCategoryKey> = {
  hotel: "hotel",
  attraction: "attraction",
  museum: "attraction",
};

/** The concrete category of a "what is nearby" (poi) result, from its OSM tags. */
function poiCategory(tags: Record<string, string>): MapCategoryKey {
  return (
    POI_AMENITY[tags.amenity ?? ""] ?? POI_SHOP[tags.shop ?? ""] ?? POI_TOURISM[tags.tourism ?? ""] ?? "poi"
  );
}

function elementToPlace(
  el: OverpassElement,
  near: LatLng,
  queried: MapCategoryKey,
  locale: string,
): MapPlace | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;
  const location = { lat, lng: lon };
  const tags = el.tags ?? {};
  const category = queried === "poi" ? poiCategory(tags) : queried;
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  const address = [street, tags["addr:city"] || tags["addr:town"] || tags["addr:village"]]
    .filter(Boolean)
    .join(", ");
  return {
    id: `overpass:${el.type}/${el.id}`,
    name: pickName(tags, category, locale),
    address,
    location,
    category,
    distanceMeters: haversineMeters(near, location),
    details: detailsFromTags(tags),
    source: "overpass",
  };
}

export class OverpassNearbyProvider implements NearbyProvider {
  readonly id = "overpass";

  async nearby(query: NearbyQuery): Promise<MapPlace[]> {
    if (!isCategoryKey(query.category)) throw new MapsError("bad_request", "unknown_category");
    const category = query.category;
    const selectors = CATEGORY_TAGS[category].overpass;
    const radius = Math.min(Math.max(query.radiusMeters ?? 2000, 300), 200_000);
    const limit = query.limit ?? 20;
    const locale = query.locale || "tg";
    const { lat, lng } = query.near;
    const key = `${category}|${radius}|${coordKey(query.near, 3)}|${locale}`;

    return cache.getOrLoad(key, async () => {
      const around = `(around:${radius},${lat.toFixed(6)},${lng.toFixed(6)})`;
      const body = selectors.map((s) => `nwr${s}${around};`).join("\n");
      // Fetch extra candidates so sorting by distance picks the truly closest.
      const ql = `[out:json][timeout:14];\n(\n${body}\n);\nout center tags 120;`;

      const json = await queryOverpass(ql);
      const seen = new Set<string>();
      return (json.elements ?? [])
        .map((el) => elementToPlace(el, query.near, category, locale))
        .filter((p): p is MapPlace => {
          if (!p) return false;
          // de-dupe node+building duplicates of the same POI
          const k = `${p.name}|${p.location.lat.toFixed(4)},${p.location.lng.toFixed(4)}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
        .slice(0, limit);
    });
  }
}
