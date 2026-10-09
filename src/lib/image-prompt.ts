/** Shared helpers for ChatGem image / logo generation (ChatGPT-style intents). */

import {
  buildStrictEnglishPrompt,
  cleanImageSubject,
  enrichWorldClassBrief,
  lexiconToEnglish,
  resolveEnglishSubject,
} from "@/lib/image-subject";

/** JS `\b` ignores Cyrillic/Tajik — use Unicode letter boundaries instead. */
const EDGE = String.raw`(?:^|[^\p{L}\p{N}_])`;
const END = String.raw`(?=[^\p{L}\p{N}_]|$)`;

/** Typed fast: «логатппи», «лаготип», «логтип», «логотибро». */
export const LOGO_TYPO = String.raw`[лд][оаo]г[оаoы]?т+[иыі]?[пб]+`;

const LOGO_RE = new RegExp(
  String.raw`${LOGO_TYPO}|логип|лоғотип|logotip|logotype|logatip|${EDGE}logo${END}|эмблем|брендинг|brand\s*mark|иконк`,
  "iu",
);

const IMAGE_NOUN_RE =
  /сурат|тасвир|акс|расм|фото|картинк|изображен|рисунок|снимок|picture|photo|image|illustration|artwork|drawing|арт(?=[^\p{L}\p{N}_]|$)|wallpaper|poster|баннер/iu;

/** Clear “make / draw / generate” verbs (TG / RU / EN). Not «соз кунад» (3rd person). */
const CREATE_VERB_RE = new RegExp(
  String.raw`${EDGE}(?:соз(?:ед|ӣ|и)?(?!\s*кун)|сохта\s+диҳ|нарисуй(?:те)?|нарисовать|рисуй|создай|создать|сгенерируй|сгенерировать|сделай|сделать|draw|generate|create|make|paint|sketch|render)${END}`,
  "iu",
);

/** Visual subjects — cars, animals, places, people, brands (no image noun needed). */
const VISUAL_SUBJECT_RE =
  /мошин|машина|автомобил|ламборг|lamborghini|ferrari|porsche|bmw|mercedes|benz|audi|toyota|tesla|bugatti|c63|гул|цвет|кӯҳ|кух|гор[аыу]|шаҳр|город|хона|дом|гурба|кот|кошка|саг|собак|одам|человек|девушк|женщин|мужчин|портрет|portrait|пейзаж|landscape|табиат|природ|nature|animal|ҳайвон|животн|бино|здани|building|архитек|food|хӯрок|еда|fashion|либос|одежд|product|маҳсул|товар|fantasy|anime|cartoon|sci-?fi|робот|robot|дракон|dragon|замок|castle|океан|ocean|beach|пляж|forest|ҷангал|лес|sunset|офтоб|моҳ|moon|sun|city|car|house|dog|cat|person|woman|man|girl|boy|flower|mountain|logo|wallpaper|poster|3d|cinematic|concept\s*art|харит|карт[аеуы](?!\p{L})|(?<!\p{L})maps?(?!\p{L})|парчам|байра[қк]|флаг|(?<!\p{L})flags?(?!\p{L})|иконк|(?<!\p{L})icons?(?!\p{L})|плакат|постер|баннер|герб|emblem/iu;

/** Writing/code — do NOT treat as image. */
const NON_IMAGE_RE =
  /(?:^|[^\p{L}\p{N}_])(?:код|code|скрипт|script|функсия|function|мақола|статья|essay|ҳикоя|рассказ|письмо|email|резюме|resume|перевед|translate|ҳисоб|solve|математик|формул)(?=[^\p{L}\p{N}_]|$)/iu;

/** Software products — «сайти қаҳвахона соз» is a build request, not a picture of a house. */
const SOFTWARE_RE = new RegExp(
  String.raw`${EDGE}(?:сайт\p{L}*|вебсайт\p{L}*|веб-сайт\p{L}*|website\p{L}*|web\s*app\p{L}*|app|apps|application|приложени\p{L}*|барнома\p{L}*|лендинг\p{L}*|landing\s+page|бот|бот[иаы]\p{L}*|bot|dashboard|дашборд\p{L}*|saas|crm|портал\p{L}*|маркетплейс\p{L}*|marketplace|интернет-магазин\p{L}*|online\s+store)${END}`,
  "iu",
);

