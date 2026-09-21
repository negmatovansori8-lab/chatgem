import { en, overlays, type Dictionary } from "@/lib/i18n/messages";
import { getLocaleInfo, isRtlLocale, WORLD_LOCALES } from "@/lib/i18n/locales";

export const defaultLocale = "tg";
export const locales = WORLD_LOCALES.map((l) => l.code);
export type Locale = string;

const cache = new Map<string, Dictionary>();

function baseCode(locale: string) {
  return locale.split("-")[0] ?? locale;
}

export function getDictionary(locale: Locale = defaultLocale): Dictionary {
  if (cache.has(locale)) return cache.get(locale)!;
  const overlay = (overlays[locale] ?? overlays[baseCode(locale)] ?? {}) as Partial<Dictionary>;
  const dict: Dictionary = { ...en };
  for (const [key, value] of Object.entries(overlay)) {
    if (typeof value === "string") dict[key] = value;
  }
  cache.set(locale, dict);
  return dict;
}

export function t(key: string, locale: Locale = defaultLocale) {
  const dict = getDictionary(locale);
  return dict[key] ?? en[key] ?? key;
}

export function isRtl(locale: Locale) {
  return isRtlLocale(locale);
}

export { getLocaleInfo, WORLD_LOCALES, isRtlLocale };
