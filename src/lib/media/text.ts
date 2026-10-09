/** String normalization and typo-tolerant similarity for media titles and artists. */

/**
 * Tajik/Russian Cyrillic → Latin the way store catalogs spell names.
 * ҳ and х both become h («бехром» → behrom): Apple does not match Cyrillic or «kh».
 */
const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "gh", д: "d", е: "e", ё: "yo", ж: "zh", з: "z",
  и: "i", ӣ: "i", й: "y", к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ӯ: "u", ф: "f", х: "h", ҳ: "h", ч: "ch", ҷ: "j",
  ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
};

function foldCyrillic(query: string, vowelA: boolean): string {
  let out = "";
  for (const ch of query.toLowerCase()) {
    const mapped = CYR_TO_LAT[ch];
    if (mapped === undefined) out += ch;
    else out += vowelA && ch === "о" ? "a" : mapped;
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Store search strings for a music query.
 * A Cyrillic name is tried in Latin, then with о→a («бони» → bani, «бехром» → behram),
 * because catalogs list Persian names as Bahram/Bani rather than behrom/boni.
 * The vowel fold is only a fallback for two or more words, so a title like «Лола» stays lola.
 */
export function latinSearchTerms(query: string): string[] {
  const raw = query.trim();
  if (!/[\u0400-\u04ff]/.test(raw)) return [raw];
  const latin = foldCyrillic(raw, false);
  const terms = [latin];
  if (latin.split(" ").length >= 2) {
    const folded = foldCyrillic(raw, true);
    if (folded && folded !== latin) terms.push(folded);
  }
  return terms;
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/&/g, " and ")
    .replace(/['’`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** «Song (feat. X) [Remastered 2011] - Radio Edit» → «Song». */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[([][^)\]]*(?:feat|ft\.|with|remaster|version|edit|mix|live|mono|stereo|deluxe|bonus|film|фильм)[^)\]]*[)\]]/gi, "")
    .replace(/\s+-\s+(?:.*(?:remaster|version|edit|mix|live|mono|stereo)).*$/i, "")
    .trim();
}

/** «Ed Sheeran & Beyoncé», «A feat. B», «A, B» → «Ed Sheeran». */
export function primaryArtist(artist: string | undefined): string {
  if (!artist) return "";
  return artist.split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bx\b|\band\b|\bи\b|\bва\b)\s*/i)[0]!.trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length]!;
}

export function editRatio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max ? 1 - levenshtein(a, b) / max : 1;
}

/** Fuzzy token F1: every word may be misspelled a little («shap of yu» ≈ «shape of you»). */
function tokenF1(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const best = (t: string, pool: string[]) =>
    pool.reduce((m, p) => {
      const r = editRatio(t, p);
      return r > m ? r : m;
    }, 0);
  const credit = (r: number) => (r >= 0.6 ? r : 0);
  const recall = a.reduce((s, t) => s + credit(best(t, b)), 0) / a.length;
  const precision = b.reduce((s, t) => s + credit(best(t, a)), 0) / b.length;
  return recall + precision ? (2 * recall * precision) / (recall + precision) : 0;
}

/** 0–1 similarity of two free-text names, tolerant to typos, word order and punctuation. */
export function similarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return Math.max(editRatio(na, nb), tokenF1(na.split(" "), nb.split(" ")));
}

/** How much of `query` is covered by `text` (recall only) — «shape of you» in «Shape of You (Acoustic)». */
export function coverage(query: string, text: string): number {
  const q = normalizeText(query).split(" ").filter(Boolean);
  const t = normalizeText(text).split(" ").filter(Boolean);
  if (!q.length || !t.length) return 0;
  const hit = q.reduce((s, w) => {
    const r = t.reduce((m, p) => Math.max(m, editRatio(w, p)), 0);
    return s + (r >= 0.75 ? r : 0);
  }, 0);
  return hit / q.length;
}

export function stripHtml(value: string | undefined): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
