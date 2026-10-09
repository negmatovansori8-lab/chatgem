/**
 * Which media URLs may be downloaded. Shared by the browser (to decide whether a
 * Download button is shown) and by `/api/download` (which enforces it).
 */

/** Public hosts the app itself loads media from (image providers, free-license media). */
export const DOWNLOAD_HOSTS = [
  "image.pollinations.ai",
  "gen.pollinations.ai",
  "oaidalleapiprodscus.blob.core.windows.net",
  "upload.wikimedia.org",
] as const;

/** Hosts whose subdomains serve files the provider allows to download (Jamendo: artist-approved CC tracks). */
export const DOWNLOAD_HOST_SUFFIXES = ["storage.jamendo.com", "mp3d.jamendo.com"] as const;

export const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024;

export const DOWNLOADABLE_MIME = /^(?:image|video|audio)\/[\w.+-]+$/i;

export type DownloadRoute =
  /** Inline media already in the page (generated image, attachment preview). */
  | { via: "local"; url: string }
  /** Same-origin file or API endpoint. */
  | { via: "same-origin"; url: string }
  /** Allow-listed remote host, streamed through `/api/download`. */
  | { via: "proxy"; url: string }
  | { via: "blocked"; reason: "scheme" | "host" | "invalid" };

export function isAllowedDownloadHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    (DOWNLOAD_HOSTS as readonly string[]).includes(host) ||
    DOWNLOAD_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))
  );
}

function dataUrlMime(url: string): string | null {
  const m = /^data:([^;,]+)[;,]/i.exec(url);
  return m?.[1]?.toLowerCase() ?? null;
}

/** `origin` is the page origin in the browser; omit it on the server. */
export function classifyDownloadUrl(raw: string, origin?: string): DownloadRoute {
  const url = raw.trim();
  if (!url) return { via: "blocked", reason: "invalid" };

  if (/^data:/i.test(url)) {
    const mime = dataUrlMime(url);
    return mime && DOWNLOADABLE_MIME.test(mime) && !mime.includes("svg")
      ? { via: "local", url }
      : { via: "blocked", reason: "scheme" };
  }
  if (/^blob:/i.test(url)) {
    if (origin && !url.startsWith(`blob:${origin}/`)) return { via: "blocked", reason: "host" };
    return { via: "local", url };
  }
  if (url.startsWith("/") && !url.startsWith("//")) return { via: "same-origin", url };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { via: "blocked", reason: "invalid" };
  }
  if (parsed.username || parsed.password) return { via: "blocked", reason: "invalid" };
  if (origin && parsed.origin === origin) {
    return { via: "same-origin", url: `${parsed.pathname}${parsed.search}` };
  }
  if (parsed.protocol !== "https:") return { via: "blocked", reason: "scheme" };
  if (parsed.port && parsed.port !== "443") return { via: "blocked", reason: "host" };
  if (!isAllowedDownloadHost(parsed.hostname)) return { via: "blocked", reason: "host" };
  return { via: "proxy", url: parsed.toString() };
}

export function isDownloadable(url: string | undefined | null, origin?: string): boolean {
  return Boolean(url) && classifyDownloadUrl(url!, origin).via !== "blocked";
}
