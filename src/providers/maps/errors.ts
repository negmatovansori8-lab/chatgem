export type MapsErrorCode =
  | "bad_request"
  | "timeout"
  | "network"
  | "rate_limit"
  | "api_error"
  | "place_not_found"
  | "route_not_found"
  | "transit_unavailable";

export class MapsError extends Error {
  constructor(
    readonly code: MapsErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "MapsError";
  }
}

export function toMapsError(e: unknown): MapsError {
  if (e instanceof MapsError) return e;
  if (e instanceof Error) {
    if (e.name === "AbortError" || /abort|timeout/i.test(e.message)) {
      return new MapsError("timeout");
    }
    if (/fetch failed|ENOTFOUND|ECONNRE|network|socket/i.test(e.message)) {
      return new MapsError("network");
    }
  }
  return new MapsError("api_error");
}

export function httpStatusFor(code: MapsErrorCode): number {
  switch (code) {
    case "bad_request":
      return 400;
    case "place_not_found":
    case "route_not_found":
      return 404;
    case "rate_limit":
      return 429;
    case "timeout":
      return 504;
    default:
      return 502;
  }
}

/** Dropped connections and a gateway hiccup usually clear within a second or two. */
const RETRY_DELAYS_MS = [700, 2_000];

function isTransient(e: MapsError): boolean {
  return e.code === "network" || (e.code === "api_error" && /^http_50[234]$/.test(e.message));
}

/**
 * fetch + JSON with timeout and provider-status mapping
 * (429 → rate_limit, 5xx/other → api_error). Transient failures are retried
 * `retries` times (default 2); a timeout is not, so a slow provider is not hit again.
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  const { retries = RETRY_DELAYS_MS.length, ...rest } = init;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchJsonOnce<T>(url, rest);
    } catch (e) {
      const err = toMapsError(e);
      if (attempt >= retries || !isTransient(err) || rest.signal?.aborted) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]));
    }
  }
}

async function fetchJsonOnce<T>(url: string, init: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 15_000, signal, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  if (signal?.aborted) ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(url, { ...rest, signal: ctrl.signal, cache: "no-store" });
    if (res.status === 429) throw new MapsError("rate_limit");
    if (!res.ok) throw new MapsError("api_error", `http_${res.status}`);
    const text = await res.text();
    if (text.trimStart().startsWith("<")) throw new MapsError("api_error", "html_response");
    return JSON.parse(text) as T;
  } catch (e) {
    throw toMapsError(e);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
