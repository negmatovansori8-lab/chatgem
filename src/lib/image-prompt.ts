/** Shared helpers for ChatGem image / logo generation (ChatGPT-style intents). */

import {
  buildStrictEnglishPrompt,
  cleanImageSubject,
  resolveEnglishSubject,
} from "@/lib/image-subject";

/** JS `\b` ignores Cyrillic/Tajik — use Unicode letter boundaries instead. */
const EDGE = String.raw`(?:^|[^\p{L}\p{N}_])`;
const END = String.raw`(?=[^\p{L}\p{N}_]|$)`;

const LOGO_RE = new RegExp(
  String.raw`логотип|лагатип|лагтип|logotype|${EDGE}logo${END}|эмблем|брендинг|brand\s*mark|иконк`,
  "iu",
);

const IMAGE_NOUN_RE =
  /сурат|тасвир|акс|расм|фото|картинк|изображен|рисунок|снимок|picture|photo|image|illustration|artwork|drawing|арт(?=[^\p{L}\p{N}_]|$)/iu;

/** Clear “make / draw / generate” verbs (TG / RU / EN). */
const CREATE_VERB_RE = new RegExp(
  String.raw`${EDGE}(?:соз(?:ед|ӣ|и)?|сохта\s+диҳ|нарисуй(?:те)?|нарисовать|рисуй|создай|создать|сгенерируй|сгенерировать|сделай|сделать|хоҳам|мехоҳам|draw|generate|create|make|paint|sketch|render)${END}`,
  "iu",
);

const NEGATIVE_RE =
  /(?:сурат|тасвир|акс|фото|картинк\p{L}*|изображен\p{L}*|image|picture|photo)\s+(?:нест|не\s+вид|не\s+показ|не\s+отображ|не\s+работ)|(?:не\s+(?:вижу|показывает|отображается|работает)\s+(?:сурат|тасвир|акс|фото|картинк|изображен|image|picture|photo)|(?:image|picture|photo|сурат|тасвир)\s+(?:not\s+show|doesn'?t\s+show|isn'?t\s+show|missing|broken|won'?t\s+load)|(?:no\s+image|missing\s+image|broken\s+image|doesn'?t\s+show\s+(?:the\s+)?image))/iu;

const EXPLICIT_GENERATE_RE =
  /(?:^|[^\p{L}\p{N}_])(?:text[\s-]?to[\s-]?image|txt2img|dall-?e|midjourney|stable\s*diffusion)(?=[^\p{L}\p{N}_]|$)/iu;

const STARTS_CREATE_RE =
  /^(?:нарисуй(?:те)?|нарисовать|рисуй|создай|сгенерируй|сделай|draw|generate|create|make|paint|sketch|соз|тасвир\s*соз|акс\s*соз|сурат\s*соз|логотип\s*соз)(?=[^\p{L}\p{N}_]|$)/iu;

const SHORT_IMAGE_LINE_RE =
  /^(?:сурат|тасвир|акс|логотип|лагатип|фото|картинка|изображение|logo)(?=[^\p{L}\p{N}_]|$)/iu;

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

  // Fast path — no Unicode word-boundary tricks (must catch «Сурат соз: мошин»).
  if (
    /сурат\s*соз|тасвир\s*соз|акс\s*соз|логотип\s*соз|лагатип\s*соз|лагтип\s*соз|нарисуй|создай\s+(?:картин|изображ|фото|логотип)|сделай\s+(?:картин|изображ|фото|логотип)|сгенерируй\s+(?:картин|изображ|фото)|create\s+an?\s+image|create\s+a\s+(?:photo|logo)|generate\s+(?:an?\s+)?(?:image|photo|logo)|draw\s+(?:me\s+)?(?:an?\s+)?/i.test(
      t,
    )
  ) {
    return true;
  }

  if (EXPLICIT_GENERATE_RE.test(t)) return true;

  if (
    LOGO_RE.test(t) &&
    (CREATE_VERB_RE.test(t) ||
      /[:\-–]|для|барои|(?:^|[^\p{L}\p{N}_])for(?=[^\p{L}\p{N}_]|$)/iu.test(t) ||
      t.length < 80)
  ) {
    return true;
  }

  if (CREATE_VERB_RE.test(t) && (IMAGE_NOUN_RE.test(t) || LOGO_RE.test(t))) {
    return true;
  }

  if (STARTS_CREATE_RE.test(t)) return true;

  if (
    t.length < 160 &&
    SHORT_IMAGE_LINE_RE.test(t) &&
    /[:\-–]|соз|создай|сделай|generate|create|draw|барои|для|(?:^|[^\p{L}\p{N}_])for(?=[^\p{L}\p{N}_]|$)/iu.test(
      t,
    )
  ) {
    return true;
  }

  if (/(?:хоҳам|мехоҳам|хочу|want)/iu.test(t) && IMAGE_NOUN_RE.test(t)) {
    return true;
  }

  return false;
}

