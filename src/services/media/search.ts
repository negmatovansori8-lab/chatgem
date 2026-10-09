import type { MediaItem, MediaProviderId, MediaSearchKind, MediaSearchResult } from "@/lib/media/types";
import { dedupeAndSort, scoreItem, type RankQuery } from "@/lib/media/rank";
import { latinSearchTerms, normalizeText, similarity } from "@/lib/media/text";
import { TtlCache } from "@/providers/maps/cache";
import { searchItunesMusic } from "@/providers/media/itunes";
import { MediaProviderError } from "@/providers/media/http";
import { searchCommonsAudio } from "@/providers/media/commons";
import { searchWikipediaFilms, wikipediaSuggestion, wikipediaTitles } from "@/providers/media/wikipedia";
import { jamendoConfigured, searchJamendo } from "@/providers/media/jamendo";
import { searchTmdbMovies, tmdbConfigured } from "@/providers/media/tmdb";

/**
 * Legal media search: picks the providers for the request, normalizes and ranks their
 * results, removes duplicates, corrects typos and offers similar titles. Every provider
 * runs server-side — keys never reach the browser.
 */

export type MediaSearchRequest = RankQuery & {
  kind: MediaSearchKind;
  /** Only the fast music lookup (a bare name typed in chat). */
  quick?: boolean;
  locale?: string;
};

type ProviderRun = { items: MediaItem[]; providers: MediaProviderId[]; suggestion?: string; correction?: string };

/** iTunes is a Latin catalog. Cyrillic is retried as Latin, then with о→a, and only the hit is kept. */
async function resolveItunes(query: string, signal?: AbortSignal): Promise<{ items: MediaItem[]; term: string }> {
  const terms = latinSearchTerms(query);
  let last: { items: MediaItem[]; term: string } = { items: [], term: terms[0] ?? query };
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i]!;
    try {
      const items = await searchItunesMusic(term, { signal });
      last = { items, term };
      if (items.length) return last;
    } catch (error) {
      const limited = error instanceof MediaProviderError && error.reason === "rate_limit";
      if (limited || i === terms.length - 1) throw error;
    }
  }
  return last;
}

const MAX_MUSIC = 6;
const MAX_MOVIES = 4;
const MAX_ITEMS = 8;
/** Below this the top result is probably not what was meant — try a spelling correction. */
const WEAK = 0.6;

const cache = new TtlCache<MediaSearchResult>(400, 30 * 60_000);

/** Free-license archives return loosely related files; they must match closely. */
const MIN_SCORE: Record<MediaProviderId, number> = {
  itunes: 0.35,
  jamendo: 0.45,
  commons: 0.7,
  wikipedia: 0.45,
  tmdb: 0.4,
};

async function runProviders(req: MediaSearchRequest, query: string, signal?: AbortSignal): Promise<ProviderRun> {
  const music = req.kind !== "movie";
  const movies = req.kind !== "music" && !req.quick;
  // Film titles are matched in the script they were typed in («Inception» on en, «Титаник» on ru).
  const lang = /[\u0400-\u04ff]/.test(query) ? "ru" : "en";
  const jobs: Array<{ id: MediaProviderId; run: Promise<MediaItem[] | { items: MediaItem[]; suggestion?: string }> }> = [];
  let itunesTerm = query;
  if (music) {
    const itunes = await resolveItunes(query, signal).catch((error: unknown) => {
      if (error instanceof MediaProviderError) return null;
      throw error;
    });
    if (itunes) {
      itunesTerm = itunes.term;
      jobs.push({ id: "itunes", run: Promise.resolve(itunes.items) });
    }
    if (!req.quick) {
      jobs.push({ id: "commons", run: searchCommonsAudio(query, signal) });
      if (jamendoConfigured()) jobs.push({ id: "jamendo", run: searchJamendo(query, signal) });
    }
  }
  if (movies) {
    jobs.push({ id: "wikipedia", run: searchWikipediaFilms(query, { lang, signal }) });
    if (tmdbConfigured()) jobs.push({ id: "tmdb", run: searchTmdbMovies(query, { locale: req.locale, signal }) });
  }

  const settled = await Promise.allSettled(jobs.map((j) => j.run));
  const out: ProviderRun = { items: [], providers: [] };
  settled.forEach((res, i) => {
    const id = jobs[i]!.id;
    if (res.status !== "fulfilled") return;
    const list = Array.isArray(res.value) ? res.value : res.value.items;
    if (!Array.isArray(res.value) && res.value.suggestion) out.suggestion = res.value.suggestion;
    out.providers.push(id);
    const rank: RankQuery = { query: id === "itunes" ? itunesTerm : query, artist: req.artist, title: req.title };
    list.forEach((item, position) => {
      const score = scoreItem(item, rank, position);
      // In a mixed search a film must really be the title asked for (and vice versa).
      const floor = req.kind === "any" ? Math.max(MIN_SCORE[id], item.kind === "movie" ? 0.75 : 0.55) : MIN_SCORE[id];
      if (score >= floor) out.items.push({ ...item, score });
    });
  });
  out.items = dedupeAndSort(out.items);
  const top = out.items[0];
  if (top?.artist && normalizeText(itunesTerm) !== normalizeText(query) && similarity(itunesTerm, top.artist) >= 0.8) {
    out.correction = top.artist;
  }
  return out;
}

