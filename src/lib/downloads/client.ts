import { classifyDownloadUrl } from "@/lib/downloads/policy";
import { baseMime, effectiveMime, mimeFromUrl, withExtension } from "@/lib/downloads/filename";

export type DownloadErrorCode =
  | "cancelled"
  | "network"
  | "blocked"
  | "not_found"
  | "too_large"
  | "unsupported"
  | "rate_limit"
  | "not_configured"
  | "paused"
  | "failed";

/** Bytes received so far — kept on pause (or a dropped connection) to resume with an HTTP Range request. */
export type DownloadPartial = {
  chunks: BlobPart[];
  loaded: number;
  total: number | null;
  type: string;
  /** ETag / Last-Modified: resume only if the file did not change meanwhile. */
  validator?: string;
};

export class DownloadError extends Error {
  constructor(
    readonly code: DownloadErrorCode,
    readonly partial?: DownloadPartial,
  ) {
    super(code);
    this.name = "DownloadError";
  }
}

/** Pass as `AbortController.abort(PAUSE)` to keep the partial download. */
export const PAUSE = "pause";

/** Page origin for `classifyDownloadUrl`; undefined during server rendering. */
export function pageOrigin(): string | undefined {
  return typeof window === "undefined" ? undefined : window.location.origin;
}

export type DownloadProgress = { loaded: number; total: number | null };

export type DownloadSource =
  /** Any media URL; remote hosts go through `/api/download`. */
  | { url: string }
  /** A backend endpoint that returns the file (e.g. text-to-speech). */
  | { request: { url: string; init: RequestInit } };

export type SavedDownload = {
  name: string;
  mimeType: string;
  bytes: number;
  /** Saved through the iOS share sheet. */
  shared: boolean;
  /** A large file handed to the browser's download manager (no in-app progress). */
  handedOff: boolean;
};

const STATUS_CODES: Record<number, DownloadErrorCode> = {
  400: "failed",
  403: "blocked",
  404: "not_found",
  410: "not_found",
  413: "too_large",
  415: "unsupported",
  429: "rate_limit",
  503: "not_configured",
};

function requestFor(source: DownloadSource, name: string): { url: string; init?: RequestInit } {
  if ("request" in source) return source.request;
  const route = classifyDownloadUrl(source.url, window.location.origin);
  if (route.via === "blocked") throw new DownloadError("blocked");
  if (route.via === "proxy") {
    const qs = new URLSearchParams({ url: route.url, name });
    return { url: `/api/download?${qs}` };
  }
  return { url: route.url };
}

/** Remote files that can be paused and resumed (Range requests through `/api/download` or same-origin). */
export function isResumable(source: DownloadSource): boolean {
  if (!("url" in source) || typeof window === "undefined") return false;
  const via = classifyDownloadUrl(source.url, window.location.origin).via;
  return via === "proxy" || via === "same-origin";
}

/** Continues `resume` when the server answered 206 for the right offset; otherwise starts over. */
function partialFor(res: Response, resume: DownloadPartial | undefined): DownloadPartial {
  const type = baseMime(res.headers.get("content-type"));
  const validator = res.headers.get("etag") || res.headers.get("last-modified") || undefined;
  const length = Number(res.headers.get("content-length") || 0) || null;
  if (resume && res.status === 206) {
    const m = /bytes\s+(\d+)-\d+\/(\d+|\*)/i.exec(res.headers.get("content-range") ?? "");
    if (m && Number(m[1]) === resume.loaded) {
      const total = m[2] === "*" ? (length ? resume.loaded + length : null) : Number(m[2]);
      return { ...resume, total, type: resume.type || type, validator: validator ?? resume.validator };
    }
  }
  return { chunks: [], loaded: 0, total: length, type, validator };
}

async function readWithProgress(
  res: Response,
  part: DownloadPartial,
  signal: AbortSignal,
  onProgress: (p: DownloadProgress) => void,
): Promise<Blob> {
  onProgress({ loaded: part.loaded, total: part.total });
  if (!res.body) {
    const blob = await res.blob();
    part.chunks.push(blob);
    part.loaded += blob.size;
  } else {
    const reader = res.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        part.chunks.push(value as BlobPart);
        part.loaded += value.byteLength;
        onProgress({ loaded: part.loaded, total: part.total });
      }
    } catch {
      if (signal.aborted) {
        throw new DownloadError(signal.reason === PAUSE ? "paused" : "cancelled", part);
      }
      throw new DownloadError("network", part);
    }
  }
  return new Blob(part.chunks, { type: part.type });
}

