import { NextResponse } from "next/server";
import { getMapsStack } from "@/providers/maps";
import { mapsError, parseLatLng, rateLimited, readJson } from "@/lib/maps/api-helpers";
import { toMapsError } from "@/providers/maps/errors";
import type { LatLng, RouteMetrics } from "@/providers/maps/types";

export const runtime = "nodejs";

const MAX_TARGETS = 24;
type MatrixMode = "walking" | "driving";

/**
 * Real network distance + duration from the user to many places at once
 * (walking and driving). Entries are null where no route exists.
 */
export async function POST(req: Request) {
  if (rateLimited(req)) return mapsError("rate_limit");

  const body = await readJson(req);
  const from = parseLatLng(body.from);
  const to = (Array.isArray(body.to) ? body.to : [])
    .slice(0, MAX_TARGETS)
    .map(parseLatLng)
    .filter((p): p is LatLng => Boolean(p));
  const modes = (Array.isArray(body.modes) ? body.modes : ["walking", "driving"]).filter(
    (m): m is MatrixMode => m === "walking" || m === "driving",
  );
  if (!from || !to.length || !modes.length) return mapsError("bad_request");

  const stack = getMapsStack();
  const result: Partial<Record<MatrixMode, (RouteMetrics | null)[]>> = {};
  const errors: Partial<Record<MatrixMode, string>> = {};

  await Promise.all(
    modes.map(async (mode) => {
      try {
        result[mode] = await stack.routing.matrix({ from, to, mode });
      } catch (e) {
        errors[mode] = toMapsError(e).code;
      }
    }),
  );

  if (!Object.keys(result).length) {
    const code = Object.values(errors)[0] ?? "api_error";
    return NextResponse.json({ error: { code } }, { status: code === "rate_limit" ? 429 : 502 });
  }
  return NextResponse.json({ ...result, errors });
}