/** Keeps up to two legally downloadable tracks visible even when store previews rank higher. */
const RESERVED_DOWNLOADS = 2;

function limit(items: MediaItem[]): MediaItem[] {
  const songs = items.filter((i) => i.kind === "music");
  const reserved = songs.filter((i) => i.download).slice(0, RESERVED_DOWNLOADS);
  const music = [...reserved, ...songs.filter((i) => !reserved.includes(i))].slice(0, MAX_MUSIC);
  const movies = items.filter((i) => i.kind === "movie").slice(0, MAX_MOVIES);
  return [...music, ...movies].sort((a, b) => b.score - a.score).slice(0, MAX_ITEMS);
}

function label(item: MediaItem): string {
  if (item.kind === "movie") return item.year ? `${item.title} (${item.year})` : item.title;
  return item.artist ? `${item.artist} - ${item.title}` : item.title;
}

async function similar(query: string, run: ProviderRun, corrected: string | undefined, signal?: AbortSignal): Promise<string[]> {
  const norm = normalizeText(query);
  const pool = [
    ...(run.suggestion && !corrected ? [run.suggestion] : []),
    ...(await wikipediaTitles(query, signal).catch(() => [])),
  ];
  const seen = new Set<string>([norm, normalizeText(corrected ?? ""), ...run.items.flatMap((i) => [normalizeText(label(i)), normalizeText(i.title)])]);
  const out: string[] = [];
  for (const s of pool) {
    const key = normalizeText(s);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s.slice(0, 80));
    if (out.length >= 5) break;
  }
  return out;
}

async function load(req: MediaSearchRequest, signal?: AbortSignal): Promise<MediaSearchResult> {
  let run = await runProviders(req, req.query, signal);
  let corrected: string | undefined = run.correction;

  if (!req.quick && (run.items[0]?.score ?? 0) < WEAK) {
    const suggestion = run.suggestion ?? (await wikipediaSuggestion(req.query, signal).catch(() => undefined));
    if (suggestion && normalizeText(suggestion) !== normalizeText(req.query)) {
      const retry = await runProviders({ ...req, artist: undefined, title: undefined }, suggestion, signal);
      if ((retry.items[0]?.score ?? 0) > (run.items[0]?.score ?? 0) + 0.05) {
        run = { ...retry, providers: [...new Set([...run.providers, ...retry.providers])] };
        corrected = suggestion;
      }
    }
  }

  const items = limit(run.items);
  const weak = !items.length || (items[0]?.score ?? 0) < WEAK;
  return {
    query: req.query,
    corrected,
    kind: req.kind,
    items,
    suggestions: !req.quick && weak ? await similar(corrected ?? req.query, run, corrected, signal) : [],
    providers: run.providers,
  };
}

export async function searchMedia(req: MediaSearchRequest, signal?: AbortSignal): Promise<MediaSearchResult> {
  const query = req.query.trim().slice(0, 100);
  if (!query) return { query, kind: req.kind, items: [], suggestions: [], providers: [] };
  const key = [req.kind, req.quick ? "q" : "f", req.locale?.slice(0, 2) ?? "", normalizeText(query), req.artist ?? "", req.title ?? ""].join("|");
  const result = await cache.getOrLoad(key, () => load({ ...req, query }, signal));
  // Nothing from any provider (all down or rate-limited) is not worth remembering.
  if (!result.providers.length) cache.delete(key);
  return result;
}

/** Which providers this server can use (for the status endpoint / attribution). */
export function mediaProviderStatus() {
  return {
    itunes: true,
    commons: true,
    wikipedia: true,
    jamendo: jamendoConfigured(),
    tmdb: tmdbConfigured(),
  };
}
