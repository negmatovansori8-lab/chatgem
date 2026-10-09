export type MediaKind = "image" | "video" | "audio" | "file";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/bmp": "bmp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/ogg": "ogv",
  "video/x-matroska": "mkv",
  "video/3gpp": "3gp",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "weba",
  "audio/flac": "flac",
  "application/pdf": "pdf",
};

const EXT_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_EXT).map(([mime, ext]) => [ext, mime]),
);
EXT_MIME.jpeg = "image/jpeg";

export function baseMime(mime: string | null | undefined): string {
  return (mime ?? "").split(";")[0]!.trim().toLowerCase();
}

export function mediaKindOf(mime: string | null | undefined): MediaKind {
  const m = baseMime(mime);
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "file";
}

/** Extension from the URL path (`…/song.mp3?x=1` → `mp3`), ignoring data/blob URLs. */
export function extensionFromUrl(url: string | undefined): string | null {
  if (!url || /^(?:data|blob):/i.test(url)) return null;
  const path = url.split(/[?#]/)[0] ?? "";
  const m = /\.([a-z0-9]{2,5})$/i.exec(path);
  return m ? m[1]!.toLowerCase() : null;
}

export function mimeFromUrl(url: string | undefined): string | null {
  if (url && /^data:/i.test(url)) return baseMime(/^data:([^;,]+)/i.exec(url)?.[1]) || null;
  const ext = extensionFromUrl(url);
  return ext ? EXT_MIME[ext] ?? null : null;
}

/**
 * Servers often label media loosely (`application/ogg`, `application/octet-stream`);
 * the URL extension then tells the real type.
 */
export function effectiveMime(contentType: string | null | undefined, url?: string): string {
  const mime = baseMime(contentType);
  if (mime === "application/ogg") return mimeFromUrl(url) ?? "audio/ogg";
  if (!mime || mime === "application/octet-stream" || mime === "binary/octet-stream") {
    return mimeFromUrl(url) ?? mime;
  }
  // Same container, other track kind (e.g. `audio/webm` for a `.webm` video).
  const fromUrl = mimeFromUrl(url);
  if (fromUrl && /^(audio|video)\//.test(mime) && fromUrl.split("/")[1] === mime.split("/")[1]) {
    return fromUrl;
  }
  return mime;
}

export function extensionFor(mime: string | null | undefined, url?: string): string {
  return MIME_EXT[baseMime(mime)] ?? extensionFromUrl(url) ?? "bin";
}

const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com\d|lpt\d)$/i;

/** Safe on Android, Windows, macOS: no path separators, control or reserved characters. */
export function sanitizeFileBase(value: string, max = 80): string {
  let s = value
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, " ")
    .replace(/[`*#[\]]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "");
  if (s.length > max) {
    const cut = s.slice(0, max);
    const space = cut.lastIndexOf(" ");
    s = (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:-]+$/, "");
  }
  if (WINDOWS_RESERVED.test(s)) s = `${s}_`;
  return s;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** `Downloaded_YYYYMMDD_HHMMSS` in local time. */
export function timestampBase(date = new Date()): string {
  return `Downloaded_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export type DownloadMeta = {
  /** Song, movie or image title. */
  title?: string;
  /** Artist for audio: «Artist - Song.mp3». */
  artist?: string;
  mimeType?: string | null;
  url?: string;
  date?: Date;
};

/** «Artist - Song.mp3», «Movie Name.mp4», «Image Name.jpg», else «Downloaded_YYYYMMDD_HHMMSS.ext». */
export function buildDownloadName(meta: DownloadMeta): string {
  const mime = meta.mimeType || mimeFromUrl(meta.url);
  const ext = extensionFor(mime, meta.url);
  const title = sanitizeFileBase(meta.title ?? "", 60);
  const artist = sanitizeFileBase(meta.artist ?? "", 50);
  let base = artist && title ? `${artist} - ${title}` : title;
  base = base.replace(new RegExp(`\\.${ext}$`, "i"), "");
  return `${base || timestampBase(meta.date)}.${ext}`;
}

/** Swaps the extension once the real Content-Type is known. */
export function withExtension(name: string, mime: string | null | undefined): string {
  const ext = MIME_EXT[baseMime(mime)];
  if (!ext) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${ext}`;
}

/** RFC 6266 header with an ASCII fallback and the UTF-8 name (Tajik/Russian titles). */
export function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]+/g, "_").replace(/["\\]/g, "_") || "download";
  const utf8 = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
