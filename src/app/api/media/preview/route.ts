import { NextResponse } from "next/server";
import { canUseProMusic } from "@/server/music-access";
import { createRateLimiter } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limited = createRateLimiter(40);

/** Apple serves 30s previews as audio/x-m4p, which browsers refuse. Same file, audio/mp4. */
const HOSTS = new Set(["audio-ssl.itunes.apple.com", "audio.itunes.apple.com"]);

export async function GET(request: Request) {
  if (limited(request, "media-preview")) {
    return NextResponse.json({ error: { code: "rate_limit" } }, { status: 429 });
  }
  if (!(await canUseProMusic())) {
    return NextResponse.json({ error: { code: "PRO_REQUIRED" } }, { status: 403 });
  }
  const raw = new URL(request.url).searchParams.get("url") ?? "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: { code: "bad_request" } }, { status: 400 });
  }
  if (target.protocol !== "https:" || !HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: { code: "bad_request" } }, { status: 400 });
  }

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  let upstream: Response;
  try {
    upstream = await fetch(target, { headers, signal: AbortSignal.timeout(20_000) });
  } catch {
    return NextResponse.json({ error: { code: "unavailable" } }, { status: 502 });
  }
  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: { code: "unavailable" } }, { status: 502 });
  }

  const out = new Headers();
  out.set("Content-Type", "audio/mp4");
  out.set("Cache-Control", "private, max-age=300");
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
