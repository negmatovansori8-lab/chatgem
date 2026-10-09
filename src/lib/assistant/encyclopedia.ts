import { TtlCache } from "@/providers/maps/cache";
import { normalizeText, similarity } from "@/lib/media/text";

/**
 * «Исмоили Сомонӣ кист», «кто такой Рудаки», «who is Ibn Sina» — the free chat models invent
 * dates and places for people, so the chat grounds these questions in a Wikipedia intro.
 */

export type EncyclopediaEntry = {
  title: string;
  url: string;
  extract: string;
  lang: string;
  /** Fuller intro of the same article in another language when this one is too short. */
  more?: EncyclopediaEntry | null;
};

const PRONOUNS = new Set([
  "ту", "шумо", "ман", "вай", "ӯ", "у", "ин", "он", "онҳо", "мо",
  "ты", "вы", "я", "она", "оно", "они", "это",
  "you", "he", "she", "it", "this", "that", "they", "i",
]);

const PATTERNS: RegExp[] = [
  /^(.+?)\s+(?:кист|ки\s*аст|кӣ\s*аст|ки\s*буд|кӣ\s*буд|киҳо\s*буданд|кистанд)$/iu,
  /^(?:кист|кӣ\s*буд)\s+(.+)$/iu,
  /^кто\s+(?:так(?:ой|ая|ое|ие)|был[аио]?|это)\s+(.+)$/iu,
  /^(.+?)\s+(?:это\s+)?кто(?:\s+так(?:ой|ая|ие))?$/iu,
  /^who\s+(?:is|was|were|are)\s+(.+)$/iu,
  /^(?:(?:ба\s+ман\s+)?дар\s+бора(?:и|йи)\s+)(.+?)(?:\s+(?:маълумот|малумот|ахборот|нақл|накл|бигӯ|бигу|нависед|навис|гап\s*зан)(?:\s+(?:деҳ|дех|диҳ|дих|диҳед|кун|кунед))?)$/iu,
  /^(?:расскажи(?:те)?|что\s+известно)\s+(?:мне\s+)?(?:о|об|обо|про)\s+(.+)$/iu,
  /^(?:tell\s+me\s+about|what\s+do\s+you\s+know\s+about)\s+(.+)$/iu,
];

/** «Душанбе чист», «Помир чист» — only names (capitalised or several words), not «исм чист». */
const WHAT_IS = /^(.+?)\s+(?:чист|чи\s*аст|что\s+такое)$|^что\s+такое\s+(.+)$|^what\s+(?:is|was)\s+(?:the\s+)?(.+)$/iu;