/** Word-initial image nouns — «такси» must not count as «акс». */
const IMAGE_WORD_RE = new RegExp(
  String.raw`${EDGE}(?:сурат|тасвир|акс|расм|фото|картинк|изображен|рисунок|picture|photo|image|illustration|artwork|drawing|wallpaper|poster|баннер|banner|мокап|mockup|иконк|icon|плакат|постер)`,
  "iu",
);

const NEGATIVE_RE =
  /(?:сурат|тасвир|акс|фото|картинк\p{L}*|изображен\p{L}*|image|picture|photo)\s+(?:нест|не\s+вид|не\s+показ|не\s+отображ|не\s+работ)|(?:не\s+(?:вижу|показывает|отображается|работает)\s+(?:сурат|тасвир|акс|фото|картинк|изображен|image|picture|photo)|(?:image|picture|photo|сурат|тасвир)\s+(?:not\s+show|doesn'?t\s+show|isn'?t\s+show|missing|broken|won'?t\s+load)|(?:no\s+image|missing\s+image|broken\s+image|doesn'?t\s+show\s+(?:the\s+)?image))/iu;

/**
 * User wants TEXT help (a prompt, advice, Q&A) — never auto-generate an image.
 * e.g. «ба ман як промт диҳ барои Cursor то ки аксҳояшро соз кунад»
 */
const ASKS_TEXT_NOT_IMAGE_RE = new RegExp(
  String.raw`${EDGE}(?:промт|промпт|prompt)${END}|` +
    String.raw`(?:ба\s+ман|барои\s+ман|мне|give\s+me|дай|диҳ(?:ед)?|напиши|write)\s+(?:як\s+|a\s+|an?\s+)?(?:промт|промпт|prompt)|` +
    String.raw`барои\s+(?:курсор|cursor|midjourney|stable\s*diffusion|dall-?e|chatgpt|claude)|` +
    String.raw`for\s+(?:cursor|midjourney|stable\s*diffusion|dall-?e)|` +
    String.raw`чӣ\s*тавр\s+(?:акс|сурат|тасвир|лого|промт|промпт)|` +
    String.raw`how\s+(?:do\s+i|to)\s+(?:write|make|create)\s+(?:a\s+)?prompt|` +
    String.raw`как\s+(?:написать|составить|сделать)\s+промпт|` +
    String.raw`савол\s+дорам|помоги\s+с\s+промпт|explain\s+(?:how|what)`,
  "iu",
);

/** Purpose / 3rd person — «то ки … соз кунад», not an order for ChatGem to draw now. */
const PURPOSE_OR_THIRD_CREATE_RE =
  /то\s+ки|чтобы|so\s+that|соз\s*кунад|созад(?=[^\p{L}]|$)|созда[её]т|сделает/iu;

const EXPLICIT_GENERATE_RE =
  /(?:^|[^\p{L}\p{N}_])(?:text[\s-]?to[\s-]?image|txt2img|dall-?e|midjourney|stable\s*diffusion)(?=[^\p{L}\p{N}_]|$)/iu;

const STARTS_CREATE_RE =
  /^(?:нарисуй(?:те)?|нарисовать|рисуй|создай|сгенерируй|сделай|draw|generate|create|make|paint|sketch|соз|тасвир\s*соз|акс\s*соз|сурат\s*соз|логотип\s*соз)(?=[^\p{L}\p{N}_]|$)/iu;

const SHORT_IMAGE_LINE_RE =
  /^(?:сурат|тасвир|акс|логотип|лагатип|лагтип|догатип|фото|картинка|изображение|logo)(?=[^\p{L}\p{N}_]|$)/iu;