export function extractImagePrompt(text: string) {
  const cleaned = text
    .trim()
    .replace(
      /^(пожалуйста[,.]?\s*|please[,.]?\s*|ман\s+мехоҳам\s+(ки\s+)?|мехоҳам\s+(ки\s+)?|хоҳам\s+(ки\s+)?|can\s+you\s+|could\s+you\s+|please\s+)/iu,
      "",
    )
    .replace(
      /^(нарисуй(?:те)?|нарисовать|рисуй|создай\s+изображение|создай\s+картинку|создай\s+фото|создай\s+логотип|создай\s+лагатип|сгенерируй\s+изображение|сгенерируй\s+картинку|сделай\s+логотип|сделай\s+картинку|сделай\s+фото|сделай\s+изображение|generate\s+an?\s+image\s+of|generate\s+a\s+photo\s+of|generate\s+image|generate\s+a\s+logo|create\s+an?\s+image\s+of|create\s+a\s+photo\s+of|create\s+an?\s+image|create\s+a\s+logo|draw\s+(?:me\s+)?(?:an?\s+)?(?:image\s+of\s+)?|make\s+(?:me\s+)?(?:an?\s+)?(?:image\s+of\s+)?|paint|sketch|тасвир\s*соз|акс\s*соз|сурат\s*соз|логотип\s*соз|лагатип\s*соз|лагтип\s*соз|соз)[:\s-]*/iu,
      "",
    )
    .replace(/(?:^|[^\p{L}\p{N}_])(лагатип|лагтип)(?=[^\p{L}\p{N}_]|$)/giu, " логотип")
    .trim();
  return cleanImageSubject(cleaned || text.trim());
}

export function detectImageKind(raw: string): "logo" | "photo" | "general" {
  if (isLogoRequest(raw)) return "logo";
  if (/фото|photo|photoreal|realistic|снимок|сурат|акс/iu.test(raw)) {
    return "photo";
  }
  return "general";
}

/** Sync enhance (lexicon only) — prefer enhanceImagePromptAsync in the API. */
export function enhanceImagePrompt(raw: string): {
  prompt: string;
  kind: "logo" | "photo" | "general";
} {
  const kind = detectImageKind(raw);
  const base = extractImagePrompt(raw);
  const fromLexicon =
    base
      .replace(/мошин(?:а|ҳо|и)?/giu, "car")
      .replace(/машина(?:и|ы|у)?/giu, "car")
      .replace(/автомобил\w*/giu, "car") || base;
  return {
    kind,
    prompt: buildStrictEnglishPrompt(fromLexicon, kind),
  };
}

/** Async: translate TG/RU → English subject, then lock the prompt. */
export async function enhanceImagePromptAsync(raw: string): Promise<{
  prompt: string;
  kind: "logo" | "photo" | "general";
  subject: string;
}> {
  const kind = detectImageKind(raw);
  const extracted = extractImagePrompt(raw);
  const subject = await resolveEnglishSubject(extracted || raw);
  return {
    kind,
    subject,
    prompt: buildStrictEnglishPrompt(subject, kind),
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
