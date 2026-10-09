/** Clean + translate image prompts so generators follow the user's subject. */

import { isAccountError, isProviderDown, markProviderDown } from "@/lib/provider-health";

const FILLER_RE =
  /(?:^|[\s,])(?:ба\s+ман|барои\s+ман|лутфан|пожалуйста|please|for\s+me|мне|для\s+меня|ман\s+мехоҳам|мехоҳам|хоҳам|ки|that|я\s+хочу|хочу)(?=[\s,]|$)/giu;

const TRAILING_VERB_RE =
  /(?:^|[\s,])(?:соз(?:ед|ӣ|и)?|сохта\s+диҳ|сделай|создай|нарисуй|draw|make|create|generate)(?=[\s,]|$)/giu;

/** Common TG/RU → EN so models don't invent random people/scenes. */
const LEXICON: Array<[RegExp, string]> = [
  [/ламборг(?:ини|ини|ин|ини)?/giu, "Lamborghini"],
  [/lamborghini/giu, "Lamborghini"],
  [/ferrari/giu, "Ferrari"],
  [/porsche/giu, "Porsche"],
  [/bugatti/giu, "Bugatti"],
  [/mercedes[-\s]?benz|мерседес/giu, "Mercedes-Benz"],
  [/bmw|бмв/giu, "BMW"],
  [/audi|ауди/giu, "Audi"],
  [/tesla|тесла/giu, "Tesla"],
  [/toyota|тойота/giu, "Toyota"],
  [/c[\s-]?63\s*s?/giu, "C63 S"],
  [/мошин(?:а|ҳо|и)?/giu, "car"],
  [/автомобил\p{L}*/giu, "car"],
  [/машин\p{L}*/giu, "car"],
  [/себ(?:ҳо|и)?/giu, "apple"],
  [/яблок\p{L}*/giu, "apple"],
  [/гул(?:ҳо|и)?/giu, "flower"],
  [/цвет(?:ок|ы|а)?/giu, "flower"],
  [/кӯҳ(?:ҳо|и)?|кух(?:ҳо|и)?/giu, "mountain"],
  [/гор(?:а|ы|у)/giu, "mountain"],
  [/шаҳр(?:и|ҳо)?|город(?:а|у)?/giu, "city"],
  [/офтоб|солнце/giu, "sun"],
  [/моҳ|луна/giu, "moon"],
  [/гурба|кот(?:а|у)?|кошка/giu, "cat"],
  [/саг(?:и|ҳо)?|собак\p{L}*/giu, "dog"],
  [/хона|дом(?:а|у)?/giu, "house"],
  [/одам|человек|девушка|женщина|мужчина/giu, "person"],
  [/(?<!\p{L})зан(?:и|е|он|ҳо|ро)?(?!\p{L})/giu, "woman"],
  [/(?<!\p{L})мард(?:и|е|он|ҳо|ро)?(?!\p{L})/giu, "man"],
  [/(?<!\p{L})духтар\p{L}*/giu, "girl"],
  [/(?<!\p{L})писар\p{L}*/giu, "boy"],
  [/(?<!\p{L})кӯдак\p{L}*/giu, "child"],
  [/(?<!\p{L})харит\p{L}*/giu, "map"],
  [/(?<!\p{L})иконк\p{L}*/giu, "icon"],
  [/(?<!\p{L})(?:плакат|постер)\p{L}*/giu, "poster"],
  [/(?<!\p{L})асп(?:и|ҳо)?(?!\p{L})/giu, "horse"],
  [/паранда\p{L}*|мурғ\p{L}*/giu, "bird"],
  [/дарахт\p{L}*/giu, "tree"],
  [/баҳр\p{L}*|дарё\p{L}*/giu, "sea"],
  [/сафед\p{L}*/giu, "white"],
  [/сиёҳ\p{L}*|сиёх\p{L}*/giu, "black"],
  [/сурх\p{L}*/giu, "red"],
  [/кабуд\p{L}*/giu, "blue"],
  [/сабз\p{L}*/giu, "green"],
  [/зард\p{L}*/giu, "yellow"],
  [/зебо\p{L}*/giu, "beautiful"],
  [/калон\p{L}*/giu, "big"],
  [/парчам\p{L}*|байрақ\p{L}*|байрак\p{L}*|флаг\p{L}*/giu, "flag"],
  [/[тt][оo][ҷч]ики?сто\p{L}*|таджикистан\p{L}*/giu, "Tajikistan"],
  [/[тt][оo][ҷч]ик\p{L}*|таджик\p{L}*/giu, "Tajik"],
  [/дар\s+са[тҳх]+и\s+[ҷч]а[ҳх]он\p{L}*|на\s+мировом\s+уровне|мирового\s+уровня/giu, "world-class"],
  [/[ҷч]а[ҳх]он[ӣи]|мирово\p{L}*/giu, "world-class"],
  [/[лд][оаo]г[оаoы]?т+[иыі]?[пб]+\p{L}*|логип\p{L}*|лоғотип\p{L}*|logotip\p{L}*|logatip\p{L}*/giu, "logo"],
  [/сурат(?:и|ҳо)?|тасвир(?:и|ҳо)?|акс(?:и|ҳо)?|расм(?:и|ҳо)?|фото|картинк\p{L}*|изображен\p{L}*|рисунок/giu, ""],
  [/picture|photo|image|drawing/giu, ""],
  [/барои\s+ман|ба\s+ман/giu, ""],
  [/соз(?:ед|ӣ|и)?/giu, ""],
  [/нарисуй(?:те)?|создай|сделай|сгенерируй/giu, ""],
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
  const s = cleanImageSubject(text);
  if (!s) return "";

  let out = s;
  for (const [re, en] of LEXICON) {
    out = out.replace(re, en ? ` ${en} ` : " ");
  }
  // Tajik izofa / Russian conjunction crumbs left after a word was translated («гурбаи» → "cat и").
  out = out.replace(/(^|\s)[\u0400-\u04FF](?=\s|$)/gu, " ").replace(/\s+/g, " ").trim();

  // Any untranslated Tajik/Russian words go to the LLM translator — Flux draws random people for them.
  const cyrillic = (out.match(/[\u0400-\u04FF]/g) || []).length;
  if (cyrillic > 2) return "";
  return describeKnownSubject(out);
}

