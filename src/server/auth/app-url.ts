function hostnameOf(value: string) {
  try {
    const host = value.includes("://") ? new URL(value).hostname : value.split(":")[0];
    return host.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return "";
  }
}

function isLocalHostname(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
}

function isRenderHostname(host: string) {
  return host.endsWith(".onrender.com");
}

/** Reject header values that are not a hostname, so a bad proxy header cannot become a redirect. */
function safeHost(value: string | null | undefined) {
  const host = value?.split(",")[0]?.trim() ?? "";
  if (!host || host.length > 255) return "";
  const name = hostnameOf(host);
  if (!name || !/^[a-z0-9.-]+$/.test(name)) return "";
  return host;
}

function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = safeHost(request.headers.get("x-forwarded-host"));
  const hostHeader = safeHost(request.headers.get("host"));
  // Render's own host is *.onrender.com. A custom domain such as chatgem.pp.ua
  // arrives in x-forwarded-host and must win, or Google sends people to the wrong site.
  const headerName = hostnameOf(hostHeader);
  const forwardedName = hostnameOf(forwardedHost);
  const customDomainOnRender =
    Boolean(forwardedHost) &&
    isRenderHostname(headerName) &&
    !isRenderHostname(forwardedName) &&
    !isLocalHostname(forwardedName);
  const host =
    forwardedHost &&
    (!hostHeader || isLocalHostname(headerName) || forwardedHost === hostHeader || customDomainOnRender)
      ? forwardedHost
      : hostHeader || forwardedHost || url.host;
  if (!safeHost(host)) return "";
  const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = xfProto === "https" || xfProto === "http" ? xfProto : url.protocol === "https:" ? "https" : "http";
  return `${proto}://${host}`.replace(/\/$/, "");
}

/**
 * Public origin for OAuth and payment return URLs.
 * The browser's real host wins over a stale NEXT_PUBLIC_APP_URL (often localhost on Render),
 * so the Google redirect and the login cookie stay on the same site.
 */
export function resolveAppUrl(request?: Request) {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "")
    .trim()
    .replace(/\/$/, "");

  let origin = "";
  if (request) {
    try {
      origin = requestOrigin(request);
    } catch {
      origin = "";
    }
  }

  if (!origin) return fromEnv || "http://localhost:3000";
  if (process.env.NODE_ENV !== "production") return origin;

  const reqHost = hostnameOf(origin);
  const envHost = fromEnv ? hostnameOf(fromEnv) : "";
  // The public site URL wins over Render's own hostname, so Google always
  // returns people to chatgem.pp.ua and not to *.onrender.com.
  if (fromEnv && !isLocalHostname(envHost) && isRenderHostname(reqHost) && reqHost !== envHost) {
    return fromEnv;
  }
  if (!fromEnv || isLocalHostname(envHost) || reqHost === envHost || !isLocalHostname(reqHost)) {
    return origin;
  }
  return fromEnv;
}

export function googleRedirectUri(request?: Request) {
  return `${resolveAppUrl(request)}/api/auth/callback/google`;
}

export function trimEnv(value: string | undefined) {
  return value?.trim() || "";
}
