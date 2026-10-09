import { NextResponse } from "next/server";
import { detectMediaIntent } from "@/lib/media/intent";
import type { MediaSearchKind } from "@/lib/media/types";
import { mediaProviderStatus, searchMedia } from "@/services/media/search";
import { canUseProMusic } from "@/server/music-access";
import { createRateLimiter } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limited = createRateLimiter(30);

function fail(code: "bad_request" | "rate_limit" | "unavailable", status: number) {
  return NextResponse.json({ error: { code } }, { status, headers: { "Cache-Control": "no-store" } });
}

/** `GET /api/media/search` — which legal providers this server has enabled. */
export function GET() {
  return NextResponse.json({ providers: mediaProviderStatus() }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * `POST /api/media/search` `{ q, kind?, locale? }` — normalized, ranked results from
 * legal providers. `q` may be a plain title or a chat phrase («Shape of You-ро ёб»).
 */
export async function POST(request: Request) {
  if (limited(request, "media-search")) return fail("rate_limit", 429);
  let body: Record<string, unknown> = {};
  try {
    body = ((await request.json()) as Record<string, unknown>) ?? {};
  } catch {
    return fail("bad_request", 400);
  }
  const q = typeof body.q === "string" ? body.q.trim().slice(0, 200) : "";
  if (!q) return fail("bad_request", 400);
  const locale = typeof body.locale === "string" && /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(body.locale) ? body.locale : "tg";
  const intent = detectMediaIntent(q);
  const kind: MediaSearchKind =
    body.kind === "music" || body.kind === "movie" || body.kind === "any" ? body.kind : intent?.kind ?? "any";
  const query = intent?.query || q;
  if (kind === "music" && !(await canUseProMusic())) {
    return NextResponse.json(
      { error: { code: "PRO_REQUIRED" } },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await searchMedia(
      { query, kind, artist: intent?.artist, title: intent?.title, locale },
      AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
    );
    if (!result.providers.length) return fail("unavailable", 503);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return fail("unavailable", 503);
  }
}
