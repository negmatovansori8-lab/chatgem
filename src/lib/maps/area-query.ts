/**
 * Typed names of administrative areas: "вилояти Суғд", "ноҳияи Рӯдакӣ",
 * "Хатлонская область", "ВМКБ", "Bavaria region".
 */
import { transliterate } from "@/lib/maps/translit";

export type AreaLevel = "state" | "district" | "settlement";

const LEVEL_WORDS: { level: AreaLevel; re: RegExp }[] = [
  { level: "state", re: /^(?:вилоят|област|обл|region|province|oblast|state|viloyat)/iu },
  { level: "district", re: /^(?:ноҳия|нохия|район|district|rayon|nohiya|county)/iu },
  { level: "settlement", re: /^(?:шаҳр|шахр|город|деҳа|деха|деҳаи|село|посёлок|поселок|қишлоқ|кишлок|ҷамоат|чамоат|city|town|village)/iu },
];

/** Words that only name the kind of area ("вилояти", "district", "кишвари"). */
const KIND_WORD_RE =
  /^(?:(?:вилоят|област|region|province|oblast|state|viloyat|ноҳия|нохия|район|district|rayon|nohiya|county|шаҳр|шахр|город|деҳа|деха|село|посёлок|поселок|қишлоқ|кишлок|ҷамоат|чамоат|city|town|village|кишвар|давлат|стран|country|ҷумҳури|республик|republic|автономн|мухтор)\p{L}{0,3}|обл\.?|ш\.?|г\.?|р-н)$/iu;

/** Short official names people type instead of the full region name. */
const ALIASES: { re: RegExp; name: string; level: AreaLevel }[] = [
  { re: /^(?:вмкб|гбао|gbao|помир|памир|pamir)$/iu, name: "Кӯҳистони Бадахшон", level: "state" },
];

export type AreaName = {
  /** Name without the kind words ("Суғд"). */
  name: string;
  level?: AreaLevel;
  /** The text named an area explicitly ("вилояти", "район", an alias). */
  explicit: boolean;
};

function tokens(text: string): string[] {
  return text.split(/[\s,]+/u).filter(Boolean);
}

export function parseAreaName(text: string): AreaName | null {
  const words = tokens(text.trim());
  if (!words.length || words.length > 5 || /\d/.test(text)) return null;
  const alias = words.length === 1 ? ALIASES.find((a) => a.re.test(words[0]!)) : undefined;
  if (alias) return { name: alias.name, level: alias.level, explicit: true };

  let level: AreaLevel | undefined;
  const rest: string[] = [];
  for (const w of words) {
    if (KIND_WORD_RE.test(w)) {
      level ??= LEVEL_WORDS.find((l) => l.re.test(w))?.level;
      continue;
    }
    rest.push(w);
  }
  const name = rest.join(" ").trim();
  if (!name) return null;
  return { name, level, explicit: rest.length < words.length };
}

/** True when the text is only kind words ("ноҳияи", "шаҳри") — nothing to search for. */
export function isOnlyKindWords(text: string): boolean {
  const words = tokens(text.trim());
  return words.length > 0 && words.every((w) => KIND_WORD_RE.test(w));
}

/** Loose Latin skeleton so "Суғд", "Согд", "Sughd" compare equal-ish. */
function fold(text: string): string {
  return transliterate(text.toLowerCase())
    .replace(/dzh/g, "j")
    .replace(/kh/g, "h")
    .replace(/gh/g, "g")
    .replace(/q/g, "k")
    .replace(/yo/g, "e")
    .replace(/[^a-z0-9\s-]/g, "");
}

/** Every typed word (inflections allowed) starts a word of the area name. */
export function areaNameMatches(typed: string, areaName: string): boolean {
  const nameWords = tokens(fold(areaName).replace(/-/g, " "));
  const typedWords = tokens(fold(typed).replace(/-/g, " "));
  if (!typedWords.length) return false;
  return typedWords.every((w) => {
    // "Хатлонская" → "Хатлон".
    const t = w.replace(/sk(?:aya|iy|ii|oe|oy|ogo|om)$/, "") || w;
    const stem = t.length > 5 ? t.slice(0, t.length - 2) : t;
    return nameWords.some((n) => n.startsWith(stem));
  });
}

/** Same name after folding ("Ашан" = "Ashan"). */
export function sameName(a: string, b: string): boolean {
  return fold(a).replace(/[\s-]+/g, " ").trim() === fold(b).replace(/[\s-]+/g, " ").trim();
}
