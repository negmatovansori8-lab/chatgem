/**
 * Canonical public origin for OAuth redirects.
 * Prefers the live request host in dev so localhost vs 127.0.0.1 never mismatch.
 */
export function resolveAppUrl(request?: Request) {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "")
    .trim()
    .replace(/\/$/, "");

  if (request) {
    try {
      const url = new URL(request.url);
      const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
      const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
      const host = xfHost || request.headers.get("host") || url.host;
      const proto =
        xfProto ||
        (url.protocol === "https:" ? "https" : "http");
      if (host) {
        const origin = `${proto}://${host}`.replace(/\/$/, "");
        if (process.env.NODE_ENV !== "production") return origin;
        return fromEnv || origin;
      }
    } catch {
      // fall through
    }
  }

  return fromEnv || "http://localhost:3000";
}

export function googleRedirectUri(request?: Request) {
  return `${resolveAppUrl(request)}/api/auth/callback/google`;
}

export function trimEnv(value: string | undefined) {
  return value?.trim() || "";
}