/** A design brief that opens with the thing to draw: «Логотипи харитаи Тоҷикистон бо …». */
const LEADING_DESIGN_NOUN_RE = new RegExp(
  String.raw`^(?:${LOGO_TYPO}\p{L}*|логип\p{L}*|лоғотип\p{L}*|logo(?:type)?|эмблем\p{L}*|emblem|сурат\p{L}*|тасвир\p{L}*|расм\p{L}*|картинк\p{L}*|изображени\p{L}*|рисун\p{L}*|постер\p{L}*|плакат\p{L}*|poster|баннер\p{L}*|banner|иконк\p{L}*|icon|illustration|picture|image)${END}`,
  "iu",
);
const QUESTION_OR_PROBLEM_RE = new RegExp(
  String.raw`\?|${EDGE}(?:чӣ|чи|чаро|кадом|чист|куҷо|кучо|чӣ\s+тавр|савол\p{L}*|пурсам|пурсед|бидон\p{L}*|фаҳмон\p{L}*|ҷавоб\p{L}*|что|как|почему|зачем|где|какой|what|why|how|where|which|нест|намоён|намешавад|намекунад|не\s+работ\p{L}*|не\s+показ\p{L}*|not\s+work\p{L}*|broken|хато|ошибк\p{L}*|error)${END}`,
  "iu",
);

/** Clear “draw this now”, even if the sentence also has a question word. */
const EXPLICIT_CREATE_NOW_RE =
  /сурат\s*соз(?!\s*кун)|тасвир\s*соз(?!\s*кун)|акс\s*соз(?!\s*кун)|(?:логотип|логатип|лагатип|лагтип|логип|лоғотип|logo)\s*соз|соз\s*(?:логотип|логатип|лагатип|logo)|нарисуй|создай\s+(?:картин|изображ|фото|логотип)|сделай\s+(?:картин|изображ|фото|логотип)|create\s+(?:an?\s+)?(?:image|photo|logo)|generate\s+(?:an?\s+)?(?:image|photo|logo)|draw\s+/iu;

const TJ_SHAPE_RE = new RegExp(
  String.raw`(?:тоҷикисто|точикисто|таджикиста|tajikista|tojikisto)\p{L}*`,
  "iu",
);
const OUTLINE_RE = new RegExp(
  String.raw`${EDGE}(?:харит\p{L}*|харта\p{L}*|карт[аеуыо]\p{L}*|maps?|силуэт\p{L}*|silhouette|контур\p{L}*|outline|шакл\p{L}*|${LOGO_TYPO}\p{L}*|логип\p{L}*|лоғотип\p{L}*|logo\p{L}*|эмблем\p{L}*|emblem)${END}`,
  "iu",
);
const FLAG_COLOURS_RE = new RegExp(
  String.raw`${EDGE}(?:парчам\p{L}*|байрақ\p{L}*|флаг\p{L}*|flag\p{L}*)${END}|${EDGE}(?:сурх|красн|red)[\s\S]{0,120}${EDGE}(?:сабз|зел[её]н|green)`,
  "iu",
);

/** Tajikistan's outline painted in the flag: «харитаи Тоҷикистон бо рангҳои парчам», "map of Tajikistan in the flag colors". */
export function isTajikistanFlagMapRequest(text: string): boolean {
  return TJ_SHAPE_RE.test(text) && OUTLINE_RE.test(text) && FLAG_COLOURS_RE.test(text);
}

/** «ба ман … соз», «for me … make», trailing соз on short visual asks */
const FOR_ME_CREATE_RE =
  /(?:ба\s+ман|барои\s+ман|for\s+me|мне|для\s+меня).{0,100}(?:соз(?:ед|ӣ|и)?|сделай|создай|нарисуй|draw|make|create|generate)|(?:соз(?:ед|ӣ|и)?|сделай|создай|нарисуй)\s+(?:ба\s+ман|барои\s+ман|for\s+me|мне)/iu;

const ENDS_CREATE_RE = /(?:соз(?:ед|ӣ|и)?|нарисуй|сделай|создай|draw|make|generate)[.!?…]*$/iu;

export function isLogoRequest(text: string) {
  const t = text.trim();
  if (LOGO_RE.test(t)) return true;
  // Bare «соз» after logo intent / short create → treat as logo job
  if (/^соз(?:ед|ӣ|и)?[.!?…]*$/iu.test(t)) return true;
  return false;
}

/** World-class default when user says «логотип соз» / «соз» with no brand name. */
export const DEFAULT_CHATGEM_LOGO_SUBJECT = "ChatGem";

