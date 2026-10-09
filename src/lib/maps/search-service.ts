/**
 * Server-side map search shared by /api/maps/search and the chat assistant.
 * Every place, address and coordinate comes from the search/POI providers.
 */
import {
  CATEGORY_TAGS,
  DEFAULT_RADII,
  type MapCategoryKey,
  type MapIntent,
  type MapScope,
} from "@/lib/maps/intent";
import { looksLikeAddress } from "@/lib/maps/address";
import { isOnlyKindWords, parseAreaName, sameName } from "@/lib/maps/area-query";
import { haversineMeters, inBBox } from "@/lib/maps/geo";
import { categoryLabel } from "@/lib/maps/labels";
import { localName, suggestedCities } from "@/lib/maps/places-world";
import { MapsError, toMapsError } from "@/providers/maps/errors";
import { isInTajikistan, type LatLng, type MapArea, type MapPlace, type MapsStack } from "@/providers/maps/types";

const MIN_RESULTS = 3;
/** Stop widening the radius after this long; the user is waiting. */
const NEARBY_BUDGET_MS = 25_000;

export type ClarifyCountry = {
  /** Country as the user named it. */
  country: string;
  category: MapCategoryKey;
  /** Suggested cities with a ready-to-run search text. */
  cities: { name: string; q: string }[];
};

export type MapSearchResult = {
  intent: MapIntent;
  places: MapPlace[];
  /** Resolved city/country the search was scoped to. */
  area?: MapArea;
  /** True when results are around `area`, not around the user. */
  scoped?: boolean;
  needsLocation?: boolean;
  clarify?: ClarifyCountry;
};

/** Widen the radius until enough real POIs are found (closest first). */
export async function nearbyExpanding(
  stack: MapsStack,
  category: MapCategoryKey,
  near: LatLng,
  locale: string,
): Promise<MapPlace[]> {
  const radii = CATEGORY_TAGS[category].radii ?? DEFAULT_RADII;
  const started = Date.now();
  let best: MapPlace[] = [];
  let failure: MapsError | null = null;

  for (const radiusMeters of radii) {
    if (Date.now() - started > NEARBY_BUDGET_MS) break;
    try {
      const places = await stack.nearby.nearby({ category, near, radiusMeters, locale, limit: 20 });
      if (places.length > best.length) best = places;
      if (places.length >= MIN_RESULTS) return places;
    } catch (e) {
      // A wider radius is a heavier query — if the POI database failed now, it will fail again.
      failure = toMapsError(e);
      break;
    }
  }
  if (best.length) return best;

  // POI database unreachable → geocoder search around the point as a fallback.
  try {
    const places = await stack.search.search({
      text: CATEGORY_TAGS[category].nominatim,
      near,
      locale,
      limit: 12,
    });
    const maxDistance = radii[radii.length - 1]!;
    return places
      .map((p) => ({ ...p, category, distanceMeters: haversineMeters(near, p.location) }))
      .filter((p) => p.distanceMeters <= maxDistance)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  } catch (e) {
    throw failure ?? toMapsError(e);
  }
}

function resolveScope(stack: MapsStack, scope: MapScope, locale: string): Promise<MapArea | null> {
  return stack.geocoding.resolveArea({
    query: scope.query,
    kind: scope.kind,
    countryCode: scope.countryCode,
    locale,
  });
}

function areaAsPlace(area: MapArea): MapPlace {
  return {
    id: `area:${area.kind}:${area.center.lat.toFixed(5)},${area.center.lng.toFixed(5)}`,
    name: area.name,
    address: area.displayName,
    location: area.center,
    category: area.type ?? area.kind,
    countryCode: area.countryCode,
    source: "nominatim",
  };
}

function notFound(): never {
  throw new MapsError("place_not_found");
}

function clarifyFor(scope: MapScope, category: MapCategoryKey, locale: string): ClarifyCountry {
  const label = categoryLabel(category, locale);
  return {
    country: scope.names ? localName(scope.names, scope.label, locale) : scope.label,
    category,
    cities: suggestedCities(scope.countryCode, locale).map((c) => ({ name: c.name, q: `${label} ${c.name}` })),
  };
}

/**
 * Runs a parsed map intent.
 * - Named city/country → search there (the user's location is only used to
 *   rank when they are actually inside that country).
 * - Country + "nearby" with the user elsewhere → asks which city.
 * Throws MapsError("place_not_found") when nothing real was found.
 */