/** Flux does not know national symbols — spell out what must be drawn. */
const KNOWN_SUBJECTS: Array<[RegExp, string]> = [
  [
    /\btajik(?:istan)?\b.*\bflag\b|\bflag\b.*\btajik(?:istan)?\b/i,
    "Tajikistan flag: horizontal red, wide white and green stripes, golden crown under an arc of seven golden stars in the centre",
  ],
  [
    /\b(?:logo|emblem)\b.*\btajik(?:istan)?\b|\btajik(?:istan)?\b.*\b(?:logo|emblem)\b/i,
    "Tajikistan emblem: golden crown under an arc of seven golden stars above stylized snowy mountains, red white green accent",
  ],
];

export function describeKnownSubject(subject: string): string {
  const s = subject.trim();
  for (const [re, description] of KNOWN_SUBJECTS) {
    if (re.test(s) && !s.includes(description)) {
      const extra = s.replace(/\b(?:tajik(?:istan)?|flag|of|the|national|emblem)\b/gi, " ").replace(/\s+/g, " ").trim();
      return [description, extra].filter(Boolean).join(", ");
    }
  }
  return s;
}

/**
 * Build a strict English prompt that locks the subject.
 * Subject FIRST — Flux/Pollinations often ignore long trailing instructions.
 */
export function buildStrictEnglishPrompt(
  subjectEn: string,
  kind: "logo" | "photo" | "general",
): string {
  const subject = subjectEn.trim() || "the requested subject";
  const antiPerson =
    /\b(car|vehicle|lamborghini|ferrari|porsche|bmw|mercedes|audi|tesla|toyota|c63|house|mountain|flower|city|logo|apple|dog|cat|sun|moon)\b/i.test(
      subject,
    )
      ? "no person, no face, no portrait, no tablet, no phone, no screen, no human model"
      : "do not replace with a different subject, no tablet, no phone screen";

  if (kind === "logo") {
    if (/^chatgem$/i.test(subject.trim())) {
      return [
        "ChatGem AI brand logo",
        "luminous gem crystal fused with Earth globe",
        "modern world-class tech identity mark",
        "flat vector, centered, deep navy background",
        "electric blue and teal glow, premium clean",
        "optional tiny ChatGem wordmark only",
        "no photo mockup, no phone, no watermark, no random letters like C03",
      ].join(", ");
    }
    return [
      `professional logo for ${subject}`,
      "clean modern vector brand mark, centered, plain background",
      "high contrast, world-class identity design",
      "no mockup, no phone frame, no watermark, no gibberish text",
      antiPerson,
    ].join(", ");
  }

  if (kind === "photo" || /\b(car|mercedes|bmw|ferrari|lamborghini|audi|tesla|toyota|c63)\b/i.test(subject)) {
    return [
      subject,
      `photorealistic photograph of a real ${subject}`,
      "full vehicle visible, outdoor or studio, three-quarter view",
      "cinematic lighting, sharp detail, professional automotive photography",
      antiPerson,
      "no watermark, no text overlay, no UI",
    ].join(", ");
  }

  return [
    subject,
    `high quality artwork of ${subject} as the clear main focus`,
    antiPerson,
    "beautiful lighting, polished finish, no watermark",
  ].join(", ");
}

type LlmEndpoint = {
  /** Key in provider-health: "openai" | "google" | "groq". */
  provider: string;
  label: string;
  url: string;
  key: string;
  model: string;
  /** Reasoning models spend completion tokens on thinking before the answer. */
  reasoning?: boolean;
};

