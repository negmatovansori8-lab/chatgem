import type { PostalAddress } from "@/providers/maps/types";

/** Street-type words users type around a street name ("кӯчаи Рӯдакӣ", "ул. Айни", "Rudaki Ave"). */
const STREET_WORDS =
  "кӯчаи|кӯча|кучаи|куча|кӯч\\.|ул\\.|ул|улица|улицы|проспекти|проспект|пр-т|пр\\.|хиёбони|хиёбон|гузаргоҳи|гузаргоҳ|переулок|пер\\.|бульвар|шоссе|тупик|street|st\\.|avenue|ave\\.|ave|road|rd\\.|boulevard|blvd\\.|lane";
/** House words before the number ("хонаи 25", "дом 25", "д. 25", "№25"). */
const HOUSE_WORDS = "хонаи|хона|дом|д\\.|house|№";

const SEP = "(^|[\\s,])";
const END = "(?=$|[\\s,.\\d])";
const STREET_RE = new RegExp(`${SEP}(?:${STREET_WORDS})${END}`, "giu");
const HOUSE_RE = new RegExp(`${SEP}(?:${HOUSE_WORDS})${END}`, "giu");
const HOUSE_NUMBER_RE = /(?:^|[\s,№])(\d{1,4}(?:\s?[а-яёӣӯa-z])?(?:\/\d{1,4})?)(?=$|[\s,])/iu;

const TJ_TO_RU: Record<string, string> = { ӯ: "у", ӣ: "и", ҳ: "х", ҷ: "ч", қ: "к", ғ: "г", Ӯ: "У", Ӣ: "И", Ҳ: "Х", Ҷ: "Ч", Қ: "К", Ғ: "Г" };

function clean(s: string): string {
  return s.replace(/\s*,\s*/g, ", ").replace(/\s{2,}/g, " ").replace(/^[\s,]+|[\s,]+$/g, "");
}

/** A street address rather than a place name: a street word, or a name followed by a house number. */
export function looksLikeAddress(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  STREET_RE.lastIndex = 0;
  if (STREET_RE.test(t)) return true;
  return /\p{L}{3,}/u.test(t) && HOUSE_NUMBER_RE.test(t);
}

/** The house number the user typed ("25", "25а", "12/3"), if any. */
export function houseNumberOf(text: string): string | undefined {
  return text.match(HOUSE_NUMBER_RE)?.[1]?.replace(/\s/g, "").toLowerCase();
}

/** Tajik letters → Russian spelling, as most street names in OSM are written ("Рӯдакӣ" → "Рудаки"). */
export function russianSpelling(text: string): string {
  return text.replace(/[ӯӣҳҷқғӮӢҲҶҚҒ]/g, (c) => TJ_TO_RU[c] ?? c);
}

/**
 * Query variants for a street address, most literal first:
 * as typed → without street/house words → in Russian spelling.
 */
export function addressVariants(text: string): string[] {
  const typed = clean(text);
  const bare = clean(typed.replace(STREET_RE, "$1").replace(HOUSE_RE, "$1"));
  return [...new Set([typed, bare, russianSpelling(bare)].filter(Boolean))];
}

function unique(parts: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const v = p?.trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}

/** "кӯчаи Рӯдакӣ, 25" — street and house number only when the provider has them. */
export function addressTitle(postal: PostalAddress | undefined): string | undefined {
  if (!postal?.road) return undefined;
  return postal.houseNumber ? `${postal.road}, ${postal.houseNumber}` : postal.road;
}

/** "Сино, Душанбе, Тоҷикистон" */
export function localityLine(postal: PostalAddress | undefined, opts: { withArea?: boolean } = {}): string {
  if (!postal) return "";
  return unique([
    ...(opts.withArea === false ? [] : [postal.neighbourhood, postal.district]),
    postal.city,
    postal.city ? undefined : postal.state,
    postal.country,
  ]).join(", ");
}

/** Neighbourhood and district without repeating the city ("Сино" / "ноҳияи Рӯдакӣ"). */
export function areaLine(postal: PostalAddress | undefined): string {
  if (!postal) return "";
  const city = postal.city?.toLowerCase();
  return unique([postal.neighbourhood, postal.district])
    .filter((p) => p.toLowerCase() !== city)
    .join(", ");
}

/** A street-level result (not only a city / region / country). */
export function isExactAddress(postal: PostalAddress | undefined): boolean {
  return Boolean(postal?.road || postal?.houseNumber);
}
