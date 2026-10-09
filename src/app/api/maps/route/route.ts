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
import { TRAVEL_MODES, type RouteLeg, type TravelMode } from "@/providers/maps/types";

export const runtime = "nodejs";

/** Real route for ONE travel mode (the client requests other modes lazily). */
export async function POST(req: Request) {
  if (rateLimited(req)) return mapsError("rate_limit");

  const body = await readJson(req);
  const from = parseLatLng(body.from);
  const to = parseLatLng(body.to);
  const mode = TRAVEL_MODES.includes(body.mode as TravelMode) ? (body.mode as TravelMode) : "walking";
  if (!from || !to) return mapsError("bad_request");

  const stack = getMapsStack();
  const locale = parseLocale(body.locale);
  try {
    let route: RouteLeg;
    if (mode === "transit") {
      route = await stack.transit.route({ from, to, mode, locale });
    } else if (mode === "driving" && stack.traffic.available) {
      // Traffic is optional: a failing traffic source must not break the route.
      const [leg, traffic] = await Promise.all([
        stack.routing.route({ from, to, mode, locale }),
        stack.traffic.driving({ from, to, locale }).catch(() => null),
      ]);
      route = leg.available && traffic ? { ...leg, traffic } : leg;
    } else {
      route = await stack.routing.route({ from, to, mode, locale });
    }
    return NextResponse.json({ route, transitAvailable: stack.transit.available });
  } catch (e) {
    return mapsErrorResponse(e);
  }
}
