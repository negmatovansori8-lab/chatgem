import type { MediaItem, MediaPlayback, MediaDownload } from "@/lib/media/types";
import { MAX_DOWNLOAD_BYTES } from "@/lib/downloads/policy";
import { baseMime, effectiveMime } from "@/lib/downloads/filename";
import { stripHtml } from "@/lib/media/text";
import { cleanUrl, fetchJson } from "@/providers/media/http";

/**
 * Wikimedia Commons — only freely licensed or public-domain files are accepted there,
 * so its files may be played and downloaded (with the license shown).
 */

const API = "https://commons.wikimedia.org/w/api.php";

type Derivative = { src: string; type: string; width?: number; height?: number; bandwidth?: number; transcodekey?: string };
type Meta = Record<string, { value?: unknown } | undefined>;
type VideoInfo = {
  url?: string;
  descriptionurl?: string;
  size?: number;
  mime?: string;
  duration?: number;
  derivatives?: Derivative[];
  extmetadata?: Meta;
};
type Page = { title?: string; index?: number; missing?: boolean; videoinfo?: VideoInfo[] };

export type CommonsFile = {
  title: string;
  name: string;
  artist?: string;
  license?: string;
  pageUrl?: string;
  durationSec?: number;
  play?: MediaPlayback;
  download?: MediaDownload;
};

const PLAYABLE_AUDIO = /^audio\/(?:ogg|mpeg|mp3|wav|x-wav|flac|x-flac|webm|opus|mp4|aac)$/;
/** Downloads stay below the app-wide cap with room for size estimates. */
const DOWNLOAD_BUDGET = MAX_DOWNLOAD_BYTES * 0.9;

function metaText(meta: Meta | undefined, key: string): string | undefined {
  const value = meta?.[key]?.value;
  const text = typeof value === "string" ? stripHtml(value) : undefined;
  return text ? text.slice(0, 120) : undefined;
}

/** Commons «Artist» is free text: keep it only when it reads like a name (it becomes «Artist - Song.ext»). */
function cleanArtist(value: string | undefined): string | undefined {
  if (!value || value.length > 40 || /[:;|]|https?:|\bperform|\barrang|\bcompos/i.test(value)) return undefined;
  return value;
}

function cleanFileTitle(title: string): string {
  return title.replace(/\s*\((?:ISRC|catalog)[^)]*\)/gi, "").trim();
}

function fileName(title: string): string {
  return title.replace(/^File:/i, "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/_/g, " ").trim();
}

function estimate(d: Derivative, duration?: number): number | undefined {
  return d.bandwidth && duration ? Math.round((d.bandwidth * duration) / 8) : undefined;
}

function toFile(page: Page): CommonsFile | null {
  const info = page.videoinfo?.[0];
  if (!page.title || !info?.url) return null;
  const mime = effectiveMime(info.mime, info.url);
  const license = metaText(info.extmetadata, "LicenseShortName");
  const base: CommonsFile = {
    title: cleanFileTitle(metaText(info.extmetadata, "ObjectName") ?? fileName(page.title)),
    name: page.title,
    artist: cleanArtist(metaText(info.extmetadata, "Artist")),
    license,
    pageUrl: info.descriptionurl,
    durationSec: info.duration ? Math.round(info.duration) : undefined,
  };
  const original = cleanUrl(info.url)!;
  const derivatives = (info.derivatives ?? []).filter((d) => d.transcodekey);

  if (mime.startsWith("audio/")) {
    if (!PLAYABLE_AUDIO.test(mime)) return null;
    // MP3 transcodes also play in Safari, which cannot decode Ogg.
    const mp3 = derivatives.find((d) => baseMime(d.type) === "audio/mpeg");
    base.play = { url: cleanUrl(mp3?.src) ?? original, kind: "audio", preview: false };
    if (info.size && info.size <= DOWNLOAD_BUDGET) {
      base.download = { url: original, mimeType: mime, size: info.size, sourceName: "Wikimedia Commons", license };
    }
    return base;
  }

  if (mime.startsWith("video/")) {
    const webm = derivatives
      .filter((d) => baseMime(d.type) === "video/webm")
      .sort((a, b) => (a.height ?? 0) - (b.height ?? 0));
    const stream = webm.find((d) => (d.height ?? 0) >= 480) ?? webm.at(-1);
    base.play = { url: cleanUrl(stream?.src) ?? original, kind: "video", preview: false };
    const candidates = [
      ...(info.size ? [{ url: original, mimeType: mime, size: info.size }] : []),
      ...webm.map((d) => ({ url: cleanUrl(d.src)!, mimeType: "video/webm", size: estimate(d, info.duration) })),
    ].filter((c): c is { url: string; mimeType: string; size: number } => Boolean(c.size && c.size <= DOWNLOAD_BUDGET));
    const best = candidates.sort((a, b) => b.size - a.size)[0];
    if (best) base.download = { ...best, sourceName: "Wikimedia Commons", license };
    return base;
  }
  return null;
}

const VIDEOINFO = {
  prop: "videoinfo",
  viprop: "url|size|mime|derivatives|extmetadata",
  viextmetadatafilter: "LicenseShortName|Artist|ObjectName",
};

/** File details for `File:` titles (e.g. a film's Wikidata «video» statement). */
export async function commonsFiles(titles: string[], signal?: AbortSignal): Promise<Map<string, CommonsFile>> {
  const out = new Map<string, CommonsFile>();
  if (!titles.length) return out;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    titles: titles.slice(0, 20).join("|"),
    ...VIDEOINFO,
  });
  const data = await fetchJson<{ query?: { pages?: Page[] } }>("commons", `${API}?${params}`, { signal });
  for (const page of data.query?.pages ?? []) {
    const file = toFile(page);
    if (file) out.set(file.name.replace(/_/g, " "), file);
  }
  return out;
}

/** Freely licensed recordings (classical, folk, CC music) matching the query. */
export async function searchCommonsAudio(query: string, signal?: AbortSignal): Promise<MediaItem[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `${query} filetype:audio`,
    gsrlimit: "10",
    ...VIDEOINFO,
  });
  const data = await fetchJson<{ query?: { pages?: Page[] } }>("commons", `${API}?${params}`, { signal });
  return (data.query?.pages ?? [])
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map(toFile)
    .filter((f): f is CommonsFile => Boolean(f?.play))
    .map(
      (f): MediaItem => ({
        id: `commons:${f.name}`,
        kind: "music",
        title: f.title,
        artist: f.artist,
        durationSec: f.durationSec,
        source: { provider: "commons", name: "Wikimedia Commons", url: f.pageUrl, license: f.license },
        play: f.play,
        download: f.download,
        links: f.pageUrl ? [{ label: "Wikimedia Commons", url: f.pageUrl, role: "info" }] : undefined,
        score: 0,
      }),
    );
}
