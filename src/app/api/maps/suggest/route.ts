import { NextResponse } from "next/server";
import { getMapsStack } from "@/providers/maps";
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

/** Type-ahead suggestions for the map search bar (real places only). */
export async function POST(req: Request) {
  if (rateLimited(req)) return mapsError("rate_limit");

  const body = await readJson(req);
  const q = typeof body.q === "string" ? body.q.trim().slice(0, 120) : "";
  if (q.length < 2) return NextResponse.json({ places: [] });

  try {
    const places = await getMapsStack().autocomplete.suggest(q, {
      near: parseLatLng(body.near),
      locale: parseLocale(body.locale),
      limit: 6,
    });
    return NextResponse.json({ places });
  } catch (e) {
    const code = toMapsError(e).code;
    // Type-ahead is optional (Enter still runs the full search): a slow/down provider
    // yields no suggestions rather than an error.
    if (code === "timeout" || code === "network" || code === "api_error") {
      return NextResponse.json({ places: [], degraded: true });
    }
    return mapsErrorResponse(e);
  }
}