/** Same providers and models the chat uses — retired model ids fail silently and leave prompts untranslated. */
function imageLlmEndpoints(): LlmEndpoint[] {
  const list: LlmEndpoint[] = [];
  const openai = process.env.OPENAI_API_KEY?.trim();
  const google = process.env.GOOGLE_AI_API_KEY?.trim();
  const groq = process.env.GROQ_API_KEY?.trim();
  if (openai && !isProviderDown("openai")) {
    list.push({ provider: "openai", label: "OpenAI", url: "https://api.openai.com/v1/chat/completions", key: openai, model: "gpt-4o-mini" });
  }
  if (google && !isProviderDown("google")) {
    list.push({
      provider: "google",
      label: "Gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: google,
      model: process.env.GOOGLE_AI_MODEL?.trim() || "gemini-flash-latest",
    });
  }
  if (groq && !isProviderDown("groq")) {
    for (const model of ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]) {
      list.push({ provider: "groq", label: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", key: groq, model, reasoning: true });
    }
  }
  return list;
}

export function hasImageLlm(): boolean {
  return imageLlmEndpoints().length > 0;
}

export async function imageLlm(
  system: string,
  user: string,
  opts: { maxTokens: number; temperature: number; timeoutMs: number; accept: (text: string) => boolean },
): Promise<string | null> {
  for (const a of imageLlmEndpoints()) {
    try {
      const res = await fetch(a.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${a.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: a.model,
          temperature: opts.temperature,
          max_tokens: a.reasoning ? opts.maxTokens + 600 : opts.maxTokens,
          ...(a.reasoning ? { reasoning_effort: "low" } : {}),
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
      if (!res.ok) {
        console.warn(`[image-llm] ${a.label} ${a.model}: HTTP ${res.status}`);
        const body = await res.text().catch(() => "");
        if (isAccountError(res.status, body)) markProviderDown(a.provider, `${res.status} ${body}`);
        continue;
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content
        ?.replace(/<think>[\s\S]*?<\/think>/g, "")
        .trim();
      if (text && opts.accept(text)) return text;
      console.warn(`[image-llm] ${a.label} ${a.model}: unusable reply`);
    } catch (error) {
      console.warn(`[image-llm] ${a.label} ${a.model}: ${error instanceof Error ? error.name : "failed"}`);
    }
  }
  return null;
}

const CYRILLIC_RE = /[\u0400-\u04FF]/;

/** LLM expands a short subject into a world-class DALL·E brief (English). */
export async function enrichWorldClassBrief(
  subject: string,
  kind: "logo" | "photo" | "general",
): Promise<string> {
  const base = buildStrictEnglishPrompt(subject, kind);
  if (!imageLlmEndpoints().length) return base;

  const { creativeEnhanceSystem } = await import("@/lib/creative-brief");
  const mode =
    kind === "logo" ? "logo" : kind === "photo" ? "photo" : "general";
  const system = creativeEnhanceSystem(mode);

  const user = [
    `Kind: ${kind}`,
    `User idea: ${subject}`,
    "Write one premium English image prompt a top creative studio would paste into DALL·E.",
    "Include lighting, materials, composition, and finish. Keep the subject exact.",
  ].join("\n");

  const text = await imageLlm(system, user, {
    maxTokens: 220,
    temperature: 0.55,
    timeoutMs: 18_000,
    accept: (t) => t.length > 28 && t.length < 900 && !CYRILLIC_RE.test(t),
  });
  if (!text) return base;
  const cleaned = text
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(prompt\s*:|here(?:'s| is)\s*:)/i, "")
    .trim();
  return `${cleaned} — Subject lock: ${subject}. No watermark.`;
}

async function llmTranslateToEnglish(subject: string): Promise<string | null> {
  const cleaned = cleanImageSubject(subject);
  if (!cleaned) return null;

  const system = [
    "You convert user image requests into a short English subject for an image model.",
    "Output ONLY the English subject phrase (2–12 words). No quotes. No explanation.",
    "The request may be Russian or Tajik (Persian written in Cyrillic): гурба = cat, саг = dog, асп = horse, кӯҳ = mountain, сафед = white, сурх = red.",
    "Examples: «мошин» → car | «ба ман мошини ламборгини соз» → Lamborghini car | «гурбаи сафед» → white cat | «логотип ChatGem» → ChatGem logo",
    "Keep the user's exact subject. Never invent a person if they did not ask for a person.",
  ].join("\n");

  const text = await imageLlm(system, cleaned, {
    maxTokens: 60,
    temperature: 0,
    timeoutMs: 15_000,
    accept: (t) => t.length < 200 && !CYRILLIC_RE.test(t),
  });
  return text ? text.replace(/^["'«»]+|["'«»]+$/g, "").trim() : null;
}

/** Resolve user text → English subject the image model must depict. */
export async function resolveEnglishSubject(rawUserText: string): Promise<string> {
  const fromLexicon = lexiconToEnglish(rawUserText);
  if (fromLexicon) return fromLexicon;

  const llm = await llmTranslateToEnglish(rawUserText);
  if (llm) return describeKnownSubject(llm);

  // Last resort: cleaned original (better than sending full TG command soup)
  return cleanImageSubject(rawUserText) || "the subject the user described";
}