export const DEFAULT_CHATGEM_LOGO_PROMPT = [
  "ChatGem AI brand logo",
  "luminous gem crystal fused with Earth globe",
  "modern world-class tech identity mark",
  "flat vector, centered, deep navy background",
  "electric blue and teal glow, premium clean",
  "optional tiny ChatGem wordmark only",
  "no photo mockup, no phone, no watermark, no random letters",
].join(", ");

export function resolveLogoSubject(subject: string): string {
  const s = subject.trim();
  if (
    !s ||
    /^(logo|логотип|логатип|лагатип|логтип|соз|create|make|generate|нарисуй)$/iu.test(
      s,
    )
  ) {
    return DEFAULT_CHATGEM_LOGO_SUBJECT;
  }
  return s.slice(0, 120);
}

/**
 * A question or “explain this” — answer in text.
 * «логотип соз» / «сурат соз» still count as create-now.
 */
export function isPlainQuestion(text: string) {
  const t = text.trim();
  if (!t || !QUESTION_OR_PROBLEM_RE.test(t)) return false;
  if (EXPLICIT_CREATE_NOW_RE.test(t)) return false;
  if (STARTS_CREATE_RE.test(t)) return false;
  if (
    FOR_ME_CREATE_RE.test(t) &&
    (VISUAL_SUBJECT_RE.test(t) || IMAGE_NOUN_RE.test(t) || LOGO_RE.test(t))
  ) {
    return false;
  }
  return true;
}

/**
 * ChatGPT-like: trigger generation on clear create/draw intents,
 * including «БА МАН МОШИНИ ЛАМБАРЧИНИ СОЗ» (visual subject + create verb).
 */
