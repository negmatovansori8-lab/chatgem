/**
 * Spoken-language registry + detection, shared by the browser and the server.
 * Tajik, Russian and English are first-class; adding a language = one entry here.
 */

export type VoiceLanguage = {
  /** ISO-639-1 code used everywhere in the app ("tg", "ru", "en"…). */
  code: string;
  /** Name in the language itself ("Тоҷикӣ"). */
  native: string;
  /** English name, used in prompts for the AI and TTS instructions. */
  english: string;
  /** BCP-47 tag for browser speech synthesis / recognition. */
  bcp47: string;
  /**
   * Browser voices to try when this language has none (Tajik → Russian voice:
   * it reads Tajik Cyrillic far better than an English one).
   */
  browserFallback?: string;
  /** Names providers such as Whisper return in `verbose_json` ("tajik"). */
  providerNames?: string[];
};

export const VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: "tg", native: "Тоҷикӣ", english: "Tajik", bcp47: "tg-TJ", browserFallback: "ru-RU", providerNames: ["tajik"] },
  { code: "ru", native: "Русский", english: "Russian", bcp47: "ru-RU", providerNames: ["russian"] },
  { code: "en", native: "English", english: "English", bcp47: "en-US", providerNames: ["english"] },
  { code: "uz", native: "Oʻzbekcha", english: "Uzbek", bcp47: "uz-UZ", providerNames: ["uzbek"] },
  { code: "fa", native: "فارسی", english: "Persian", bcp47: "fa-IR", providerNames: ["persian"] },
  { code: "ar", native: "العربية", english: "Arabic", bcp47: "ar-SA", providerNames: ["arabic"] },
  { code: "tr", native: "Türkçe", english: "Turkish", bcp47: "tr-TR", providerNames: ["turkish"] },
  { code: "kk", native: "Қазақша", english: "Kazakh", bcp47: "kk-KZ", providerNames: ["kazakh"] },
  { code: "ky", native: "Кыргызча", english: "Kyrgyz", bcp47: "ky-KG", browserFallback: "ru-RU", providerNames: ["kyrgyz"] },
  { code: "uk", native: "Українська", english: "Ukrainian", bcp47: "uk-UA", providerNames: ["ukrainian"] },
  { code: "de", native: "Deutsch", english: "German", bcp47: "de-DE", providerNames: ["german"] },
  { code: "fr", native: "Français", english: "French", bcp47: "fr-FR", providerNames: ["french"] },
  { code: "es", native: "Español", english: "Spanish", bcp47: "es-ES", providerNames: ["spanish"] },
  { code: "it", native: "Italiano", english: "Italian", bcp47: "it-IT", providerNames: ["italian"] },
  { code: "pt", native: "Português", english: "Portuguese", bcp47: "pt-BR", providerNames: ["portuguese"] },
  { code: "zh", native: "中文", english: "Chinese", bcp47: "zh-CN", providerNames: ["chinese"] },
  { code: "ja", native: "日本語", english: "Japanese", bcp47: "ja-JP", providerNames: ["japanese"] },
  { code: "ko", native: "한국어", english: "Korean", bcp47: "ko-KR", providerNames: ["korean"] },
  { code: "hi", native: "हिन्दी", english: "Hindi", bcp47: "hi-IN", providerNames: ["hindi"] },
];

const BY_CODE = new Map(VOICE_LANGUAGES.map((l) => [l.code, l]));

export function baseCode(code?: string | null): string {
  return (code || "").split(/[-_]/)[0]?.toLowerCase() || "";
}

export function voiceLanguage(code?: string | null): VoiceLanguage | undefined {
  return BY_CODE.get(baseCode(code));
}

/** "russian" / "ru" / "ru-RU" → "ru"; unknown names → undefined. */
export function normalizeLanguage(value?: string | null): string | undefined {
  const v = (value || "").trim().toLowerCase();
  if (!v) return undefined;
  const code = baseCode(v);
  if (code.length === 2 || code.length === 3) {
    if (BY_CODE.has(code)) return code;
  }
  for (const l of VOICE_LANGUAGES) if (l.providerNames?.includes(v)) return l.code;
  return /^[a-z]{2,3}$/.test(code) ? code : undefined;
}

/** Letters only Tajik uses among Cyrillic languages. */
const TAJIK_LETTERS = /[ӣӯқғҳҷ]/giu;
/** Kazakh / Kyrgyz / Ukrainian specific letters. */
const KAZAKH_LETTERS = /[әіңұүһө]/giu;
const KYRGYZ_LETTERS = /[ңүө]/giu;
const UKRAINIAN_LETTERS = /[іїєґ]/giu;

/** Frequent Tajik words that are written without special letters. */
const TAJIK_WORDS =
  /(?<![\p{L}])(?:салом|ман|ту|шумо|мо|вай|онҳо|аст|ҳаст|хаст|нест|барои|бо|дар|аз|то|ки|чи|чӣ|чаро|куҷо|кучо|кадом|мехоҳам|мехохам|метавонам|бароям|бигӯ|бигу|лутфан|раҳмат|рахмат|хуб|бале|не|ин|он|имрӯз|имруз|фардо|дирӯз|маълумот|маълумоти|дода|деҳ|дех|кун|кардан|мешавад|шуд|буд|хона|шаҳр|шахр|тоҷикистон|точикистон|душанбе)(?![\p{L}])/giu;
