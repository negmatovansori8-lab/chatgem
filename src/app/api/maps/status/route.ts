import { NextResponse } from "next/server";
import { getMapsStack } from "@/providers/maps";

export const runtime = "nodejs";

/** Public, key-free config for the client map (no secrets are ever exposed here). */
export async function GET() {
  const stack = getMapsStack();
  return NextResponse.json(
    {
      ok: true,
      tiles: stack.map.tiles(),
      dark: stack.map.darkTiles(),
      satellite: stack.map.satelliteTiles(),
      transitAvailable: stack.transit.available,
      trafficAvailable: stack.traffic.available,
      providers: {
        map: stack.map.id,
        search: stack.search.id,
        autocomplete: stack.autocomplete.id,
        nearby: stack.nearby.id,
        routing: stack.routing.id,
        transit: stack.transit.id,
        traffic: stack.traffic.id,
      },
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