export function wantsImageGeneration(text: string) {
  const t = text.trim();
  if (!t || t.length > 2000) return false;
  if (NEGATIVE_RE.test(t)) return false;
  if (isPlainQuestion(t)) return false;
  // «Промт диҳ», questions, prompts for Cursor — answer in text, do not draw.
  if (ASKS_TEXT_NOT_IMAGE_RE.test(t)) return false;
  if (PURPOSE_OR_THIRD_CREATE_RE.test(t) && !/^(?:сурат|тасвир|акс|логотип)\s*соз/iu.test(t)) {
    // «то ки акс соз кунад» is purpose, not «акс соз» directed at us
    if (!/(?:ба\s+ман|барои\s+ман|for\s+me).{0,80}(?:сурат|тасвир|акс|логотип|мошин).{0,40}(?:соз(?:ед|ӣ|и)?|нарисуй|сделай)(?:\s|$|[.!?])/iu.test(t)) {
      return false;
    }
  }
  if (NON_IMAGE_RE.test(t) && !IMAGE_NOUN_RE.test(t) && !LOGO_RE.test(t)) {
    return false;
  }
  if (SOFTWARE_RE.test(t) && !IMAGE_WORD_RE.test(t) && !LOGO_RE.test(t)) {
    return false;
  }

  // Fast path — logo create (typos: логатип, логип)
  if (
    /(?:логотип|логатип|лагатип|лагтип|логип|лоғотип|logo)\s*соз|соз\s*(?:логотип|логатип|лагатип|logo)|создай\s+логотип|сделай\s+логотип|create\s+(?:a\s+)?logo|generate\s+(?:a\s+)?logo|logo\s*соз/i.test(
      t,
    )
  ) {
    return true;
  }

  // Bare «СОЗ» → create (logo default), not a question
  if (/^соз(?:ед|ӣ|и)?[.!?…]*$/iu.test(t)) return true;

  // Fast path — no Unicode word-boundary tricks (must catch «Сурат соз: мошин»).
  // Do not treat «аксҳояшро соз кунад» (3rd person) as generate-now.
  if (
    /сурат\s*соз(?!\s*кун)|тасвир\s*соз(?!\s*кун)|акс\s*соз(?!\s*кун)|нарисуй|создай\s+(?:картин|изображ|фото)|сделай\s+(?:картин|изображ|фото)|сгенерируй\s+(?:картин|изображ|фото)|create\s+an?\s+image|create\s+a\s+photo|generate\s+(?:an?\s+)?(?:image|photo)|draw\s+(?:me\s+)?(?:an?\s+)?/i.test(
      t,
    )
  ) {
    return true;
  }

  if (EXPLICIT_GENERATE_RE.test(t)) return true;

  // «ба ман мошини ламборгини соз» / «make me a lamborghini»
  if (FOR_ME_CREATE_RE.test(t) && t.length < 280) {
    if (VISUAL_SUBJECT_RE.test(t) || IMAGE_NOUN_RE.test(t) || LOGO_RE.test(t)) {
      return true;
    }
    // Short “for me … make” with any concrete noun left after cleaning
    if (t.length < 100 && ENDS_CREATE_RE.test(t)) return true;
  }

  // Create verb + visual subject (car, animal, place…) — no image noun required
  if (
    CREATE_VERB_RE.test(t) &&
    VISUAL_SUBJECT_RE.test(t) &&
    t.length < 280
  ) {
    return true;
  }

  // Short line ending with соз / make + looks visual
  if (
    t.length < 160 &&
    ENDS_CREATE_RE.test(t) &&
    (VISUAL_SUBJECT_RE.test(t) || IMAGE_NOUN_RE.test(t) || LOGO_RE.test(t))
  ) {
    return true;
  }

  if (
    LOGO_RE.test(t) &&
    (CREATE_VERB_RE.test(t) ||
      /[:\-–]|для|барои|(?:^|[^\p{L}\p{N}_])for(?=[^\p{L}\p{N}_]|$)/iu.test(t) ||
      (t.length < 80 && !QUESTION_OR_PROBLEM_RE.test(t)))
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

  if (!QUESTION_OR_PROBLEM_RE.test(t)) {
    if (LEADING_DESIGN_NOUN_RE.test(t)) return true;
    if (isTajikistanFlagMapRequest(t)) return true;
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
    .replace(new RegExp(String.raw`(?:^|[^\p{L}\p{N}_])(?:${LOGO_TYPO}\p{L}*|logotip\p{L}*)`, "giu"), " логотип")
    .trim();
  return cleanImageSubject(cleaned || text.trim());
}

export function detectImageKind(raw: string): "logo" | "photo" | "general" {
  if (isLogoRequest(raw)) return "logo";
  if (
    /фото|photo|photoreal|realistic|снимок|сурат|акс|мошин|машин|автомобил|ламборг|lamborghini|ferrari|portrait|пейзаж|landscape|табиат|природ/iu.test(
      raw,
    )
  ) {
    return "photo";
  }
  return "general";
}

/** Infer style from prompt so cars/cinematic/anime get the right look. */
export function detectImageStyle(
  raw: string,
):
  | "auto"
  | "photo"
  | "cinematic"
  | "illustration"
  | "3d"
  | "product"
  | "concept"
  | "poster"
  | "anime"
  | "fantasy"
  | "scifi" {
  const t = raw.toLowerCase();
  if (/anime|аниме|manga|манга/i.test(t)) return "anime";
  if (/fantasy|фэнтези|фэнтези|афсона|дракон|dragon|замок|elf/i.test(t)) {
    return "fantasy";
  }
  if (/sci-?fi|киберпанк|cyberpunk|робот|spaceship|космос/i.test(t)) {
    return "scifi";
  }
  if (/3d|render|octane|blender/i.test(t)) return "3d";
  if (/poster|плакат|баннер/i.test(t)) return "poster";
  if (/product|маҳсул|каталог|packaging/i.test(t)) return "product";
  if (/concept\s*art|концепт/i.test(t)) return "concept";
  if (/illustration|иллюстр|расм\s*каш|digital\s*art/i.test(t)) {
    return "illustration";
  }
  if (
    /cinematic|кино|фильм|dramatic|мошин|машина|ламборг|lamborghini|ferrari|car\b/i.test(
      t,
    )
  ) {
    return "cinematic";
  }
  if (/фото|photo|realistic|портрет|portrait|пейзаж|landscape/i.test(t)) {
    return "photo";
  }
  return "auto";
}

/** True when prompt is already English art direction (gallery builders). */
export function isMostlyEnglishPrompt(text: string) {
  const cyr = (text.match(/[\u0400-\u04FF]/g) || []).length;
  const lat = (text.match(/[A-Za-z]/g) || []).length;
  return lat >= 24 && lat > cyr * 3;
}

/**
 * Sync enhance: TG/RU → English subject lock.
 * Never send raw Tajik commands to Flux (it invents random people).
 */
export function enhanceImagePrompt(raw: string): {
  prompt: string;
  kind: "logo" | "photo" | "general";
  subject: string;
} {
  const kind = detectImageKind(raw);
  const extracted = extractImagePrompt(raw);
  const fromLex =
    lexiconToEnglish(extracted || raw) ||
    lexiconToEnglish(raw) ||
    extracted ||
    raw.trim();

  if (kind === "logo") {
    const subject = resolveLogoSubject(fromLex);
    if (subject === DEFAULT_CHATGEM_LOGO_SUBJECT) {
      return {
        kind: "logo",
        subject,
        prompt: DEFAULT_CHATGEM_LOGO_PROMPT,
      };
    }
    return {
      kind: "logo",
      subject,
      prompt: buildStrictEnglishPrompt(subject, "logo"),
    };
  }

  const subject = (fromLex || "the requested subject").trim().slice(0, 160);
  return {
    kind,
    subject,
    prompt: buildStrictEnglishPrompt(subject, kind),
  };
}

/** Async: translate TG/RU → English subject, then lock a world-class prompt. */
export async function enhanceImagePromptAsync(raw: string): Promise<{
  prompt: string;
  kind: "logo" | "photo" | "general";
  subject: string;
}> {
  const kind = detectImageKind(raw);
  if (kind === "logo") {
    const extracted = extractImagePrompt(raw);
    const quick =
      lexiconToEnglish(extracted || raw) ||
      lexiconToEnglish(raw) ||
      (/[\u0400-\u04FF]/.test(extracted) ? await resolveEnglishSubject(extracted) : extracted) ||
      "";
    const subject = resolveLogoSubject(quick);
    if (subject === DEFAULT_CHATGEM_LOGO_SUBJECT) {
      return {
        kind: "logo",
        subject,
        prompt: DEFAULT_CHATGEM_LOGO_PROMPT,
      };
    }
    const prompt = await enrichWorldClassBrief(subject, "logo");
    return { kind: "logo", subject, prompt };
  }

  const extracted = extractImagePrompt(raw);
  const subject = await resolveEnglishSubject(extracted || raw);
  const prompt = await enrichWorldClassBrief(subject, kind);
  return {
    kind,
    subject,
    prompt,
  };
}

export const IMAGE_LIBRARY_KEY = "nj_image_library_v1";
export const IMAGE_LIBRARY_EVENT = "nj:image-library-changed";
export const IMAGE_LIBRARY_MAX = 48;

export type LibraryImageKind = "logo" | "photo" | "general";

export type LibraryImageAspect =
  | "1:1"
  | "16:9"
  | "9:16"
  | "3:2"
  | "2:3"
  | "4:3"
  | "3:4";

export type LibraryImageStyle =
  | "auto"
  | "photo"
  | "cinematic"
  | "illustration"
  | "3d"
  | "product"
  | "concept"
  | "poster"
  | "anime"
  | "fantasy"
  | "scifi";

export type LibraryImageQuality = "standard" | "hd";

export type LibraryImage = {
  id: string;
  url: string;
  prompt: string;
  negativePrompt?: string;
  kind: LibraryImageKind;
  aspect: LibraryImageAspect;
  style: LibraryImageStyle;
  quality?: LibraryImageQuality;
  provider?: string;
  createdAt: number;
  favorite?: boolean;
  settings?: Record<string, unknown>;
};

const ASPECTS = new Set<LibraryImageAspect>([
  "1:1",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
]);

const STYLES = new Set<LibraryImageStyle>([
  "auto",
  "photo",
  "cinematic",
  "illustration",
  "3d",
  "product",
  "concept",
  "poster",
  "anime",
  "fantasy",
  "scifi",
]);

function normalizeLibraryEntry(raw: unknown): LibraryImage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.url !== "string" || typeof o.id !== "string") return null;
  const kindRaw = o.kind;
  const kind: LibraryImageKind =
    kindRaw === "logo" || kindRaw === "photo" || kindRaw === "general"
      ? kindRaw
      : detectImageKind(typeof o.prompt === "string" ? o.prompt : "");
  const aspectRaw = o.aspect;
  const aspect: LibraryImageAspect =
    typeof aspectRaw === "string" && ASPECTS.has(aspectRaw as LibraryImageAspect)
      ? (aspectRaw as LibraryImageAspect)
      : "1:1";
  const styleRaw = o.style;
  const style: LibraryImageStyle =
    typeof styleRaw === "string" && STYLES.has(styleRaw as LibraryImageStyle)
      ? (styleRaw as LibraryImageStyle)
      : "auto";
  return {
    id: o.id,
    url: o.url,
    prompt: typeof o.prompt === "string" ? o.prompt : "",
    negativePrompt:
      typeof o.negativePrompt === "string" ? o.negativePrompt : undefined,
    kind,
    aspect,
    style,
    quality:
      o.quality === "hd" || o.quality === "standard" ? o.quality : undefined,
    provider: typeof o.provider === "string" ? o.provider : undefined,
    createdAt:
      typeof o.createdAt === "number" && Number.isFinite(o.createdAt)
        ? o.createdAt
        : Date.now(),
    favorite: o.favorite === true,
    settings:
      o.settings && typeof o.settings === "object"
        ? (o.settings as Record<string, unknown>)
        : undefined,
  };
}