/** The person or thing asked about, or null when the message is not a «who is X» question. */
export function encyclopediaSubject(text: string): string | null {
  const t = text
    .trim()
    .replace(/[?？!.…]+$/u, "")
    .replace(/\s+/g, " ");
  if (t.length < 4 || t.length > 90 || /https?:|```/.test(t)) return null;
  for (const re of PATTERNS) {
    const m = re.exec(t);
    const subject = m?.[1]?.replace(/^["«„]|["»“]$/g, "").trim();
    if (!subject) continue;
    const words = subject.split(" ");
    if (words.length > 6 || subject.length < 2) return null;
    if (words.length === 1 && PRONOUNS.has(subject.toLowerCase())) return null;
    return subject;
  }
  const what = WHAT_IS.exec(t);
  const subject = (what?.[1] ?? what?.[2] ?? what?.[3])?.trim();
  if (!subject) return null;
  const words = subject.split(" ");
  const named = /^\p{Lu}/u.test(subject) && subject !== subject.toUpperCase();
  if (words.length > 5 || words.some((w) => PRONOUNS.has(w.toLowerCase()))) return null;
  return named ? subject : null;
}

/** Tajik typed without special letters still matches: ҳ→х, ҷ→ч, қ→к, ғ→г (ӣ/ӯ fold in NFKD). */
function fold(value: string): string {
  return normalizeText(value).replace(/ҳ/g, "х").replace(/ҷ/g, "ч").replace(/қ/g, "к").replace(/ғ/g, "г");
}

/** «исмоили сомони» → «исмоили сомонӣ»: Tajik surnames and nisbas end in -ӣ. */
function tajikVariant(subject: string): string | null {
  const next = subject.replace(/и$/u, "ӣ");
  return next === subject ? null : next;
}

const DISAMBIGUATION = /метавонад\s+ишора|may\s+refer\s+to|может\s+означать|значения/i;
const cache = new TtlCache<EncyclopediaEntry | null>(300, 6 * 60 * 60 * 1000);

async function api<T>(lang: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  for (const [k, v] of Object.entries({ action: "query", format: "json", redirects: "1", ...params })) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { "User-Agent": "ChatGem/1.0 (https://chatgem.app; encyclopedia lookup)" },
    signal: AbortSignal.any([AbortSignal.timeout(4000), ...(signal ? [signal] : [])]),
  });
  if (!res.ok) throw new Error(`wikipedia ${res.status}`);
  return (await res.json()) as T;
}

type SearchHits = { query?: { search?: { pageid: number; title: string; redirecttitle?: string }[] } };
type ExtractPages = { query?: { pages?: Record<string, { title: string; fullurl?: string; extract?: string }> } };

const bare = (title: string) => title.replace(/\s*\([^)]*\)\s*$/, "");

async function lookupIn(lang: string, subject: string, signal?: AbortSignal): Promise<EncyclopediaEntry | null> {
  const queries = [subject, lang === "tg" ? tajikVariant(subject) : null].filter((q): q is string => Boolean(q));
  const found = await Promise.all(
    queries.map((q) =>
      api<SearchHits>(lang, { list: "search", srsearch: q, srlimit: "5", srprop: "redirecttitle" }, signal).catch(() => null),
    ),
  );
  const target = fold(subject);
  let best: { pageid: number; score: number } | null = null;
  for (const hit of found.flatMap((r) => r?.query?.search ?? [])) {
    // «Темурланг» is only a redirect to «Темур», so the redirect name counts as a title too.
    const names = [hit.title, hit.redirecttitle].filter((n): n is string => Boolean(n));
    const score = Math.max(...names.map((n) => similarity(fold(bare(n)), target)));
    if (!best || score > best.score) best = { pageid: hit.pageid, score };
  }
  if (!best || best.score < 0.75) return null;

  const entry = await intro(lang, { pageids: String(best.pageid) }, signal);
  if (!entry) return null;
  if (entry.extract.length < SHORT_INTRO) entry.more = await translatedIntro(lang, best.pageid, signal).catch(() => null);
  return entry;
}

/** Tajik intros are often one sentence («Темур» has no birth date), too little to answer from. */
const SHORT_INTRO = 400;

async function intro(
  lang: string,
  page: { pageids: string } | { titles: string },
  signal?: AbortSignal,
): Promise<EncyclopediaEntry | null> {
  const data = await api<ExtractPages>(
    lang,
    { ...page, prop: "extracts|info", inprop: "url", exintro: "1", explaintext: "1", exchars: "1200" },
    signal,
  );
  const found = Object.values(data.query?.pages ?? {})[0];
  const extract = found?.extract?.replace(/\s+/g, " ").trim();
  if (!found || !extract || extract.length < 60 || DISAMBIGUATION.test(extract.slice(0, 200))) return null;
  return {
    title: found.title,
    url: found.fullurl ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(found.title.replace(/ /g, "_"))}`,
    extract,
    lang,
  };
}

type LangLinks = { query?: { pages?: Record<string, { langlinks?: { lang: string; "*": string }[] }> } };

/** The same article in Russian (or English) through the interlanguage link. */
async function translatedIntro(lang: string, pageid: number, signal?: AbortSignal): Promise<EncyclopediaEntry | null> {
  for (const other of ["ru", "en"].filter((l) => l !== lang)) {
    const data = await api<LangLinks>(lang, { pageids: String(pageid), prop: "langlinks", lllang: other }, signal);
    const title = Object.values(data.query?.pages ?? {})[0]?.langlinks?.[0]?.["*"];
    if (!title) continue;
    const entry = await intro(other, { titles: title }, signal);
    if (entry) return entry;
  }
  return null;
}

/** Best Wikipedia intro for the subject: Tajik first for Cyrillic names, then Russian, then English. */
export async function lookupEncyclopedia(subject: string, signal?: AbortSignal): Promise<EncyclopediaEntry | null> {
  const key = fold(subject);
  if (!key) return null;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const langs = /[\u0400-\u04ff]/.test(subject) ? ["tg", "ru", "en"] : ["en", "ru"];
  let entry: EncyclopediaEntry | null = null;
  let answered = false;
  for (const lang of langs) {
    try {
      entry = await lookupIn(lang, subject, signal);
      answered = true;
    } catch {
      continue;
    }
    if (entry) break;
  }
  if (answered) cache.set(key, entry);
  return entry;
}

export function encyclopediaBlock(entry: EncyclopediaEntry): string {
  const sources = [entry, ...(entry.more ? [entry.more] : [])];
  return [
    ...sources.flatMap((s) => [`ENCYCLOPEDIA REFERENCE — Wikipedia (${s.lang}): «${s.title}» ${s.url}`, s.extract]),
    "Rules: the user asks about this subject. Take every fact (dates, places, titles, roles, family) only from these references and translate it accurately into the reply language; keep names, years and places exactly as written. Do not add facts, battles, dates or numbers that are not in them; never guess. Start with a one-sentence direct answer, then the key facts the references support (at most 6 bullets — fewer if the references are short). End with the source(s) as markdown links.",
  ].join("\n");
}
