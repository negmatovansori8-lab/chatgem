import type { MediaItem } from "@/lib/media/types";
import { cleanTitle, coverage, latinSearchTerms, normalizeText, primaryArtist, similarity } from "@/lib/media/text";

export type RankQuery = { query: string; artist?: string; title?: string };

/** Karaoke / tribute / sped-up re-recordings rank below the original unless asked for. */
const VARIANT_RE =
  /karaoke|tribute|made famous|in the style of|originally performed|lullaby|8.?bit|nightcore|sped.?up|slowed|reverb|instrumental|cover version|piano version|ringtone/i;

function variantPenalty(item: MediaItem, query: string): number {
  const text = `${item.title} ${item.album ?? ""} ${item.artist ?? ""}`;
  const m = VARIANT_RE.exec(text);
  return m && !new RegExp(m[0], "i").test(query) ? 0.3 : 0;
}

function textScore(item: MediaItem, q: RankQuery): number {
  const title = cleanTitle(item.title);
  if (item.kind === "movie") {
    const year = item.year ? ` ${item.year}` : "";
    const hinted = q.title ? similarity(q.title, title) : 0;
    return Math.max(similarity(q.query, title), similarity(q.query, `${title}${year}`), hinted);
  }
  const artist = item.artist ?? "";
  const scores = [
    similarity(q.query, title),
    similarity(q.query, `${artist} ${title}`),
    similarity(q.query, `${title} ${artist}`),
    similarity(q.query, artist) * 0.9,
    // Long archive titles («Beethoven - Moonlight Sonata Op. 27 (Piano Performance…)») contain the whole query.
    coverage(q.query, `${artist} ${title}`) * 0.85,
  ];
  if (q.title && q.artist) {
    // «A - B» is ambiguous (artist first or title first): try both readings.
    scores.push(0.55 * similarity(q.title, title) + 0.45 * similarity(q.artist, artist));
    scores.push(0.55 * similarity(q.artist, title) + 0.45 * similarity(q.title, artist));
  }
  return Math.max(...scores);
}

/** Relevance 0–1. `position` is the provider's own order (its ranking is a useful prior). */
export function scoreItem(item: MediaItem, q: RankQuery, position = 0): number {
  const s = textScore(item, q) - variantPenalty(item, q.query) - Math.min(0.1, position * 0.015);
  return Math.max(0, Math.min(1, Number(s.toFixed(4))));
}

function sameWork(a: MediaItem, b: MediaItem): boolean {
  if (a.kind !== b.kind) return false;
  if (normalizeText(cleanTitle(a.title)) !== normalizeText(cleanTitle(b.title))) return false;
  if (a.kind === "movie") return !a.year || !b.year || Math.abs(a.year - b.year) <= 1;
  return normalizeText(primaryArtist(a.artist)) === normalizeText(primaryArtist(b.artist));
}

/** Film metadata from several providers describes the same work: fill the gaps. */
function mergeMovie(base: MediaItem, other: MediaItem): MediaItem {
  return {
    ...base,
    cover: base.cover ?? other.cover,
    year: base.year ?? other.year,
    description: base.description ?? other.description,
    durationSec: base.durationSec ?? other.durationSec,
    play: base.play ?? other.play,
    download: base.download ?? other.download,
    links: [
      ...(base.links ?? []),
      ...(other.links ?? []).filter(
        (l) => !base.links?.some((b) => b.url === l.url || (b.role === l.role && b.label === l.label)),
      ),
    ],
  };
}

/**
 * Removes duplicates (same song on a single and an album, the same film from two
 * providers) and sorts by relevance. A song keeps its own recording: a free download
 * of another performance is never attached to a store preview.
 */
export function dedupeAndSort(items: MediaItem[]): MediaItem[] {
  const sorted = [...items].sort((a, b) => b.score - a.score || Number(Boolean(b.download)) - Number(Boolean(a.download)));
  const out: MediaItem[] = [];
  for (const item of sorted) {
    const i = out.findIndex((kept) => sameWork(kept, item));
    if (i < 0) {
      out.push(item);
      continue;
    }
    const kept = out[i]!;
    if (item.kind === "movie") out[i] = mergeMovie(kept, item);
    else if (!kept.download && item.download && kept.score - item.score < 0.1) out[i] = item;
  }
  return out;
}

function artistSimilarity(query: string, artist: string): number {
  return latinSearchTerms(query).reduce((best, form) => Math.max(best, similarity(form, artist)), 0);
}

/** Enough confidence to answer a bare «Shape of You» / «Adele» with media instead of the AI. */
export function isStrongMatch(items: MediaItem[], q: RankQuery, bare = true): boolean {
  const top = items[0];
  if (!top) return false;
  if (top.score >= 0.88) {
    const words = normalizeText(q.query).split(" ").filter(Boolean).length;
    if (words >= 2 || (!bare && top.score >= 0.95)) return true;
    const byArtist = items.slice(0, 6).filter((i) => i.artist && similarity(q.query, i.artist) >= 0.95).length;
    if (byArtist >= 3) return true;
  }
  // «BEHRAM BANI» is the same singer as Behnam Bani: several tracks, close name, not a one-off title hit.
  if (top.kind === "music" && top.artist && top.score >= 0.7 && artistSimilarity(q.query, top.artist) >= 0.8) {
    const agree = items.filter((i) => i.kind === "music" && i.artist && similarity(i.artist, top.artist!) >= 0.92).length;
    if (agree >= 2) return true;
  }
  return false;
}
