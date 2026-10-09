import type { MediaItem } from "@/lib/media/types";
import { MediaProviderError, createOutboundLimiter, fetchJson } from "@/providers/media/http";

/**
 * Apple iTunes Search API — key-free song metadata, artwork and 30-second previews.
 * Apple's terms allow showing and playing previews to promote the store; the files
 * may not be downloaded, so these items never get a Download action.
 */

type ItunesTrack = {
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  trackExplicitness?: string;
};

/** Apple asks for roughly 20 calls per minute. */
const allow = createOutboundLimiter(20);

export async function searchItunesMusic(
  query: string,
  opts: { limit?: number; country?: string; signal?: AbortSignal } = {},
): Promise<MediaItem[]> {
  if (!allow()) throw new MediaProviderError("itunes", "rate_limit");
  const params = new URLSearchParams({
    term: query,
    media: "music",
    entity: "song",
    limit: String(opts.limit ?? 15),
    country: opts.country ?? process.env.MEDIA_STORE_COUNTRY ?? "us",
  });
  const data = await fetchJson<{ results?: ItunesTrack[] }>("itunes", `https://itunes.apple.com/search?${params}`, {
    signal: opts.signal,
  });
  return (data.results ?? [])
    .filter((t) => t.kind === "song" && t.trackId && t.trackName)
    .map((t): MediaItem => {
      const year = t.releaseDate ? Number(t.releaseDate.slice(0, 4)) : undefined;
      return {
        id: `itunes:${t.trackId}`,
        kind: "music",
        title: t.trackName!,
        artist: t.artistName,
        album: t.collectionName,
        year: year && Number.isFinite(year) ? year : undefined,
        durationSec: t.trackTimeMillis ? Math.round(t.trackTimeMillis / 1000) : undefined,
        cover: t.artworkUrl100?.replace(/\/\d+x\d+bb\./, "/600x600bb."),
        explicit: t.trackExplicitness === "explicit",
        source: { provider: "itunes", name: "Apple Music", url: t.trackViewUrl },
        play: t.previewUrl ? { url: t.previewUrl, kind: "audio", preview: true } : undefined,
        links: t.trackViewUrl ? [{ label: "Apple Music", url: t.trackViewUrl, role: "listen" }] : undefined,
        score: 0,
      };
    });
}
