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

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (rateLimited(req)) return mapsError("rate_limit");
  const body = await readJson(req);
  const point = parseLatLng(body);
  if (!point) return mapsError("bad_request");
  try {
    const place = await getMapsStack().geocoding.reverse(point, parseLocale(body.locale));
    if (!place) return mapsError("place_not_found");
    return NextResponse.json({ place });
  } catch (e) {
    return mapsErrorResponse(e);
  }
}