function persistLibrary(items: LibraryImage[]) {
  localStorage.setItem(
    IMAGE_LIBRARY_KEY,
    JSON.stringify(items.slice(0, IMAGE_LIBRARY_MAX)),
  );
  window.dispatchEvent(new Event(IMAGE_LIBRARY_EVENT));
}

export function loadImageLibrary(): LibraryImage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(IMAGE_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeLibraryEntry)
      .filter((x): x is LibraryImage => x !== null)
      .slice(0, IMAGE_LIBRARY_MAX);
  } catch {
    return [];
  }
}

export function saveImageLibrary(items: LibraryImage[]) {
  if (typeof window === "undefined") return;
  try {
    persistLibrary(items.map((x) => normalizeLibraryEntry(x)!).filter(Boolean));
  } catch {
    // ignore
  }
}

/** Insert or replace by id/url — single write path for gallery + chat. */
export function upsertLibraryImage(item: LibraryImage): LibraryImage[] {
  if (typeof window === "undefined") return [];
  try {
    const normalized = normalizeLibraryEntry(item);
    if (!normalized) return loadImageLibrary();
    const prev = loadImageLibrary();
    const next = [
      normalized,
      ...prev.filter((x) => x.id !== normalized.id && x.url !== normalized.url),
    ].slice(0, IMAGE_LIBRARY_MAX);
    persistLibrary(next);
    return next;
  } catch {
    return loadImageLibrary();
  }
}

