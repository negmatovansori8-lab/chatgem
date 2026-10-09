/** In-memory sliding-window limiter keyed by client IP (per server instance). */
export function createRateLimiter(maxPerWindow: number, windowMs = 60_000) {
  const hits = new Map<string, number[]>();

  return function limited(req: Request, scope = ""): boolean {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
    const key = `${scope}|${ip}`;
    const now = Date.now();
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    }
    return list.length > maxPerWindow;
  };
}
