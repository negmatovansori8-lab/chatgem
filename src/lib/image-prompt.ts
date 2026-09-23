/** Shared helpers for ChatGem image / logo generation. */

const LOGO_RE =
  /логотип|лагатип|лагтип|logotype|\blogo\b|эмблем|брендинг|brand\s*mark|иконк/i;

const PHOTO_RE =
  /сурат|фото|photo|realistic|photoreal|снимок|расм|картинк|изображен|тасвир|акс|рисунок|нарисуй|picture|image/i;

const ACTION_RE =
  /соз|создай|сгенерир|нарисуй|generate|create|draw|make|хоҳам|мехоҳам|нужно|сделай/i;

export function isLogoRequest(text: string) {
  return LOGO_RE.test(text);
}

export function wantsImageGeneration(text: string) {
  const t = text.trim();
  if (!t) return false;
  if (LOGO_RE.test(t) || PHOTO_RE.test(t)) return true;
  if (
    /^(нарисуй|нарисовать|создай|сгенерируй|draw\s+|generate\s+|create\s+|тасвир|акс|логотип|лагатип|лагтип|сурат)/i.test(
      t,
    )
  ) {
    return true;
  }
  if (ACTION_RE.test(t) && (LOGO_RE.test(t) || PHOTO_RE.test(t))) return true;
  return /\b(dall-?e|text[\s-]?to[\s-]?image|txt2img)\b/i.test(t);
}

export function extractImagePrompt(text: string) {
  const cleaned = text
    .trim()
    .replace(
      /^(пожалуйста[,.]?\s*|ман\s+мехоҳам\s+(ки\s+)?|хоҳам\s+ки\s*)?/i,
      "",
    )
    .replace(
      /^(нарисуй|создай\s+изображение|создай\s+картинку|создай\s+логотип|создай\s+лагатип|сгенерируй\s+изображение|generate\s+an?\s+image\s+of|generate\s+image|create\s+an?\s+image\s+of|create\s+a\s+logo|draw|тасвир\s*соз|акс\s*соз|сурат\s*соз|логотип\s*соз|лагатип\s*соз|лагтип\s*соз|сделай\s+логотип|сделай\s+картинку)[:\s-]*/i,
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
    const subject = base
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
  if (PHOTO_RE.test(raw) || PHOTO_RE.test(base)) {
    return {
      kind: "photo",
      prompt: `${base}. High quality, detailed, photorealistic when appropriate, sharp focus, no watermark.`,
    };
  }
  return {
    kind: "general",
    prompt: `${base}. High quality digital art, clear subject, no watermark.`,
  };
}
