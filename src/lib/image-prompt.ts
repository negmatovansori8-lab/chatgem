/** Shared helpers for ChatGem image / logo generation (ChatGPT-style intents). */

const LOGO_RE =
  /логотип|лагатип|лагтип|logotype|\blogo\b|эмблем|брендинг|brand\s*mark|иконк|иконка/i;

const IMAGE_NOUN_RE =
  /сурат|тасвир|акс|расм|фото|картинк|изображен|рисунок|снимок|picture|photo|image|illustration|artwork|drawing|снимок|арт\b/i;

/** Clear “make / draw / generate” verbs (TG / RU / EN). */
const CREATE_VERB_RE =
  /(?:^|[\s,])(?:соз(?:ед|ӣ|и)?|сохта\s+диҳ|нарисуй|нарисовать|рисуй|создай|создать|сгенерируй|сгенерировать|сделай|сделать|нарисуйте|хоҳам|мехоҳам|draw|generate|create|make|paint|sketch|render)\b/i;

const NEGATIVE_RE =
  /(?:^|\b)(?:сурат|тасвир|акс|фото|картинк\w*|изображен\w*|image|picture|photo)\s+(?:нест|не\s+вид|не\s+показ|не\s+отображ|не\s+работ)|(?:не\s+(?:вижу|показывает|отображается|работает)\s+(?:сурат|тасвир|акс|фото|картинк|изображен|image|picture|photo))|(?:(?:image|picture|photo|сурат|тасвир)\s+(?:not\s+show|doesn'?t\s+show|isn'?t\s+show|missing|broken|won'?t\s+load))|(?:no\s+image|missing\s+image|broken\s+image|doesn'?t\s+show\s+(?:the\s+)?image)/i;

const EXPLICIT_GENERATE_RE =
  /\b(?:text[\s-]?to[\s-]?image|txt2img|dall-?e|midjourney|stable\s*diffusion)\b/i;

/** Phrases like “image of a cat”, “фото кота”, “сурати себ”. */
const IMAGE_OF_RE =
  /(?:сурат|тасвир|акс|расм|фото|картинк\w*|изображен\w*|рисунок|picture|photo|image|illustration)\s*(?:и|ии|ы|а|:|of|of\s+a|of\s+an|для|для\s+меня|ман|мехоҳам)?\s+/i;

export function isLogoRequest(text: string) {
  return LOGO_RE.test(text);
}

/**
 * ChatGPT-like: only trigger generation on clear create/draw intents,
 * not every message that merely mentions “image”.
 */
export function wantsImageGeneration(text: string) {
  const t = text.trim();
  if (!t || t.length > 1200) return false;
  if (NEGATIVE_RE.test(t)) return false;

  if (EXPLICIT_GENERATE_RE.test(t)) return true;

  // Logo requests almost always mean generate.
  if (LOGO_RE.test(t) && (CREATE_VERB_RE.test(t) || /[:\-–]|для|for\b|барои/i.test(t) || t.length < 80)) {
    return true;
  }

  // “нарисуй …”, “draw a …”, “сурат соз …”, “create an image …”
  if (CREATE_VERB_RE.test(t) && (IMAGE_NOUN_RE.test(t) || LOGO_RE.test(t))) {
    return true;
  }

  // Starts with create/draw even without noun: “draw a red apple”
  if (
    /^(?:нарисуй|нарисовать|рисуй|создай|сгенерируй|сделай|draw|generate|create|make|paint|sketch|соз|тасвир\s*соз|акс\s*соз|сурат\s*соз|логотип\s*соз)\b/i.test(
      t,
    )
  ) {
    return true;
  }

  // “image of …”, “фото …”, “сурати …”
  if (IMAGE_OF_RE.test(t) && CREATE_VERB_RE.test(t)) return true;

  // Short imperative photo/logo lines
  if (
    t.length < 160 &&
    /^(?:сурат|тасвир|акс|логотип|лагатип|фото|картинка|изображение|logo)\b/i.test(t) &&
    /[:\-–]|соз|создай|сделай|generate|create|draw|for\b|барои|для/i.test(t)
  ) {
    return true;
  }

  return false;
}

export function extractImagePrompt(text: string) {
  const cleaned = text
    .trim()
    .replace(
      /^(пожалуйста[,.]?\s*|please[,.]?\s*|ман\s+мехоҳам\s+(ки\s+)?|мехоҳам\s+(ки\s+)?|хоҳам\s+(ки\s+)?|can\s+you\s+|could\s+you\s+|please\s+)/i,
      "",
    )
    .replace(
      /^(нарисуй(?:те)?|нарисовать|рисуй|создай\s+изображение|создай\s+картинку|создай\s+фото|создай\s+логотип|создай\s+лагатип|сгенерируй\s+изображение|сгенерируй\s+картинку|сделай\s+логотип|сделай\s+картинку|сделай\s+фото|сделай\s+изображение|generate\s+an?\s+image\s+of|generate\s+a\s+photo\s+of|generate\s+image|generate\s+a\s+logo|create\s+an?\s+image\s+of|create\s+a\s+photo\s+of|create\s+an?\s+image|create\s+a\s+logo|draw\s+(?:me\s+)?(?:an?\s+)?(?:image\s+of\s+)?|make\s+(?:me\s+)?(?:an?\s+)?(?:image\s+of\s+)?|paint|sketch|тасвир\s*соз|акс\s*соз|сурат\s*соз|логотип\s*соз|лагатип\s*соз|лагтип\s*соз|соз)[:\s-]*/i,
      "",
    )
    .replace(/\b(лагатип|лагтип)\b/gi, "логотип")
    .trim();
  return cleaned || text.trim();
}

/** Enrich prompt so models produce usable logos / photos. */
export function enhanceImagePrompt(raw: string): {
  prompt: string;
  kind: "logo" | "photo" | "general";
} {
  const base = extractImagePrompt(raw);
  if (isLogoRequest(raw) || isLogoRequest(base)) {
    const subject =
      base
        .replace(/\b(логотип|лагатип|лагтип|logo|logotype)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim() || "ChatGem AI";
    return {
      kind: "logo",
      prompt: [
        `Professional app logo design for "${subject}".`,
        "Clean modern vector-style mark, centered icon, flat or soft gradient,",
        "high contrast, no tiny unreadable text, no watermark, no mockup frame,",
        "simple memorable brand symbol, square composition, white or transparent-looking background.",
      ].join(" "),
    };
  }
  if (
    /фото|photo|photoreal|realistic|снимок|сурат|акс/i.test(raw) ||
    /фото|photo|photoreal|realistic|снимок|сурат|акс/i.test(base)
  ) {
    return {
      kind: "photo",
      prompt: `${base}. High quality, detailed, photorealistic when appropriate, sharp focus, natural lighting, no watermark.`,
    };
  }
  return {
    kind: "general",
    prompt: `${base}. High quality digital art, clear subject, vivid detail, no watermark.`,
  };
}

export function saveGeneratedImageToLibrary(url: string, prompt: string) {
  if (typeof window === "undefined") return;
  try {
    const item = {
      id: crypto.randomUUID(),
      url,
      prompt,
    };
    const raw = localStorage.getItem("nj_image_library_v1");
    const prev = raw ? (JSON.parse(raw) as unknown[]) : [];
    const list = Array.isArray(prev) ? prev : [];
    localStorage.setItem(
      "nj_image_library_v1",
      JSON.stringify([item, ...list].slice(0, 40)),
    );
  } catch {
    // ignore quota / private mode
  }
}
