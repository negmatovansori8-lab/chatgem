import { NextResponse } from "next/server";
import {
  DOWNLOADABLE_MIME,
  MAX_DOWNLOAD_BYTES,
  classifyDownloadUrl,
  isAllowedDownloadHost,
} from "@/lib/downloads/policy";
import {
  buildDownloadName,
  contentDisposition,
  effectiveMime,
  sanitizeFileBase,
  withExtension,
} from "@/lib/downloads/filename";
import { createRateLimiter } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const limited = createRateLimiter(40);
const CONNECT_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

type ErrorCode = "bad_request" | "blocked" | "not_found" | "too_large" | "unsupported" | "rate_limit" | "upstream";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  blocked: 403,
  not_found: 404,
  too_large: 413,
  unsupported: 415,
  rate_limit: 429,
  upstream: 502,
};

function fail(code: ErrorCode) {
  return NextResponse.json({ error: { code } }, { status: STATUS[code], headers: { "Cache-Control": "no-store" } });
}

/** Follows redirects by hand so every hop is re-checked against the allow-list. */
async function fetchAllowed(start: string, signal: AbortSignal, extra: Headers): Promise<Response | ErrorCode> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        Accept: "image/*,video/*,audio/*",
        "User-Agent": "Mozilla/5.0 (compatible; ChatGem/1.0)",
        ...Object.fromEntries(extra),
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) return "upstream";
      const next = new URL(location, url);
      if (next.protocol !== "https:" || !isAllowedDownloadHost(next.hostname)) return "blocked";
      url = next.toString();
      continue;
    }
    return res;
  }
  return "upstream";
}

/** Passes bytes through untouched and aborts once the size cap is crossed. */
function capStream(body: ReadableStream<Uint8Array>, max: number) {
  let seen = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > max) {
          controller.error(new Error("too_large"));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

/**
 * `GET /api/download?url=…&name=…` — streams an allow-listed remote media file with
 * `Content-Disposition: attachment`, so browsers save it instead of opening it and
 * cross-origin files get a proper name. Nothing is buffered in memory.
 */
export async function GET(request: Request) {
  if (limited(request, "download")) return fail("rate_limit");

  const params = new URL(request.url).searchParams;
  const target = params.get("url") ?? "";
  if (!target || target.length > 4096) return fail("bad_request");

  const route = classifyDownloadUrl(target);
  if (route.via !== "proxy") return fail(route.via === "blocked" && route.reason === "invalid" ? "bad_request" : "blocked");

  const connect = new AbortController();
  const timer = setTimeout(() => connect.abort(), CONNECT_TIMEOUT_MS);
  const signal = AbortSignal.any([request.signal, connect.signal]);

  // Resume support: only a single open-ended or bounded byte range is forwarded.
  const forward = new Headers();
  const range = request.headers.get("range");
  if (range && /^bytes=\d+-\d*$/.test(range)) {
    forward.set("Range", range);
    const ifRange = request.headers.get("if-range");
    if (ifRange && ifRange.length < 200) forward.set("If-Range", ifRange);
  }

  let upstream: Response | ErrorCode;
  try {
    upstream = await fetchAllowed(route.url, signal, forward);
  } catch {
    return fail("upstream");
  } finally {
    clearTimeout(timer);
  }
  if (typeof upstream === "string") return fail(upstream);
  if (upstream.status === 404 || upstream.status === 410) return fail("not_found");
  if (upstream.status === 429) {
    await upstream.body?.cancel();
    return fail("rate_limit");
  }
  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel();
    return fail("upstream");
  }

  const mime = effectiveMime(upstream.headers.get("content-type"), route.url);
  if (!DOWNLOADABLE_MIME.test(mime) || mime.includes("svg")) {
    await upstream.body.cancel();
    return fail("unsupported");
  }

  const length = Number(upstream.headers.get("content-length") || 0);
  const partial = upstream.status === 206;
  const contentRange = partial ? upstream.headers.get("content-range") : null;
  const total = Number(/\/(\d+)$/.exec(contentRange ?? "")?.[1] ?? 0);
  if (length > MAX_DOWNLOAD_BYTES || total > MAX_DOWNLOAD_BYTES) {
    await upstream.body.cancel();
    return fail("too_large");
  }

  const requested = sanitizeFileBase(params.get("name") ?? "", 120);
  const name = requested
    ? withExtension(requested.includes(".") ? requested : `${requested}.bin`, mime)
    : buildDownloadName({ mimeType: mime, url: route.url });

  const headers = new Headers({
    "Content-Type": mime,
    "Content-Disposition": contentDisposition(name),
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
  if (length > 0) headers.set("Content-Length", String(length));
  if (upstream.headers.get("accept-ranges") === "bytes") headers.set("Accept-Ranges", "bytes");
  for (const key of ["etag", "last-modified"]) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  if (contentRange) headers.set("Content-Range", contentRange);

  return new Response(capStream(upstream.body, MAX_DOWNLOAD_BYTES), { status: partial ? 206 : 200, headers });
}
