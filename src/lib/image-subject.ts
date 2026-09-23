/** Clean + translate image prompts so generators follow the user's subject. */

const FILLER_RE =
  /(?:^|[\s,])(?:ба\s+ман|барои\s+ман|лутфан|пожалуйста|please|for\s+me|мне|для\s+меня|ман\s+мехоҳам|мехоҳам|хоҳам|ки|that|я\s+хочу|хочу)(?=[\s,]|$)/giu;

const TRAILING_VERB_RE =
  /(?:^|[\s,])(?:соз(?:ед|ӣ|и)?|сохта\s+диҳ|сделай|создай|нарисуй|draw|make|create|generate)(?=[\s,]|$)/giu;

/** Common TG/RU → EN so models don't invent random people/scenes. */
const LEXICON: Array<[RegExp, string]> = [
  [/мошин(?:а|ҳо|и)?/giu, "car"],
  [/автомобил\w*/giu, "car"],
  [/машина(?:и|ы|у)?/giu, "car"],
  [/себ(?:ҳо|и)?/giu, "apple"],
  [/яблок\w*/giu, "apple"],
  [/гул(?:ҳо|и)?/giu, "flower"],
  [/цвет(?:ок|ы|а)?/giu, "flower"],
  [/кӯҳ(?:ҳо|и)?|кух(?:ҳо|и)?/giu, "mountain"],
  [/гор(?:а|ы|у)/giu, "mountain"],
  [/шаҳр(?:и|ҳо)?|город(?:а|у)?/giu, "city"],
  [/офтоб|солнце/giu, "sun"],
  [/моҳ|луна/giu, "moon"],
  [/гурба|кот(?:а|у)?|кошка/giu, "cat"],
  [/саг(?:и|ҳо)?|собак\w*/giu, "dog"],
  [/хона|дом(?:а|у)?/giu, "house"],
  [/одам|человек|девушка|женщина|мужчина/giu, "person"],
  [/логотип|лагатип|лагтип/giu, "logo"],
  [/сурат|тасвир|акс|расм|фото|картинк\w*|изображен\w*|рисунок/giu, ""],
  [/picture|photo|image|drawing/giu, ""],
];

export function cleanImageSubject(raw: string): string {
  let s = raw
    .trim()
    .replace(/^[:\-–\s]+/, "")
    .replace(FILLER_RE, " ")
    .replace(TRAILING_VERB_RE, " ")
    .replace(/[«»""]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Drop leftover punctuation-only crumbs
  s = s.replace(/^[,.:;!\-–]+|[,.:;!\-–]+$/g, "").trim();
  return s;
}

/** Fast dictionary pass — enough for short chat requests like «мошин». */
export function lexiconToEnglish(text: string): string {
  let s = cleanImageSubject(text);
  if (!s) return "";

  let out = s;
  for (const [re, en] of LEXICON) {
    out = out.replace(re, en ? ` ${en} ` : " ");
  }
  out = out.replace(/\s+/g, " ").trim();

  // If still mostly Cyrillic after lexicon, return cleaned original for LLM translate
  const cyrillic = (out.match(/[\u0400-\u04FF]/g) || []).length;
  const latin = (out.match(/[A-Za-z]/g) || []).length;
  if (cyrillic > latin && cyrillic > 2) {
    return "";
  }
  return out || "";
}

/**
 * Build a strict English prompt that locks the subject.
 * Models (esp. Pollinations) ignore vague TG/RU and invent faces.
 */
export function buildStrictEnglishPrompt(
  subjectEn: string,
  kind: "logo" | "photo" | "general",
): string {
  const subject = subjectEn.trim() || "the requested subject";
  const lock = [
    `Create exactly this subject: ${subject}.`,
    `The main focus MUST be: ${subject}.`,
    "Do not replace the subject with a different object or a random person.",
    "No watermark, no logo overlay, no text unless the subject is a logo.",
  ];

  if (kind === "logo") {
    return [
      `Professional app logo for "${subject}".`,
      "Clean modern vector-style mark, centered icon, flat or soft gradient,",
      "high contrast, simple memorable brand symbol, square composition,",
      "plain background, no mockup frame, no watermark, no tiny unreadable text.",
    ].join(" ");
  }

  if (kind === "photo") {
    return [
      ...lock,
      `Photorealistic photograph of ${subject}, sharp focus, natural lighting, detailed, high quality.`,
    ].join(" ");
  }

  return [
    ...lock,
    `High quality detailed image of ${subject}, clear composition, vivid detail.`,
  ].join(" ");
}

async function llmTranslateToEnglish(subject: string): Promise<string | null> {
  const cleaned = cleanImageSubject(subject);
  if (!cleaned) return null;

  const system = [
    "You convert user image requests into a short English subject for an image model.",
    "Output ONLY the English subject phrase (2–12 words). No quotes. No explanation.",
    "Examples: «мошин» → car | «ба ман мошини сурх соз» → red car | «логотип ChatGem» → ChatGem logo",
    "Keep the user's exact subject. Never invent a person if they did not ask for a person.",
  ].join("\n");

  const attempts: Array<{ url: string; key: string; model: string }> = [];
  const openai = process.env.OPENAI_API_KEY?.trim();
  const groq = process.env.GROQ_API_KEY?.trim();
  if (openai) {
    attempts.push({
      url: "https://api.openai.com/v1/chat/completions",
      key: openai,
      model: "gpt-4o-mini",
    });
  }
  if (groq) {
    attempts.push({
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: groq,
      model: "llama-3.1-8b-instant",
    });
  }

  for (const a of attempts) {
    try {
      const res = await fetch(a.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${a.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: a.model,
          temperature: 0,
          max_tokens: 60,
          messages: [
            { role: "system", content: system },
            { role: "user", content: cleaned },
          ],
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text && text.length < 200) {
        return text.replace(/^["'«»]+|["'«»]+$/g, "").trim();
      }
    } catch {
      // try next
    }
  }
  return null;
}

/** Resolve user text → English subject the image model must depict. */
export async function resolveEnglishSubject(rawUserText: string): Promise<string> {
  const fromLexicon = lexiconToEnglish(rawUserText);
  if (fromLexicon) return fromLexicon;

  const llm = await llmTranslateToEnglish(rawUserText);
  if (llm) return llm;

  // Last resort: cleaned original (better than sending full TG command soup)
  return cleanImageSubject(rawUserText) || "the subject the user described";
}