export function toggleFavoriteImage(id: string): LibraryImage[] {
  if (typeof window === "undefined") return [];
  const prev = loadImageLibrary();
  const next = prev.map((x) =>
    x.id === id ? { ...x, favorite: !x.favorite } : x,
  );
  saveImageLibrary(next);
  return next;
}

export function saveGeneratedImageToLibrary(
  url: string,
  prompt: string,
  extra?: Partial<Omit<LibraryImage, "id" | "url" | "prompt" | "createdAt">>,
) {
  if (typeof window === "undefined") return;
  try {
    const prev = loadImageLibrary();
    const existing = prev.find((x) => x.url === url);
    if (existing) {
      const merged: LibraryImage = {
        ...existing,
        prompt: prompt.trim() || existing.prompt,
        ...extra,
        id: existing.id,
        url: existing.url,
        createdAt: existing.createdAt,
      };
      upsertLibraryImage(merged);
      return;
    }
    const item: LibraryImage = {
      id: crypto.randomUUID(),
      url,
      prompt,
      kind: extra?.kind ?? detectImageKind(prompt),
      aspect: extra?.aspect ?? "1:1",
      style: extra?.style ?? detectImageStyle(prompt),
      negativePrompt: extra?.negativePrompt,
      quality: extra?.quality,
      provider: extra?.provider,
      favorite: extra?.favorite,
      settings: extra?.settings,
      createdAt: Date.now(),
    };
    upsertLibraryImage(item);
  } catch {
    // ignore quota / private mode
  }
}

export function removeImageFromLibrary(id: string) {
  if (typeof window === "undefined") return;
  try {
    saveImageLibrary(loadImageLibrary().filter((x) => x.id !== id));
  } catch {
    // ignore
  }
}