const RUSSIAN_WORDS =
  /(?<![\p{L}])(?:что|как|почему|где|когда|привет|спасибо|пожалуйста|это|мне|меня|я|ты|вы|мы|он|она|они|есть|нет|да|не|и|в|на|с|по|для|расскажи|скажи|можно|нужно|хочу|сегодня|завтра|очень|про|о|об|или|но|так|уже|ещё|еще|был|была|будет)(?![\p{L}])/giu;
const ENGLISH_WORDS =
  /\b(?:the|a|an|is|are|was|were|what|how|why|where|when|who|please|thanks|thank|hello|hi|you|i|me|my|we|it|this|that|and|or|of|to|in|on|for|with|can|could|would|tell|about|do|does|yes|no)\b/gi;

function count(re: RegExp, text: string): number {
  re.lastIndex = 0;
  return text.match(re)?.length ?? 0;
}

function scriptCounts(text: string) {
  return {
    cyrillic: count(/[\u0400-\u04FF]/g, text),
    latin: count(/[A-Za-z\u00C0-\u024F]/g, text),
    arabic: count(/[\u0600-\u06FF\u0750-\u077F]/g, text),
    han: count(/[\u4E00-\u9FFF]/g, text),
    kana: count(/[\u3040-\u30FF]/g, text),
    hangul: count(/[\uAC00-\uD7AF]/g, text),
    devanagari: count(/[\u0900-\u097F]/g, text),
  };
}

/**
 * The language a transcript is in. Text evidence wins for tg/ru/en (providers
 * often call Tajik "Russian" or "Persian"); the provider's guess decides the rest.
 * Mixed sentences ("салом, how are you") resolve to the dominant language.
 */
export function detectSpokenLanguage(
  text: string,
  opts: { provider?: string | null; fallback?: string | null } = {},
): string {
  const provider = normalizeLanguage(opts.provider);
  const fallback = normalizeLanguage(opts.fallback) || "en";
  const t = text.trim();
  if (!t) return provider || fallback;

  const s = scriptCounts(t);
  const letters = s.cyrillic + s.latin + s.arabic + s.han + s.kana + s.hangul + s.devanagari;
  if (!letters) return provider || fallback;

  if (s.kana > 0) return "ja";
  if (s.hangul > letters * 0.3) return "ko";
  if (s.han > letters * 0.3) return "zh";
  if (s.devanagari > letters * 0.3) return "hi";
  if (s.arabic > letters * 0.5) {
    if (provider === "fa" || provider === "ar" || provider === "ur" || provider === "ps") return provider;
    // Persian-specific letters: پ چ ژ گ
    return /[پچژگ]/.test(t) ? "fa" : "ar";
  }

  if (s.cyrillic >= s.latin) {
    const tajik = count(TAJIK_LETTERS, t) * 3 + count(TAJIK_WORDS, t);
    const russian = count(RUSSIAN_WORDS, t) + count(/[ёъыэщ]/giu, t) * 2;
    if (count(UKRAINIAN_LETTERS, t) >= 2 && !tajik) return "uk";
    if (count(KAZAKH_LETTERS, t) >= 2 && !tajik) return count(/[әіұһ]/giu, t) ? "kk" : "ky";
    if (count(KYRGYZ_LETTERS, t) >= 2 && !tajik) return "ky";
    if (tajik > russian) return "tg";
    if (russian > tajik) return "ru";
    if (provider === "tg" || provider === "ru") return provider;
    return fallback === "tg" ? "tg" : "ru";
  }

  // Latin script
  const english = count(ENGLISH_WORDS, t);
  const words = t.split(/\s+/).filter(Boolean).length;
  if (provider && provider !== "en" && provider !== "tg" && provider !== "ru" && english < words * 0.3) {
    return provider;
  }
  if (/[çğıöşü]/i.test(t) && english < 2) return "tr";
  if (/[ʻʼ‘’]/.test(t) && /o[ʻ‘']|g[ʻ‘']/i.test(t)) return "uz";
  return "en";
}

/** Whisper-style STT regularly "hears" these on silence or noise. */
const HALLUCINATIONS = [
  "продолжение следует",
  "субтитры сделал",
  "субтитры создавал",
  "субтитры подготовил",
  "редактор субтитров",
  "спасибо за просмотр",
  "подписывайтесь на канал",
  "thank you for watching",
  "thanks for watching",
  "please subscribe",
  "like and subscribe",
  "amara.org",
  "dimatorzok",
];

const TRIVIAL = new Set(["you", "bye", "bye.", "you.", "hmm", "ah", "uh", "um", "эм", "ээ", "м", "а", "."]);

/** True when a transcript is noise, a known STT hallucination or an echo of the prompt. */
export function isNoiseTranscript(text: string, prompt?: string): boolean {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return true;
  if (!/[\p{L}\p{N}]/u.test(t)) return true;
  if (TRIVIAL.has(t)) return true;
  if (HALLUCINATIONS.some((h) => t.includes(h))) return true;
  if (prompt) {
    const p = prompt.trim().toLowerCase().replace(/\s+/g, " ");
    // Only a (near) full repeat of the prompt is an echo — "Салом" alone is a real greeting.
    if (p && (t.includes(p) || (p.includes(t) && t.length >= p.length * 0.6))) return true;
  }
  return false;
}
