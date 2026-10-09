import { NextResponse } from "next/server";
import { voiceStatus } from "@/services/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which voice capabilities the server can offer — never exposes keys. */
export async function GET() {
  return NextResponse.json(voiceStatus(), { headers: { "Cache-Control": "no-store" } });
}