export const LOGO_STYLE_OPTIONS = [
  "Minimal",
  "Modern",
  "Luxury",
  "Corporate",
  "Technology",
  "Gaming",
  "Automotive",
  "Fashion",
  "3D",
  "Neon",
  "Monogram",
  "Mascot",
  "Abstract",
  "Premium",
] as const;

export type LogoStyleOption = (typeof LOGO_STYLE_OPTIONS)[number];

const LOGO_STYLE_HINT: Record<LogoStyleOption, string> = {
  Minimal: "minimal flat vector logo, generous whitespace, simple geometric mark",
  Modern: "modern sans-serif wordmark, clean grid, contemporary brand identity",
  Luxury: "luxury logo, refined serif or elegant monogram, gold-friendly palette, premium feel",
  Corporate: "corporate logo, trustworthy, balanced typography, professional B2B identity",
  Technology: "tech logo, sleek lines, digital gradient accents, startup-ready",
  Gaming: "gaming logo, bold dynamic shapes, energetic colors, esports-ready",
  Automotive: "automotive logo, metallic accents, speed lines, badge emblem style",
  Fashion: "fashion logo, high-end editorial typography, chic minimal mark",
  "3D": "3D logo render, soft studio lighting, dimensional lettermark",
  Neon: "neon sign logo, glowing tubes, dark backdrop, vibrant contrast",
  Monogram: "monogram logo, intertwined initials, symmetrical badge",
  Mascot: "mascot logo, friendly character icon, memorable brand creature",
  Abstract: "abstract logo symbol, unique geometric metaphor, scalable mark",
  Premium: "premium logo system, polished vector, print-ready, iconic simplicity",
};

export function buildLogoPrompt(fields: {
  name: string;
  business?: string;
  style: LogoStyleOption;
  tagline?: string;
}): string {
  const name = fields.name.trim();
  const business = fields.business?.trim();
  const tagline = fields.tagline?.trim();
  const styleHint = LOGO_STYLE_HINT[fields.style] ?? LOGO_STYLE_HINT.Modern;
  return [
    `World-class brand logo for "${name}"`,
    business ? `category: ${business}` : "versatile modern brand",
    tagline ? `brand story cue: ${tagline}` : null,
    styleHint,
    "primary iconic mark with optional clean wordmark underneath",
    "balanced geometry, memorable silhouette, premium negative space",
    "flat vector or soft dimensional mark, print and app ready",
    "centered on solid dark navy or pure white field",
    "single cohesive color system (2–3 colors max)",
    "no mockup, no phone, no photo collage, no watermark, no random glyphs",
  ]
    .filter(Boolean)
    .join(". ");
}

export const PHOTO_CATEGORIES: { id: string; guidance: string }[] = [
  {
    id: "portrait",
    guidance:
      "Professional portrait photography, flattering natural light, sharp eyes, shallow depth of field, 85mm lens look",
  },
  {
    id: "product",
    guidance:
      "Commercial product photography, softbox lighting, clean backdrop, catalog-ready detail, accurate materials",
  },
  {
    id: "landscape",
    guidance:
      "Landscape photography, golden hour, wide dynamic range, crisp foreground and atmospheric depth",
  },
  {
    id: "street",
    guidance:
      "Street photography, candid moment, urban environment, documentary realism, natural color",
  },
  {
    id: "food",
    guidance:
      "Food photography, appetizing styling, macro detail, soft side light, editorial restaurant quality",
  },
  {
    id: "architecture",
    guidance:
      "Architectural photography, straight verticals, dramatic perspective, clean lines, professional real estate look",
  },
  {
    id: "fashion",
    guidance:
      "Fashion editorial photo, studio or location, high-end styling, magazine cover quality",
  },
  {
    id: "wildlife",
    guidance:
      "Wildlife photography, telephoto clarity, natural habitat, sharp subject, ethical distance feel",
  },
];

export function photoPromptWithCategory(subject: string, categoryId: string): string {
  const cat = PHOTO_CATEGORIES.find((c) => c.id === categoryId);
  const base = subject.trim();
  if (!cat) return base;
  return `${cat.guidance}. Subject: ${base}`;
}
