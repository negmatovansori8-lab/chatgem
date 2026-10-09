import type { MediaItem, MediaLink } from "@/lib/media/types";
import { MediaProviderError, fetchJson } from "@/providers/media/http";

/**
 * TMDB — film posters, overview, runtime and legal streaming offers (data by JustWatch).
 * Optional: set TMDB_API_KEY (v3 key or v4 read token) on the server. Streaming services
 * never allow downloads, so TMDB items only link out to «Watch».
 */

type TmdbMovie = {
  id?: number;
  title?: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  poster_path?: string | null;
  popularity?: number;
};
type Provider = { provider_name?: string };
type Details = {
  runtime?: number;
  "watch/providers"?: { results?: Record<string, { link?: string; flatrate?: Provider[]; free?: Provider[]; ads?: Provider[]; rent?: Provider[]; buy?: Provider[] }> };
};

export function tmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_API_KEY?.trim());
}

function auth(): { query: Record<string, string>; headers: Record<string, string> } {
  const key = process.env.TMDB_API_KEY?.trim();
  if (!key) throw new MediaProviderError("tmdb", "not_configured");
  // v4 read access tokens are JWTs; v3 keys are 32 hex characters.
  return key.startsWith("eyJ") ? { query: {}, headers: { Authorization: `Bearer ${key}` } } : { query: { api_key: key }, headers: {} };
}

const LANG: Record<string, string> = { ru: "ru-RU", en: "en-US" };

export async function searchTmdbMovies(
  query: string,
  opts: { locale?: string; signal?: AbortSignal } = {},
): Promise<MediaItem[]> {
  const { query: keyParam, headers } = auth();
  const language = LANG[opts.locale ?? ""] ?? "en-US";
  const region = (process.env.TMDB_REGION || "US").toUpperCase();
  const search = new URLSearchParams({ query, include_adult: "false", language, page: "1", ...keyParam });
  const data = await fetchJson<{ results?: TmdbMovie[] }>("tmdb", `https://api.themoviedb.org/3/search/movie?${search}`, {
    headers,
    signal: opts.signal,
  });
  const movies = (data.results ?? []).filter((m) => m.id && m.title).slice(0, 4);
  return Promise.all(
    movies.map(async (m): Promise<MediaItem> => {
      const params = new URLSearchParams({ language, append_to_response: "watch/providers", ...keyParam });
      const details = await fetchJson<Details>("tmdb", `https://api.themoviedb.org/3/movie/${m.id}?${params}`, {
        headers,
        signal: opts.signal,
      }).catch(() => ({}) as Details);
      const offers = details["watch/providers"]?.results?.[region];
      const names = [...(offers?.free ?? []), ...(offers?.ads ?? []), ...(offers?.flatrate ?? []), ...(offers?.rent ?? []), ...(offers?.buy ?? [])]
        .map((p) => p.provider_name)
        .filter((n, i, all): n is string => Boolean(n) && all.indexOf(n) === i)
        .slice(0, 3);
      const page = `https://www.themoviedb.org/movie/${m.id}`;
      const links: MediaLink[] = [];
      if (offers?.link) links.push({ label: names.join(", ") || "TMDB", url: offers.link, role: "watch" });
      links.push({ label: "TMDB", url: page, role: "info" });
      const year = m.release_date ? Number(m.release_date.slice(0, 4)) : undefined;
      return {
        id: `tmdb:${m.id}`,
        kind: "movie",
        title: m.title!,
        year: year && Number.isFinite(year) ? year : undefined,
        description: m.overview || undefined,
        durationSec: details.runtime ? details.runtime * 60 : undefined,
        cover: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : undefined,
        source: { provider: "tmdb", name: "TMDB", url: page },
        links,
        score: 0,
      };
    }),
  );
}