export async function searchMaps(
  stack: MapsStack,
  intent: MapIntent,
  opts: { near?: LatLng | null; area?: LatLng | null; around?: LatLng | null; locale: string },
): Promise<MapSearchResult> {
  const { near, locale } = opts;
  const origin = near ?? opts.area ?? null;

  if (intent.type === "nearby" && opts.around && !intent.scope) {
    const places = await nearbyExpanding(stack, intent.category, opts.around, locale);
    if (!places.length) notFound();
    return { intent, places, scoped: true };
  }

  if (intent.type === "nearby") {
    if (intent.scope) {
      const area = await resolveScope(stack, intent.scope, locale);
      if (!area) {
        if (intent.scope.kind !== "auto") notFound();
      } else if (area.kind === "city") {
        const places = await nearbyExpanding(stack, intent.category, area.center, locale);
        if (!places.length) notFound();
        return { intent, places, area, scoped: true };
      } else if (near && inBBox(near, area.bbox)) {
        const places = await nearbyExpanding(stack, intent.category, near, locale);
        if (!places.length) notFound();
        return { intent, places, area };
      } else {
        return { intent, places: [], area, clarify: clarifyFor(intent.scope, intent.category, locale) };
      }
    }
    if (!origin) return { intent, places: [], needsLocation: true };
    const places = await nearbyExpanding(stack, intent.category, origin, locale);
    if (!places.length) notFound();
    return { intent, places, needsLocation: !near };
  }

  if (intent.type !== "search" && intent.type !== "route") throw new MapsError("bad_request");

  const text = (intent.type === "route" ? intent.destination : intent.query)?.trim() ?? "";

  // "кӯчаи Рӯдакӣ 25, Душанбе" — a street address geocodes best as one string, city included.
  if (text && looksLikeAddress(text)) {
    const full = intent.type === "search" ? intent.raw : [text, intent.scope?.label].filter(Boolean).join(", ");
    const places = await stack.geocoding.geocode(full, { near: origin ?? undefined, locale });
    if (places.length) return { intent, places, needsLocation: !near };
  }

  if (intent.scope) {
    const area = await resolveScope(stack, intent.scope, locale);
    if (area) {
      // "ноҳияи Рӯдакӣ", "город Худжанд" — the area itself.
      if (!text || isOnlyKindWords(text)) return { intent, places: [areaAsPlace(area)], area, scoped: true };
      const places = await stack.search.searchIn(text, area, { locale, limit: 12 });
      if (!places.length) notFound();
      return { intent, places, area, scoped: true };
    }
    if (intent.scope.kind !== "auto") notFound();
  }

  // Unresolved "дар X" word → it was part of the name after all.
  const query =
    intent.scope?.kind === "auto" ? `${intent.scope.label} ${text}`.trim() : text;
  if (!query) throw new MapsError("bad_request");

  const named = parseAreaName(query);
  const findArea = (): Promise<MapArea | null> =>
    named
      ? stack.geocoding.resolveArea({
          query: named.name,
          kind: "auto",
          locale,
          level: named.level,
          exactName: true,
          preferCountryCode: !origin || isInTajikistan(origin) ? "tj" : undefined,
        })
      : Promise.resolve(null);
  const asArea = (area: MapArea): MapSearchResult => ({ intent, places: [areaAsPlace(area)], area, scoped: true });

  // "вилояти Суғд", "Хатлонская область", "ВМКБ" name an area outright.
  if (named?.explicit) {
    const area = await findArea();
    if (area) return asArea(area);
  }

  const places = await stack.search.search({ text: query, near: origin ?? undefined, locale, limit: 12 });
  const top = places[0];
  const exactPoi = Boolean(top && !AREA_CATEGORIES.has(top.category ?? "") && sameName(top.name, query));
  if (named && !named.explicit && !exactPoi) {
    // "Бадахшон" → the region, not the café "Шоми Бадахшон" nearby.
    const area = await findArea();
    if (area && (!places.length || !SMALL_AREA_TYPES.has(area.type ?? ""))) return asArea(area);
  }
  if (!places.length) notFound();
  return { intent, places, needsLocation: !near };
}

/** Provider categories of places that are areas, not points of interest. */
const AREA_CATEGORIES = new Set([
  "administrative",
  "country",
  "state",
  "region",
  "province",
  "county",
  "district",
  "city_district",
  "municipality",
  "city",
  "town",
  "village",
  "hamlet",
  "suburb",
  "island",
]);

/** A village named like a shop should not hide the shop. */
const SMALL_AREA_TYPES = new Set(["village", "hamlet", "suburb"]);
