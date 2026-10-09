/** Whisper / transcription ISO-639-1 codes OpenAI accepts. */
const WHISPER_LANGS = new Set([
  "af", "am", "ar", "as", "az", "ba", "be", "bg", "bn", "bo", "br", "bs", "ca",
  "cs", "cy", "da", "de", "el", "en", "es", "et", "eu", "fa", "fi", "fo", "fr",
  "gl", "gu", "ha", "haw", "he", "hi", "hr", "ht", "hu", "hy", "id", "is", "it",
  "ja", "jw", "ka", "kk", "km", "kn", "ko", "la", "lb", "ln", "lo", "lt", "lv",
  "mg", "mi", "mk", "ml", "mn", "mr", "ms", "mt", "my", "ne", "nl", "nn", "no",
  "oc", "pa", "pl", "ps", "pt", "ro", "ru", "sa", "sd", "si", "sk", "sl", "sn",
  "so", "sq", "sr", "su", "sv", "sw", "ta", "te", "tg", "th", "tk", "tl", "tr",
  "tt", "uk", "ur", "uz", "vi", "yi", "yo", "zh", "yue",
]);

/** Map UI locale → Whisper language (when codes differ). */
const LOCALE_TO_WHISPER: Record<string, string> = {
  zh: "zh",
  "zh-cn": "zh",
  "zh-tw": "zh",
  "zh-hk": "zh",
  iw: "he",
  nb: "no",
  nn: "no",
  fil: "tl",
  jw: "jw",
  ckb: "ar",
};

/**
 * Style prompts for STT. For Tajik, include common Cyrillic phrases so the
 * model stays on тоҷикӣ (not Persian script / random Russian).
 */
const VOICE_PROMPTS: Record<string, string> = {
  tg:
    "Забони тоҷикӣ, алифбои кириллӣ. Салом, чӣ хел, хуб, раҳмат, лутфан, " +
    "чора, имрӯз, фардо, ман, ту, шумо, кӣ, чӣ, куҷо, чаро, чӣ тавр, " +
    "мехоҳам, мефаҳмам, ChatGem, AI, кумак, савол, ҷавоб.",
  ru: "Это речь на русском языке. Транскрибируйте точно на русском.",
  en: "This is English speech. Transcribe accurately in English.",
  uz: "Bu o‘zbekcha nutq. Matnni o‘zbek tilida aniq yozing.",
  fa: "این گفتار به زبان فارسی است. متن را به فارسی دقیق بنویسید.",
  ar: "هذا كلام بالعربية. اكتب النص بدقة بالعربية.",
  tr: "Bu Türkçe konuşma. Metni Türkçe olarak doğru yazın.",
  zh: "这是中文语音。请用中文准确转写。",
  de: "Dies ist deutsche Sprache. Transkribieren Sie genau auf Deutsch.",
  fr: "Ceci est de la parole en français. Transcrivez précisément en français.",
  es: "Esto es habla en español. Transcriba con precisión en español.",
  hi: "यह हिंदी भाषण है। हिंदी में सटीक लिखें।",
  ky: "Бул кыргызча сүйлөө. Текстти кыргызча так жазыңыз.",
  kk: "Бұл қазақша сөйлеу. Мәтінді қазақша дәл жазыңыз.",
};

export function baseLocale(locale?: string | null) {
  return (locale || "en").split("-")[0]?.toLowerCase() || "en";
}

export function whisperLanguage(locale?: string | null): string | undefined {
  const raw = (locale || "").toLowerCase();
  const mapped =
    LOCALE_TO_WHISPER[raw] || LOCALE_TO_WHISPER[baseLocale(raw)] || baseLocale(raw);
  return WHISPER_LANGS.has(mapped) ? mapped : undefined;
}

export function whisperPrompt(locale?: string | null): string | undefined {
  const code = whisperLanguage(locale) || baseLocale(locale);
  return VOICE_PROMPTS[code];
}

/** Short instruction so chat replies match the spoken language (for TTS). */
export function voiceReplyHint(locale?: string | null, nativeName?: string) {
  const code = baseLocale(locale);
  const name = nativeName || code;
  const hints: Record<string, string> = {
    tg: `(Ҷавобро бо забони тоҷикӣ, кӯтоҳ (2–4 ҷумла) ва возеҳ диҳед — барои хониши овоз. Markdown нанависед.)`,
    ru: `(Ответь кратко (2–4 предложения) и ясно на русском — для озвучки. Без markdown.)`,
    en: `(Reply briefly (2–4 sentences) and clearly in English — for text-to-speech. No markdown.)`,
    uz: `(O‘zbekcha qisqa (2–4 gap) va aniq javob bering — ovoz uchun. Markdown yo‘q.)`,
    fa: `(پاسخ را کوتاه و واضح به فارسی بده — برای خواندن صوتی. بدون مارک‌داون.)`,
    ar: `(أجب باختصار ووضوح بالعربية — للقراءة الصوتية.)`,
    tr: `(Türkçe kısa ve net cevap ver — seslendirme için.)`,
    zh: `(请用中文简短清晰回答——便于语音播报。)`,
    de: `(Antworte kurz und klar auf Deutsch — für Sprachausgabe.)`,
    fr: `(Réponds brièvement et clairement en français — pour la synthèse vocale.)`,
    es: `(Responde breve y claro en español — para voz.)`,
    hi: `(हिंदी में संक्षिप्त और स्पष्ट उत्तर दें — आवाज़ के लिए।)`,
  };
  return (
    hints[code] ||
    `(Reply briefly and clearly in ${name} — for text-to-speech. No markdown.)`
  );
}

export function ttsVoiceForLocale(locale?: string | null) {
  const code = baseLocale(locale);
  if (["tg", "fa", "ru", "uz", "ar", "hi", "ur"].includes(code)) return "nova" as const;
  if (["zh", "ja", "ko"].includes(code)) return "shimmer" as const;
  if (["de", "fr", "es", "it", "pt", "tr"].includes(code)) return "alloy" as const;
  return "nova" as const;
}

export type Speaker = "woman" | "man";

/** A woman hears a female voice; a man hears a male voice. */
export function ttsVoiceForSpeaker(speaker?: string | null, locale?: string | null) {
  if (speaker === "man") return "onyx" as const;
  if (speaker === "woman") return "nova" as const;
  return ttsVoiceForLocale(locale);
}

/** BCP-47 tag for browser speechSynthesis fallback. */
export function browserSpeechLang(locale?: string | null) {
  const code = baseLocale(locale);
  const map: Record<string, string> = {
    tg: "ru-RU",
    ru: "ru-RU",
    en: "en-US",
    uz: "uz-UZ",
    fa: "fa-IR",
    ar: "ar-SA",
    tr: "tr-TR",
    zh: "zh-CN",
    de: "de-DE",
    fr: "fr-FR",
    es: "es-ES",
    hi: "hi-IN",
  };
  return map[code] || "en-US";
}