/** Above this size the browser's own download manager streams the file to disk. */
const IN_MEMORY_LIMIT = 150 * 1024 * 1024;

/** Decodes a data URL without `fetch` — the app's CSP `connect-src` does not allow `data:`. */
function dataUrlToBlob(url: string): Blob {
  const comma = url.indexOf(",");
  if (comma < 0) throw new DownloadError("failed");
  const header = url.slice(5, comma);
  const type = baseMime(header) || "application/octet-stream";
  const payload = url.slice(comma + 1);
  try {
    if (!/;base64/i.test(header)) return new Blob([decodeURIComponent(payload)], { type });
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  } catch {
    throw new DownloadError("failed");
  }
}

/** Fetches the file with byte progress; throws `DownloadError`. `native` = handed to the browser. */
export async function fetchDownload(
  source: DownloadSource,
  name: string,
  opts: DownloadOptions,
): Promise<Blob | { native: string }> {
  if ("url" in source) {
    const route = classifyDownloadUrl(source.url, window.location.origin);
    if (route.via === "local") {
      // `blob:` URLs are same-origin files already in memory; CSP blocks fetching them.
      if (!route.url.startsWith("data:")) return { native: route.url };
      const blob = dataUrlToBlob(route.url);
      opts.onProgress({ loaded: blob.size, total: blob.size });
      return blob;
    }
  }
  const { url, init } = requestFor(source, name);
  const resume = opts.resume && opts.resume.loaded > 0 && !init ? opts.resume : undefined;
  const headers = new Headers(init?.headers);
  if (resume) {
    headers.set("Range", `bytes=${resume.loaded}-`);
    if (resume.validator) headers.set("If-Range", resume.validator);
  }
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, signal: opts.signal, cache: "no-store" });
  } catch {
    const code = opts.signal.aborted ? (opts.signal.reason === PAUSE ? "paused" : "cancelled") : "network";
    throw new DownloadError(code, resume);
  }
  if (res.status === 416 && resume?.total && resume.loaded >= resume.total) {
    return new Blob(resume.chunks, { type: resume.type });
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new DownloadError(STATUS_CODES[res.status] ?? "failed", resume);
  }
  const size = Number(res.headers.get("content-length") || 0);
  if (!init && !resume && url.startsWith("/") && size > IN_MEMORY_LIMIT) {
    await res.body?.cancel().catch(() => undefined);
    return { native: url };
  }
  const blob = await readWithProgress(res, partialFor(res, resume), opts.signal, opts.onProgress);
  if (!blob.size) throw new DownloadError("failed");
  return blob;
}

export type DownloadOptions = {
  signal: AbortSignal;
  onProgress: (p: DownloadProgress) => void;
  /** Partial bytes from a paused / interrupted attempt. */
  resume?: DownloadPartial;
};

function isAppleMobile() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Saves the file on the device. iOS Safari cannot put a download into Photos, so the
 * share sheet is used there («Save Image / Save Video»). Android saves to Downloads,
 * where the system media scanner adds images/videos to Gallery and audio to Music.
 */
export async function saveBlob(blob: Blob, name: string): Promise<{ shared: boolean }> {
  if (isAppleMobile() && typeof navigator.canShare === "function") {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return { shared: true };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw new DownloadError("cancelled");
      }
    }
  }
  const href = URL.createObjectURL(blob);
  clickDownload(href, name);
  window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
  return { shared: false };
}

function clickDownload(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Download + save in one step; the name gets the real extension from the response type. */
export async function downloadToDevice(
  source: DownloadSource,
  name: string,
  opts: DownloadOptions,
): Promise<SavedDownload> {
  const blob = await fetchDownload(source, name, opts);
  if (!(blob instanceof Blob)) {
    clickDownload(blob.native, name);
    return {
      name,
      mimeType: mimeFromUrl(name) ?? "application/octet-stream",
      bytes: 0,
      shared: false,
      handedOff: !blob.native.startsWith("blob:"),
    };
  }
  const mimeType = effectiveMime(blob.type, "url" in source ? source.url : name) || "application/octet-stream";
  const finalName = withExtension(name, mimeType);
  const typed = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
  const { shared } = await saveBlob(typed, finalName);
  return { name: finalName, mimeType, bytes: blob.size, shared, handedOff: false };
}
