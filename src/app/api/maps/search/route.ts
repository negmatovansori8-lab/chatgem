import { NextResponse } from "next/server";
import { getMapsStack } from "@/providers/maps";
import { detectMapIntent, type MapIntent } from "@/lib/maps/intent";
import { isCategoryKey } from "@/lib/maps/labels";
import { searchMaps } from "@/lib/maps/search-service";
import {
  mapsError,
  mapsErrorResponse,
  parseLatLng,
  parseLocale,
  rateLimited,
  readJson,
} from "@/lib/maps/api-helpers";
import { toMapsError } from "@/providers/maps/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (rateLimited(req)) return mapsError("rate_limit");

  const body = await readJson(req);
  const text = typeof body.q === "string" ? body.q.trim().slice(0, 240) : "";
  const near = parseLatLng(body.near);
  /** Map area chosen without GPS (e.g. a city chip) — biases search, never shown as "you". */
  const area = parseLatLng(body.area);
  /** "Near there" — search around a chosen destination instead of the user. */
  const around = parseLatLng(body.around);
  const locale = parseLocale(body.locale);

  let intent: MapIntent;
  if (isCategoryKey(body.category)) {
    intent = { type: "nearby", category: body.category, raw: text || body.category };
  } else if (text) {
    intent = detectMapIntent(text);
    if (intent.type === "none" || intent.type === "locate") {
      intent = { type: "search", query: text, raw: text };
    }
    if (intent.type === "route" && !intent.destination && !intent.scope) return mapsError("bad_request");
  } else {
    return mapsError("bad_request");
  }

  try {
    return NextResponse.json(await searchMaps(getMapsStack(), intent, { near, area, around, locale }));
  } catch (e) {
    // "Nothing real matched" is a normal answer, not a failure: empty list, no fabricated result.
    if (toMapsError(e).code === "place_not_found") {
      return NextResponse.json({ intent, places: [], notFound: true });
    }
    return mapsErrorResponse(e);
  }
}
