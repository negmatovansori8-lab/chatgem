import type { MediaItem } from "@/lib/media/types";
import { MediaProviderError, fetchJson } from "@/providers/media/http";

/**
 * Jamendo — independent music under Creative Commons licenses. Each track says whether
 * the artist allows downloads (`audiodownload_allowed`); only those get a Download
 * action. Needs a free client id: https://devportal.jamendo.com (server-side only).
 */

type JamendoTrack = {
  id?: string;
  name?: string;
  artist_name?: string;
  album_name?: string;
  duration?: number;
  releasedate?: string;
  image?: string;
  audio?: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
  license_ccurl?: string;
  shareurl?: string;
};

export function jamendoConfigured(): boolean {
  return Boolean(process.env.JAMENDO_CLIENT_ID?.trim());
}

/** «http://creativecommons.org/licenses/by-nc-sa/3.0/» → «CC BY-NC-SA 3.0». */
export function ccLabel(url: string | undefined): string | undefined {
  const m = url && /creativecommons\.org\/licenses\/([a-z-]+)\/([\d.]+)/i.exec(url);
  return m ? `CC ${m[1]!.toUpperCase()} ${m[2]}` : undefined;
}

export async function searchJamendo(query: string, signal?: AbortSignal): Promise<MediaItem[]> {
  const clientId = process.env.JAMENDO_CLIENT_ID?.trim();
  if (!clientId) throw new MediaProviderError("jamendo", "not_configured");
  const params = new URLSearchParams({
    client_id: clientId,
    format: "json",
    limit: "10",
    search: query,
    audioformat: "mp32",
    audiodlformat: "mp32",
    imagesize: "300",
    order: "relevance",
  });
  const data = await fetchJson<{ headers?: { status?: string }; results?: JamendoTrack[] }>(
    "jamendo",
    `https://api.jamendo.com/v3.0/tracks/?${params}`,
    { signal },
  );
  if (data.headers?.status && data.headers.status !== "success") {
    throw new MediaProviderError("jamendo", "not_configured");
  }
  return (data.results ?? [])
    .filter((t) => t.id && t.name)
    .map((t): MediaItem => {
      const license = ccLabel(t.license_ccurl);
      const year = t.releasedate ? Number(t.releasedate.slice(0, 4)) : undefined;
      return {
        id: `jamendo:${t.id}`,
        kind: "music",
        title: t.name!,
        artist: t.artist_name,
        album: t.album_name,
        year: year && Number.isFinite(year) ? year : undefined,
        durationSec: t.duration || undefined,
        cover: t.image || undefined,
        source: { provider: "jamendo", name: "Jamendo", url: t.shareurl, license },
        play: t.audio ? { url: t.audio, kind: "audio", preview: false } : undefined,
        download:
          t.audiodownload_allowed && t.audiodownload
            ? { url: t.audiodownload, mimeType: "audio/mpeg", sourceName: "Jamendo", license }
            : undefined,
        links: t.shareurl ? [{ label: "Jamendo", url: t.shareurl, role: "listen" }] : undefined,
        score: 0,
      };
    });
}
