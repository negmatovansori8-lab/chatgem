import type { MediaItem } from "@/lib/media/types";
import { commonsFiles } from "@/providers/media/commons";
import { cleanUrl, fetchJson } from "@/providers/media/http";

/**
 * Films from Wikipedia (title, description, poster when freely licensed) enriched with
 * Wikidata (runtime, release date, full public-domain film on Commons, Internet
 * Archive id). Text is CC BY-SA; the source link is always shown.
 */

type WikiPage = {
  pageid: number;
  title: string;
  index?: number;
  description?: string;
  extract?: string;
  fullurl?: string;
  thumbnail?: { source?: string };
  pageprops?: { wikibase_item?: string };
};

type SparqlRow = Record<string, { value?: string } | undefined>;

export type FilmSearch = { items: MediaItem[]; suggestion?: string };

const FILM_RE = /\bfilm\b|\bmovie\b|фильм|мультфильм|кинофильм/i;
const NOT_FILM_RE =
  /soundtrack|album|\bsong\b|single|novel|\bbook\b|video game|character|franchise|film series|series of films|\bactor\b|actress|director|producer|television series|tv series|саундтрек|альбом|песня|роман|персонаж|актёр|актриса|режиссёр|телесериал|серия фильмов|франшиза/i;

function filmTitle(title: string): string {
  return title.replace(/\s*\((?:[^()]*\b(?:film|movie)\b[^()]*|фильм[^()]*|[^()]*фильм)\)\s*$/i, "").trim();
}

function yearOf(...texts: (string | undefined)[]): number | undefined {
  for (const t of texts) {
    const m = t && /\b(1[89]\d{2}|20\d{2})\b/.exec(t);
    if (m) return Number(m[1]);
  }
  return undefined;
}

