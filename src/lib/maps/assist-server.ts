/**
 * Server-only step of the AI ↔ Map bridge: turns a scoped search/route intent
 * ("Дар Англия Big Ben-ро ёб") into the REAL place found by the search provider,
 * and an A→B question ("Аз Душанбе то Хуҷанд") into a real routed distance.
 */
import { foundPlaceReply, notFoundReply, pointToPointReply, type MapAssist } from "@/lib/maps/assist";
import type { MapEndpoint, MapIntent } from "@/lib/maps/intent";
import { searchMaps } from "@/lib/maps/search-service";
import { getMapsStack } from "@/providers/maps";
import { MapsError, toMapsError } from "@/providers/maps/errors";
import type { LatLng, MapPlace, MapsStack } from "@/providers/maps/types";

const RESOLVE_TIMEOUT_MS = 20_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new MapsError("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function resolveEndpoint(
  stack: MapsStack,
  endpoint: MapEndpoint,
  locale: string,
  near?: LatLng,
): Promise<MapPlace | null> {
  try {
    const result = await searchMaps(
      stack,
      { type: "search", query: endpoint.query, raw: endpoint.raw, scope: endpoint.scope },
      { locale, near: near ?? null },
    );
    return result.places[0] ?? null;
  } catch (e) {
    if (toMapsError(e).code === "place_not_found") return null;
    throw e;
  }
}

async function resolvePointToPoint(
  intent: Extract<MapIntent, { type: "route" }> & { origin: MapEndpoint },
  locale: string,
  tzOffsetMinutes?: number,
): Promise<MapAssist> {
  const stack = getMapsStack();
  const from = await resolveEndpoint(stack, intent.origin, locale);
  if (!from) return notFoundReply({ type: "search", query: intent.origin.query || intent.origin.raw, raw: intent.raw, scope: intent.origin.scope }, locale);
  // The destination is ranked around the origin ("Аз Душанбе то фурудгоҳ").
  const to = await resolveEndpoint(
    stack,
    { query: intent.destination ?? "", raw: intent.raw, scope: intent.scope },
    locale,
    from.location,
  );
  if (!to) return notFoundReply(intent, locale);
  const leg = await stack.routing.route({ from: from.location, to: to.location, mode: intent.mode ?? "driving", locale });
  return pointToPointReply({ from, to, leg, intent, locale, tzOffsetMinutes });
}

export async function resolveMapAssist(
  assist: MapAssist,
  locale: string,
  opts?: { tzOffsetMinutes?: number },
): Promise<MapAssist> {
  const intent = assist.intent;
  if (!intent || (intent.type !== "search" && intent.type !== "route")) return assist;
  try {
    if (intent.type === "route" && intent.origin) {
      return await withTimeout(
        resolvePointToPoint({ ...intent, origin: intent.origin }, locale, opts?.tzOffsetMinutes),
        RESOLVE_TIMEOUT_MS,
      );
    }
    if (!intent.scope) return assist;
    const result = await withTimeout(searchMaps(getMapsStack(), intent, { locale }), RESOLVE_TIMEOUT_MS);
    const top = result.places[0];
    return top ? foundPlaceReply(top, intent, locale) : notFoundReply(intent, locale);
  } catch (e) {
    // Provider down/slow: keep the generic reply; the map page retries the search.
    return toMapsError(e).code === "place_not_found" ? notFoundReply(intent, locale) : assist;
  }
}
