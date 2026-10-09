/** Server-side JSON fetch for media providers: timeout, identifying User-Agent, typed failure. */

export class MediaProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly reason: "timeout" | "http" | "network" | "rate_limit" | "not_configured",
    readonly status?: number,
  ) {
    super(`${provider}: ${reason}${status ? ` ${status}` : ""}`);
    this.name = "MediaProviderError";
  }
}

const USER_AGENT = "ChatGem/1.0 (legal media search; https://github.com/)";

export async function fetchJson<T>(
  provider: string,
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 8000);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(url, {
      signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...opts.headers },
      cache: "no-store",
    });
  } catch {
    throw new MediaProviderError(provider, timeout.aborted ? "timeout" : "network");
  }
  if (res.status === 429) throw new MediaProviderError(provider, "rate_limit", 429);
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new MediaProviderError(provider, "http", res.status);
  }
  return (await res.json()) as T;
}

/** Global sliding window for one upstream API (its published per-IP quota covers the whole server). */
export function createOutboundLimiter(maxPerWindow: number, windowMs = 60_000) {
  let hits: number[] = [];
  return function allow(): boolean {
    const now = Date.now();
    hits = hits.filter((t) => now - t < windowMs);
    if (hits.length >= maxPerWindow) return false;
    hits.push(now);
    return true;
  };
}

/** Drops tracking parameters providers append to file URLs. */
export function cleanUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) if (key.startsWith("utm_")) u.searchParams.delete(key);
    return u.toString();
  } catch {
    return undefined;
  }
}
