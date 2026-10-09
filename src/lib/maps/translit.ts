/**
 * Cyrillic (Tajik + Russian) → Latin, for geocoder retries:
 * "Биг Бен" → "Big Ben", "Эйфел" → "Eyfel". Only a search fallback — never shown.
 */
const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "gh", д: "d", е: "e", ё: "yo", ж: "zh", з: "z",
  и: "i", ӣ: "i", й: "y", к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ӯ: "u", ф: "f", х: "kh", ҳ: "h", ц: "ts", ч: "ch",
  ҷ: "j", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function hasCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

export function transliterate(text: string): string {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const latin = MAP[lower];
    if (latin === undefined) {
      out += ch;
    } else if (ch !== lower && latin) {
      out += latin[0]!.toUpperCase() + latin.slice(1);
    } else {
      out += latin;
    }
  }
  return out;
}