function trim(text: string | undefined, max = 320): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, cut.lastIndexOf(" ")))}…`;
}

type FilmFacts = { durationSec?: number; year?: number; video?: string; archive?: string };

/** Runtime / release / Commons video / Internet Archive id for Wikidata items (one SPARQL call). */
async function filmFacts(ids: string[], signal?: AbortSignal): Promise<Map<string, FilmFacts>> {
  const out = new Map<string, FilmFacts>();
  const valid = ids.filter((id) => /^Q\d+$/.test(id));
  if (!valid.length) return out;
  const query = `SELECT ?item (SAMPLE(?d) AS ?duration) (MIN(?date) AS ?released) (SAMPLE(?v) AS ?video) (SAMPLE(?ia) AS ?archive) WHERE {
    VALUES ?item { ${valid.map((id) => `wd:${id}`).join(" ")} }
    OPTIONAL { ?item p:P2047/psn:P2047/wikibase:quantityAmount ?d }
    OPTIONAL { ?item wdt:P577 ?date }
    OPTIONAL { ?item wdt:P10 ?v }
    OPTIONAL { ?item wdt:P724 ?ia }
  } GROUP BY ?item`;
  const data = await fetchJson<{ results?: { bindings?: SparqlRow[] } }>(
    "wikidata",
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
    { signal, timeoutMs: 9000, headers: { Accept: "application/sparql-results+json" } },
  );
  for (const row of data.results?.bindings ?? []) {
    const id = row.item?.value?.split("/").pop();
    if (!id) continue;
    const seconds = Number(row.duration?.value);
    const video = row.video?.value ? decodeURIComponent(row.video.value.split("/Special:FilePath/")[1] ?? "") : "";
    out.set(id, {
      durationSec: Number.isFinite(seconds) && seconds > 60 ? Math.round(seconds) : undefined,
      year: yearOf(row.released?.value),
      video: video ? `File:${video}` : undefined,
      archive: row.archive?.value,
    });
  }
  return out;
}

export async function searchWikipediaFilms(
  query: string,
  opts: { lang?: "en" | "ru"; signal?: AbortSignal } = {},
): Promise<FilmSearch> {
  const lang = opts.lang ?? "en";
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: `${query} ${lang === "ru" ? "фильм" : "film"}`,
    gsrlimit: "8",
    prop: "pageimages|description|pageprops|extracts|info",
    inprop: "url",
    piprop: "thumbnail",
    pithumbsize: "500",
    ppprop: "wikibase_item",
    exintro: "1",
    explaintext: "1",
    exsentences: "3",
    exlimit: "8",
  });
  const data = await fetchJson<{ query?: { pages?: WikiPage[]; searchinfo?: { suggestion?: string } } }>(
    "wikipedia",
    `https://${lang}.wikipedia.org/w/api.php?${params}`,
    { signal: opts.signal },
  );
  const suggestion = data.query?.searchinfo?.suggestion
    ?.replace(/\s+(?:film|фильм)$/i, "")
    .trim();
  const pages = (data.query?.pages ?? [])
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .filter((p) => {
      const about = `${p.description ?? ""} ${p.title}`;
      return FILM_RE.test(about) && !NOT_FILM_RE.test(p.description ?? "");
    })
    .slice(0, 5);
  if (!pages.length) return { items: [], suggestion };

  const facts = await filmFacts(
    pages.map((p) => p.pageprops?.wikibase_item ?? ""),
    opts.signal,
  ).catch(() => new Map<string, FilmFacts>());
  const videoTitles = [...facts.values()].map((f) => f.video).filter((v): v is string => Boolean(v));
  const files = await commonsFiles(videoTitles, opts.signal).catch(() => new Map());

  const items = pages.map((p): MediaItem => {
    const qid = p.pageprops?.wikibase_item;
    const fact = (qid && facts.get(qid)) || {};
    const film = fact.video ? files.get(fact.video) : undefined;
    const title = filmTitle(p.title);
    const links: MediaItem["links"] = [];
    if (fact.archive) {
      links.push({ label: "Internet Archive", url: `https://archive.org/details/${encodeURIComponent(fact.archive)}`, role: "watch" });
    }
    links.push({ label: "JustWatch", url: `https://www.justwatch.com/us/search?q=${encodeURIComponent(title)}`, role: "watch" });
    if (p.fullurl) links.push({ label: "Wikipedia", url: p.fullurl, role: "info" });
    return {
      id: `wikipedia:${qid ?? `${lang}${p.pageid}`}`,
      kind: "movie",
      title,
      year: fact.year ?? yearOf(p.description, p.title),
      description: trim(p.extract) ?? p.description,
      durationSec: fact.durationSec,
      cover: cleanUrl(p.thumbnail?.source),
      source: { provider: "wikipedia", name: "Wikipedia", url: p.fullurl, license: "CC BY-SA" },
      play: film?.play ? { ...film.play, sourceName: "Wikimedia Commons" } : undefined,
      download: film?.download,
      links,
      score: 0,
    };
  });
  return { items, suggestion };
}

/** «Did you mean» from Wikipedia's search — good at names of songs, artists and films. */
export async function wikipediaSuggestion(query: string, signal?: AbortSignal): Promise<string | undefined> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    list: "search",
    srsearch: query,
    srinfo: "suggestion",
    srprop: "",
    srlimit: "1",
  });
  const data = await fetchJson<{ query?: { searchinfo?: { suggestion?: string } } }>(
    "wikipedia",
    `https://en.wikipedia.org/w/api.php?${params}`,
    { signal, timeoutMs: 6000 },
  );
  return data.query?.searchinfo?.suggestion?.trim() || undefined;
}

/** Titles that start like the query — «similar results» when nothing matched. */
export async function wikipediaTitles(query: string, signal?: AbortSignal): Promise<string[]> {
  const params = new URLSearchParams({ action: "opensearch", format: "json", search: query, limit: "6", namespace: "0" });
  const data = await fetchJson<[string, string[]]>("wikipedia", `https://en.wikipedia.org/w/api.php?${params}`, {
    signal,
    timeoutMs: 6000,
  });
  return (data[1] ?? []).map((t) => t.replace(/\s*\([^)]*\)\s*$/, "").trim()).filter(Boolean);
}
