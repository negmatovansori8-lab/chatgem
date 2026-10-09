/**
 * Prompt engine: understands what the user wants drawn (format, subject, people or not,
 * national symbols) and turns it into a production brief for the image model.
 */

import { extractImagePrompt, isLogoRequest, isTajikistanFlagMapRequest, LOGO_TYPO } from "@/lib/image-prompt";
import { cleanImageSubject, hasImageLlm, imageLlm, resolveEnglishSubject } from "@/lib/image-subject";
import type { ImageAspect, ImageKind } from "@/providers/images/types";

export type BriefKind = "photo" | "logo" | "icon" | "map" | "flag" | "poster" | "illustration" | "general";
export type BriefLang = "tg" | "ru" | "en";
export type BriefRender = "tajikistan-map" | "tajikistan-flag" | "tajikistan-logo";

export type ImageRequestAnalysis = {
  kind: BriefKind;
  /** The request is about the country Tajikistan or Tajik national identity. */
  tajikistan: boolean;
  /** People only appear when the user names them (woman, man, child, portrait…). */
  wantsPeople: boolean;
  /** Text the user quoted — the only lettering allowed in the image. */
  brandName: string | null;
  motifs: string[];
  lang: BriefLang;
  /** Language the user asked the map labels in, if any. */
  labelLang: BriefLang | null;
  /** Nothing beyond "make the Tajikistan map/flag" — the exact render beats any AI picture. */
  render: BriefRender | null;
  /** Lettering for the exact logo: text, `null` for none, `undefined` for the language default. */
  wordmark?: string | null;
};

export type ImageBrief = ImageRequestAnalysis & {
  imageKind: ImageKind;
  subject: string;
  style: string;
  composition: string;
  colors: string;
  quality: string;
  avoid: string[];
  aspect: ImageAspect;
  /** Full prompt for GPT-Image / DALL·E. */
  prompt: string;
  /** Short prompt for Flux, which ignores long instructions and cannot read negatives. */
  fluxPrompt: string;
  /** Short caption in the user's language. */
  title: string;
};

const NOT_LETTER_BEFORE = String.raw`(?<![\p{L}\p{N}])`;
const NOT_LETTER_AFTER = String.raw`(?![\p{L}\p{N}])`;

const TJ_COUNTRY_RE = new RegExp(
  String.raw`(?:тоҷикисто|точикисто|тоҷикиста|таджикиста|tajikista|tojikisto|tadjikista|tadzhikista)\p{L}*|${NOT_LETTER_BEFORE}(?:tj|тҷ)${NOT_LETTER_AFTER}`,
  "iu",
);
const TJ_NATIONAL_RE = new RegExp(
  String.raw`${NOT_LETTER_BEFORE}(?:тоҷик|точик|таджик|tajik|tojik)(?:ӣ|и|он|ҳо|ская|ский|ское|ские|ских|ского|ой|ий)?${NOT_LETTER_AFTER}`,
  "iu",
);
/** «ба забони тоҷикӣ» names the label language, not the subject. */
const LANGUAGE_PHRASE_RE =
  /(?:ба|бо|дар)?\s*забони\s+(?:тоҷикӣ|тоҷики|точики|русӣ|руси|англисӣ|англиси)|на\s+(?:таджикском|русском|английском)(?:\s+языке)?|in\s+(?:tajik|russian|english)(?:\s+language)?(?![\p{L}])/giu;

const PERSON_RE = new RegExp(
  NOT_LETTER_BEFORE +
    "(?:" +
    [
      String.raw`зан(?:и|е|он|ҳо|ро|ону)?`,
      String.raw`мард(?:и|е|он|ҳо|ро|ум\p{L}*)?`,
      String.raw`одам\p{L}*`,
      String.raw`духтар\p{L}*`,
      String.raw`писар\p{L}*`,
      String.raw`кӯдак\p{L}*`,
      String.raw`бача\p{L}*`,
      String.raw`инсон\p{L}*`,
      String.raw`чеҳра\p{L}*`,
      String.raw`оила\p{L}*`,
      String.raw`модар\p{L}*`,
      String.raw`падар\p{L}*`,
      String.raw`портрет\p{L}*`,
      String.raw`женщин\p{L}*`,
      String.raw`мужчин\p{L}*`,
      String.raw`девушк\p{L}*`,
      String.raw`девочк\p{L}*`,
      String.raw`парн\p{L}*|парень`,
      String.raw`мальчик\p{L}*`,
      String.raw`человек\p{L}*`,
      String.raw`люд(?:и|ей|ям|ьми)`,
      String.raw`лиц(?:о|а|ом)`,
      String.raw`реб[её]н\p{L}*|дет(?:и|ей|ям)`,
      String.raw`семь(?:я|и|ю|ей)`,
      String.raw`women|woman|man|men|girls?|boys?|persons?|people|humans?|faces?|portraits?|child(?:ren)?|kids?|family|lady|ladies|guy`,
    ].join("|") +
    ")" +
    NOT_LETTER_AFTER,
  "iu",
);

const PERSON_EN_RE =
  /\b(?:women|woman|girls?|lady|ladies|men|man|male|female|persons?|people|humans?|faces?|portraits?|child(?:ren)?|boys?|characters?|figures?|crowd)\b/i;

const ICON_RE = new RegExp(String.raw`иконк\p{L}*|${NOT_LETTER_BEFORE}икон(?:а|у|ы|аи)${NOT_LETTER_AFTER}|${NOT_LETTER_BEFORE}(?:icon|favicon|app\s*icon)s?${NOT_LETTER_AFTER}`, "iu");
const POSTER_RE = new RegExp(String.raw`плакат\p{L}*|постер\p{L}*|афиш\p{L}*|баннер\p{L}*|${NOT_LETTER_BEFORE}(?:poster|banner|flyer)s?${NOT_LETTER_AFTER}`, "iu");
const FLAG_RE = new RegExp(String.raw`парчам\p{L}*|байра[қк]\p{L}*|флаг\p{L}*|${NOT_LETTER_BEFORE}flags?${NOT_LETTER_AFTER}`, "iu");
const MAP_RE = new RegExp(
  String.raw`харит\p{L}*|${NOT_LETTER_BEFORE}карт(?:а|у|ы|е|ой|ах|ами)${NOT_LETTER_AFTER}|${NOT_LETTER_BEFORE}(?:maps?|atlas)${NOT_LETTER_AFTER}`,
  "iu",
);
const PHOTO_RE = new RegExp(
  String.raw`фото\p{L}*|снимок|реалист\p{L}*|воқеӣ|${NOT_LETTER_BEFORE}акс(?:и|ҳо|ро)?${NOT_LETTER_AFTER}|${NOT_LETTER_BEFORE}(?:photo\w*|realistic|photorealistic)${NOT_LETTER_AFTER}`,
  "iu",
);
const ILLUSTRATION_RE = new RegExp(
  String.raw`иллюстрац\p{L}*|рисун\p{L}*|мультфильм\p{L}*|аниме|${NOT_LETTER_BEFORE}(?:illustration|cartoon|anime|vector\s+art|drawing)${NOT_LETTER_AFTER}|${NOT_LETTER_BEFORE}расм${NOT_LETTER_AFTER}`,
  "iu",
);

const TJ_MOTIFS: Array<{ re: RegExp; motif: string }> = [
  { re: /харит|карт[аеуы]|(?<!\p{L})map|контур|outline|silhouette|шакл/iu, motif: "the recognizable outline of the map of Tajikistan" },
  { re: /парчам|байра[қк]|флаг|(?<!\p{L})flag|(?<!\p{L})ранг|цвет(?:а|ов)(?!\p{L})|colou?rs?/iu, motif: "the national flag colours red, white and green" },
  { re: /(?<!\p{L})тоҷ(?!ик)\p{L}{0,3}(?!\p{L})|корон|crown|ситора|звезд|stars?(?!\p{L})/iu, motif: "the golden crown under an arc of seven golden stars from the national flag" },
  { re: /кӯҳ|(?<!\p{L})кух|помир|памир|pamir|(?<!\p{L})гор(?:а|ы|ы|у)?(?!\p{L})|mountain|peak/iu, motif: "stylized Pamir mountain peaks" },
  { re: /(?<!\p{L})tech|технолог|(?<!\p{L})ai(?!\p{L})|digital|рақамӣ|цифров|startup|стартап|футур|futur/iu, motif: "modern tech-inspired geometric lines" },
  { re: /милл[ӣи]|национал|national|нақш|орнамент|ornament|сӯзанӣ|сузани|suzani|анъана|традиц|tradition/iu, motif: "a subtle traditional Tajik suzani ornament" },
];

const DEFAULT_TJ_MOTIFS: Record<BriefKind, string[]> = {
  logo: [
    "the golden crown under an arc of seven golden stars",
    "one minimal Pamir mountain peak",
    "the national colours red, white and green",
  ],
  icon: ["the golden crown under an arc of seven golden stars", "the national colours red, white and green"],
  poster: [
    "the recognizable outline of the map of Tajikistan",
    "stylized Pamir mountain peaks",
    "the national flag colours red, white and green",
  ],
  photo: ["the snowy Pamir mountains", "a turquoise mountain lake"],
  illustration: ["stylized Pamir mountain peaks", "the golden crown with seven stars", "the national colours red, white and green"],
  general: ["stylized Pamir mountain peaks", "the golden crown with seven stars", "the national colours red, white and green"],
  map: [],
  flag: [],
};

type KindSpec = {
  lead: string;
  imageKind: ImageKind;
  aspect: ImageAspect;
  style: string;
  composition: string;
  colors: string;
  quality: string;
  avoid: string[];
  flux: string;
};

const KIND_SPECS: Record<BriefKind, KindSpec> = {
  logo: {
    lead: "World-class professional logo design",
    imageKind: "logo",
    aspect: "1:1",
    style: "modern, premium, minimal flat vector logo mark; unique, memorable and clean, not a template",
    composition: "one centered emblem on a plain solid background, strong silhouette, generous negative space, balanced geometry that still reads at favicon size",
    colors: "a tight palette of two to four solid colours",
    quality: "crisp vector edges, scalable, works as an app icon, on a website and as a favicon",
    avoid: ["photo", "mockup", "busy details", "gradient noise", "multiple logos", "clip art", "watermark"],
    flux: "minimalist flat vector logo, sharp clean edges, centered on a plain white background, professional brand identity",
  },
  icon: {
    lead: "App icon design",
    imageKind: "logo",
    aspect: "1:1",
    style: "polished modern app icon, bold simple glyph with soft depth",
    composition: "single centered symbol filling most of a rounded-square tile, iOS and Android launcher style",
    colors: "vivid but limited palette with a subtle gradient background",
    quality: "pixel-perfect edges, readable at small sizes",
    avoid: ["text", "letters", "phone mockup", "tiny details", "watermark"],
    flux: "app icon, rounded square tile, single bold centered glyph, soft depth, clean gradient background",
  },
  map: {
    lead: "Geographic map",
    imageKind: "general",
    aspect: "4:3",
    style: "clean professional cartography, accurate borders and coastlines",
    composition: "the whole territory centered, north up, neighbouring areas muted",
    colors: "soft political pastels with gentle relief shading",
    quality: "atlas quality, sharp lines",
    avoid: ["distorted borders", "invented geography", "fantasy map", "gibberish labels", "watermark"],
    flux: "clean geographic map, accurate borders, atlas style, north up, soft pastel colors",
  },
  flag: {
    lead: "National flag",
    imageKind: "general",
    aspect: "3:2",
    style: "official design with exact proportions and colours",
    composition: "the full flag visible and centered",
    colors: "the official flag colours only",
    quality: "sharp, accurate details",
    avoid: ["wrong colours", "extra symbols", "distorted emblem", "watermark"],
    flux: "national flag, accurate official design, full flag visible",
  },
  poster: {
    lead: "Professional poster design",
    imageKind: "general",
    aspect: "2:3",
    style: "contemporary graphic poster, strong visual hierarchy, bold focal image",
    composition: "vertical layout with one hero visual and calm space for a headline",
    colors: "a harmonious, art-directed palette",
    quality: "print-ready, high resolution",
    avoid: ["clutter", "gibberish text", "watermark"],
    flux: "professional graphic poster, bold hero visual, strong hierarchy, print-ready",
  },
  photo: {
    lead: "Photorealistic photograph",
    imageKind: "photo",
    aspect: "16:9",
    style: "true-to-life photography shot on a professional camera",
    composition: "clear main subject, rule of thirds, natural perspective",
    colors: "natural, true-to-life colour",
    quality: "sharp focus, natural light, high dynamic range",
    avoid: ["cartoon", "illustration", "CGI look", "text overlay", "watermark"],
    flux: "photorealistic photo, natural light, sharp detail",
  },
  illustration: {
    lead: "High-quality digital illustration",
    imageKind: "general",
    aspect: "1:1",
    style: "polished digital illustration with clean shapes",
    composition: "clear focal subject, balanced layout",
    colors: "intentional cohesive palette",
    quality: "art-directed, detailed finish",
    avoid: ["messy lines", "text", "watermark"],
    flux: "polished digital illustration, clean shapes, cohesive palette",
  },
  general: {
    lead: "High-quality image",
    imageKind: "general",
    aspect: "1:1",
    style: "polished, professional visual",
    composition: "the subject as the clear main focus, balanced composition",
    colors: "harmonious palette",
    quality: "highly detailed, beautiful lighting",
    avoid: ["unrelated objects", "text", "watermark"],
    flux: "high quality, detailed, beautiful lighting",
  },
};

const TJ_SUBJECT: Record<BriefKind, string> = {
  logo: "professional logo representing the Republic of Tajikistan (Tajikistan country)",
  icon: "app icon representing the Republic of Tajikistan (Tajikistan country)",
  map: "accurate geographic map of the Republic of Tajikistan, the country in Central Asia, with its correct outline",
  flag: "national flag of the Republic of Tajikistan: red, wide white and green horizontal stripes, golden crown under an arc of seven golden stars in the centre",
  poster: "poster celebrating the Republic of Tajikistan (Tajikistan country)",
  photo: "landscape photograph of Tajikistan country",
  illustration: "illustration of the Republic of Tajikistan (Tajikistan country)",
  general: "artwork representing the Republic of Tajikistan (Tajikistan country)",
};

const TITLES: Record<BriefLang, Record<BriefKind, string>> = {
  tg: {
    logo: "Логотипи Тоҷикистон",
    icon: "Иконаи Тоҷикистон",
    map: "Харитаи Тоҷикистон",
    flag: "Парчами Тоҷикистон",
    poster: "Плакати Тоҷикистон",
    photo: "Тоҷикистон",
    illustration: "Тоҷикистон",
    general: "Тоҷикистон",
  },
  ru: {
    logo: "Логотип Таджикистана",
    icon: "Иконка Таджикистана",
    map: "Карта Таджикистана",
    flag: "Флаг Таджикистана",
    poster: "Плакат о Таджикистане",
    photo: "Таджикистан",
    illustration: "Таджикистан",
    general: "Таджикистан",
  },
  en: {
    logo: "Tajikistan logo",
    icon: "Tajikistan icon",
    map: "Map of Tajikistan",
    flag: "Flag of Tajikistan",
    poster: "Tajikistan poster",
    photo: "Tajikistan",
    illustration: "Tajikistan",
    general: "Tajikistan",
  },
};

/** Words that only restate "make the map/flag" — anything else asks for a creative picture. */
const PLAIN_WORDS_RE = new RegExp(
  String.raw`${NOT_LETTER_BEFORE}(?:` +
    [
      String.raw`харит\p{L}*|карт\p{L}*|maps?|парчам\p{L}*|байра[қк]\p{L}*|флаг\p{L}*|flags?`,
      String.raw`${LOGO_TYPO}\p{L}*|логип\p{L}*|лоғотип\p{L}*|лого|logos?|logotip\p{L}*|logotype|logatip\p{L}*|эмблем\p{L}*|emblem\p{L}*|нишона\p{L}*|замонав\p{L}*|современн\p{L}*|modern|касбӣ|профессиональн\p{L}*|professional|премиум\p{L}*|premium|беҳтарин|лучш\p{L}*|best`,
      String.raw`тоҷикисто\p{L}*|точикисто\p{L}*|таджикиста\p{L}*|tajikistan|tj|тҷ|ҷумҳур\p{L}*|республик\p{L}*|republic|of|the|national|миллӣ|национальн\p{L}*|давлат\p{L}*|государствен\p{L}*|official|расмӣ|официальн\p{L}*`,
      String.raw`сиёс\p{L}*|маъмур\p{L}*|вилоят\p{L}*|шаҳр\p{L}*|област\p{L}*|регион\p{L}*|город\p{L}*|политическ\p{L}*|административн\p{L}*|political|administrative|regions?|cities|дақиқ|точн\p{L}*|accurate|real|воқеӣ|реальн\p{L}*|пурра|полн\p{L}*|full|калон|большую|большая|big|large|нав|new|зебо|красив\p{L}*|beautiful|сифат\p{L}*|качеств\p{L}*|hd|4k`,
      String.raw`соз(?:ед|ӣ|и)?|кун(?:ед)?|диҳ(?:ед)?|нишон|кашед|каш|сохта|сделай(?:те)?|создай(?:те)?|нарисуй(?:те)?|покажи(?:те)?|сгенерируй(?:те)?|make|create|draw|generate|show|render`,
      String.raw`ба|барои|ман|лутфан|як|мехоҳам|хоҳам|ва|бо|ро|и|мне|пожалуйста|с|и|для|меня|please|me|a|an|and|with|for`,
      String.raw`тасвир\p{L}*|сурат\p{L}*|image|picture|забон\p{L}*|язык\p{L}*|language|тоҷикӣ|тоҷики|русӣ|англисӣ|таджикском|русском|английском|tajik|russian|english`,
    ].join("|") +
    String.raw`)${NOT_LETTER_AFTER}`,
  "giu",
);

function detectLang(text: string): BriefLang {
  if (/[ҷҳқғӯӣ]/iu.test(text)) return "tg";
  if (/[\u0400-\u04FF]/u.test(text)) {
    return /(?<!\p{L})(?:соз|барои|ман|харита\p{L}*|парчам\p{L}*|тасвир\p{L}*|сурат\p{L}*)(?!\p{L})/iu.test(text) ? "tg" : "ru";
  }
  return "en";
}

function detectLabelLang(text: string): BriefLang | null {
  if (/англис|английск|(?<!\p{L})english(?!\p{L})/iu.test(text)) return "en";
  if (/забони\s+рус|русск|(?<!\p{L})russian(?!\p{L})/iu.test(text)) return "ru";
  if (/забони\s+то[ҷч]ик|таджикском|in\s+tajik(?:\s+language)?(?!\p{L})/iu.test(text)) return "tg";
  return null;
}

export function detectBriefKind(text: string): BriefKind {
  if (ICON_RE.test(text)) return "icon";
  if (isLogoRequest(text)) return "logo";
  if (POSTER_RE.test(text)) return "poster";
  if (FLAG_RE.test(text)) return "flag";
  if (MAP_RE.test(text)) return "map";
  if (PHOTO_RE.test(text)) return "photo";
  if (ILLUSTRATION_RE.test(text)) return "illustration";
  return "general";
}

/** Default aspect for a request — lets the chat reserve the right placeholder before the image arrives. */
export function briefAspect(text: string): ImageAspect {
  return KIND_SPECS[detectBriefKind(text)].aspect;
}

function quotedName(text: string): string | null {
  const m = text.match(/["«“„']([^"»”'\n]{1,40})["»”']/u);
  return m?.[1]?.trim() || null;
}

function isPlainRequest(text: string): boolean {
  const rest = text
    .replace(/дар\s+са[тҳх]+и\s+[ҷч]а[ҳх]он\p{L}*|мирового\s+уровня|world[-\s]class/giu, " ")
    .replace(PLAIN_WORDS_RE, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return rest.split(" ").filter((w) => w.length >= 2).length === 0;
}

export function analyzeImageRequest(raw: string, kindHint?: ImageKind | "auto"): ImageRequestAnalysis {
  const text = raw.trim();
  const subjectText = text.replace(LANGUAGE_PHRASE_RE, " ");
  const detected = detectBriefKind(text);
  let kind = detected;
  if (kindHint === "logo" && detected !== "icon") kind = "logo";
  if (kindHint === "photo" && detected === "general") kind = "photo";

  const country = TJ_COUNTRY_RE.test(subjectText);
  const tajikistan = country || TJ_NATIONAL_RE.test(subjectText);
  const wantsPeople = PERSON_RE.test(text.replace(NEGATED_CLAUSE_RE, " "));
  const brandName = kind === "logo" || kind === "poster" ? quotedName(text) : null;

  const motifs: string[] = [];
  if (tajikistan && kind !== "map" && kind !== "flag") {
    for (const { re, motif } of TJ_MOTIFS) if (re.test(text)) motifs.push(motif);
    if (!motifs.length) motifs.push(...DEFAULT_TJ_MOTIFS[kind]);
  }

  const flagMap = country && !wantsPeople && isTajikistanFlagMapRequest(text);
  if (flagMap) kind = "logo";
  const plain = tajikistan && !wantsPeople && isPlainRequest(text);
  const render: BriefRender | null = flagMap
    ? "tajikistan-logo"
    : !plain
      ? null
      : kind === "flag"
        ? "tajikistan-flag"
        : country && kind === "map"
          ? "tajikistan-map"
          : country && kind === "logo"
            ? "tajikistan-logo"
            : null;

  return {
    kind,
    tajikistan,
    wantsPeople,
    brandName,
    motifs,
    lang: detectLang(text),
    labelLang: detectLabelLang(text),
    render,
    wordmark: render === "tajikistan-logo" ? logoWordmark(text) : undefined,
  };
}

/** «Без людей», "no people or scenery", «бе одамон» — what the user excludes is not the subject. */
const NEGATED_CLAUSE_RE = new RegExp(
  String.raw`${NOT_LETTER_BEFORE}(?:no|not|without|avoid|never|без|бе|не|ҳеҷ|ягон)${NOT_LETTER_AFTER}[^.;:!?\n]*`,
  "giu",
);
const NO_TEXT_RE =
  /(?:без|бе|no|without)\s+(?:текст\p{L}*|надпис\p{L}*|матн\p{L}*|навиштаҷот\p{L}*|text|words?|lettering|wordmark)|wordless/iu;
const LATIN_NAME_RE = /(?<![\p{L}])Tajikistan(?![\p{L}])/iu;

/**
 * Lettering under the flag-map logo: a quoted name or a Latin "Tajikistan" in a Cyrillic prompt wins,
 * "no text" drops it, otherwise (`undefined`) the prompt's language decides.
 */
export function logoWordmark(raw: string): string | null | undefined {
  const quoted = quotedName(raw);
  if (quoted) return quoted;
  if (NO_TEXT_RE.test(raw)) return null;
  if (LATIN_NAME_RE.test(raw) && /\p{Script=Cyrillic}/u.test(raw)) return "Tajikistan";
  return undefined;
}

function peopleRule(a: ImageRequestAnalysis): string[] {
  if (a.wantsPeople) return [];
  if (a.tajikistan || ["logo", "icon", "map", "flag"].includes(a.kind)) {
    return ["people", "woman", "man", "human face", "portrait", "character"];
  }
  return [];
}

function textRule(a: ImageRequestAnalysis): string {
  if (a.brandName) return `the only lettering is the name "${a.brandName}" in clean modern type`;
  if (a.kind === "map") return "no text labels";
  return "no text, letters or words";
}

type LlmBrief = {
  subject: string;
  style?: string;
  composition?: string;
  colors?: string;
  quality?: string;
  avoid?: string[];
  prompt: string;
  flux?: string;
};

const CYRILLIC_RE = /[\u0400-\u04FF]/;

/** Drops "no people / without faces / avoid …" clauses so a person check sees only what is drawn. */
function positivePart(text: string): string {
  return text.replace(/\b(?:no|without|avoid(?:ing)?|not|never|exclude|free of)\b[^.;:]*/gi, " ");
}

function parseLlmBrief(text: string, a: ImageRequestAnalysis): LlmBrief | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  let data: Partial<LlmBrief>;
  try {
    data = JSON.parse(json) as Partial<LlmBrief>;
  } catch {
    return null;
  }
  const subject = typeof data.subject === "string" ? data.subject.trim() : "";
  const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";
  if (subject.length < 3 || prompt.length < 30 || prompt.length > 1400) return null;
  const all = [subject, prompt, data.flux ?? "", data.style ?? "", data.composition ?? "", data.colors ?? ""].join(" ");
  if (CYRILLIC_RE.test(all)) return null;
  if (a.tajikistan && !/tajik/i.test(subject + prompt)) return null;
  if (!a.wantsPeople && PERSON_EN_RE.test(positivePart(`${subject}. ${prompt}. ${data.flux ?? ""}`))) return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() && v.trim().length <= 400 ? v.trim() : undefined);
  return {
    subject: subject.slice(0, 200),
    prompt,
    flux: str(data.flux),
    style: str(data.style),
    composition: str(data.composition),
    colors: str(data.colors),
    quality: str(data.quality),
    avoid: Array.isArray(data.avoid)
      ? data.avoid.filter((x): x is string => typeof x === "string" && !CYRILLIC_RE.test(x)).map((x) => x.trim()).filter(Boolean).slice(0, 10)
      : undefined,
  };
}

function llmSystemPrompt(a: ImageRequestAnalysis): string {
  const spec = KIND_SPECS[a.kind];
  return [
    "You are the art director of a world-class design studio. Turn the user's image request (Tajik, Russian or English) into a production brief for an image model.",
    'Return ONLY JSON: {"subject":"","style":"","composition":"","colors":"","quality":"","avoid":[""],"prompt":"","flux":""}',
    "Rules:",
    "- Every value in English. Keep the user's meaning exactly; never swap, drop or add a main subject.",
    "- «Тоҷикистон», «Таджикистан», «TJ», «Tajikistan» mean the COUNTRY Republic of Tajikistan — never a woman, person, portrait or character. «тоҷик/таджик/Tajik» as an adjective means Tajik national style.",
    "- Tajik words: зан = woman, мард = man, одам = person, духтар = girl, писар = boy, кӯдак = child, харита = map, парчам = flag, гурба = cat, саг = dog, асп = horse, кӯҳ = mountain.",
    `- Format (fixed, do not copy this text): ${spec.lead}. ${spec.style}. ${spec.composition}.`,
    a.wantsPeople
      ? "- People: only the people the user asked for."
      : "- People: the image contains NO people, faces or human figures. Do not mention any person.",
    `- Text: ${textRule(a)}.`,
    a.motifs.length ? `- Use these motifs, choosing the most elegant combination (do not cram them all): ${a.motifs.join("; ")}.` : "",
    a.tajikistan ? '- The subject and prompt must name "Republic of Tajikistan" or "Tajikistan".' : "",
    "- subject: 4–14 words, a concrete visual description of the main element (e.g. «elegant female profile silhouette with flowing hair», not just «woman»).",
    "- style: 5–15 words in your own words. composition: 8–25 words. colors: a specific palette naming 2–4 colours. quality: under 15 words.",
    "- prompt: 60–110 words for GPT-Image/DALL·E: subject first, then style, composition, colours, lighting and finish.",
    "- flux: at most 40 words, comma-separated keywords, the concrete visual subject first, positive wording only.",
    "- avoid: 3–8 short items that would ruin this image.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function llmBrief(raw: string, a: ImageRequestAnalysis): Promise<LlmBrief | null> {
  if (!hasImageLlm()) return null;
  const text = await imageLlm(llmSystemPrompt(a), `Request: ${raw.trim().slice(0, 600)}`, {
    maxTokens: 520,
    temperature: 0.5,
    timeoutMs: 20_000,
    accept: (reply) => parseLlmBrief(reply, a) !== null,
  });
  return text ? parseLlmBrief(text, a) : null;
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function localTitle(raw: string, a: ImageRequestAnalysis): string {
  if (a.tajikistan && !a.wantsPeople) return TITLES[a.lang][a.kind];
  const cleaned = cleanImageSubject(raw).replace(/\s+/g, " ").trim();
  return capitalize(cleaned || raw.trim()).slice(0, 80);
}

/** Deterministic subject when no LLM is reachable. */
async function fallbackSubject(raw: string, a: ImageRequestAnalysis): Promise<string> {
  if (a.tajikistan && !a.wantsPeople) {
    return a.motifs.length && a.kind !== "photo" ? `${TJ_SUBJECT[a.kind]}, featuring ${a.motifs.join(", ")}` : TJ_SUBJECT[a.kind];
  }
  const english = await resolveEnglishSubject(extractImagePrompt(raw) || raw);
  return english.replace(/\b(?:logo|icon|poster|map|photo)\b/gi, " ").replace(/\s+/g, " ").trim() || english;
}

function joinUnique(items: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return items
    .map((x) => x?.trim())
    .filter((x): x is string => Boolean(x))
    .filter((x) => {
      const key = x.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const COLOUR_WORD_RE =
  /\b(?:red|blue|green|yellow|orange|purple|violet|pink|gold(?:en)?|silver|teal|cyan|turquoise|navy|crimson|magenta|black|white|grey|gray|brown|beige|emerald|azure|indigo|coral|maroon|burgundy|lime|mint|colou?rs?|palette)\b/i;

export function composeBrief(raw: string, a: ImageRequestAnalysis, subject: string, llm: LlmBrief | null): ImageBrief {
  const spec = KIND_SPECS[a.kind];
  const tjLock = a.tajikistan && !a.wantsPeople;
  const finalSubject = tjLock && !/tajik/i.test(subject) ? `${TJ_SUBJECT[a.kind]}, ${subject}` : subject;
  const style = llm?.style ?? spec.style;
  const composition = llm?.composition ?? spec.composition;
  const colors = llm?.colors ?? (a.tajikistan && a.kind !== "photo" ? "red, white, green and gold — the national palette" : spec.colors);
  const quality = llm?.quality ?? spec.quality;
  const avoid = joinUnique([...peopleRule(a), ...(llm?.avoid ?? []), ...spec.avoid, a.brandName ? undefined : "gibberish text"]).slice(0, 16);
  const lead = tjLock ? TJ_SUBJECT[a.kind] : `${spec.lead}: ${finalSubject}`;

  const prompt = joinUnique([
    capitalize(lead),
    tjLock ? capitalize(finalSubject) : undefined,
    llm?.prompt,
    `Style: ${style}`,
    `Composition: ${composition}`,
    `Colours: ${colors}`,
    `Quality: ${quality}`,
    capitalize(textRule(a)),
    `Avoid: ${avoid.join(", ")}`,
  ])
    .join(". ")
    .replace(/\.\./g, ".")
    .slice(0, 3800);

  const fluxCore = llm?.flux ?? finalSubject;
  const fluxText = a.brandName ? `the word "${a.brandName}"` : a.kind === "photo" ? "" : "wordless, no text";
  const markLead =
    (a.kind === "logo" || a.kind === "icon") && !tjLock && !/\b(?:logo|icon)\b/i.test(fluxCore)
      ? `${a.kind === "icon" ? "app icon" : "logo"} of ${finalSubject.replace(/^(?:an?|the)\s+/i, "")}`
      : undefined;
  // Without a named palette Flux draws logos in washed-out grey.
  const fluxPalette =
    a.kind === "photo" || a.kind === "map" || a.kind === "flag" || tjLock || COLOUR_WORD_RE.test(fluxCore)
      ? undefined
      : llm?.colors && COLOUR_WORD_RE.test(llm.colors)
        ? `${llm.colors.replace(/\.$/, "").slice(0, 90)} colors`
        : a.kind === "logo" || a.kind === "icon"
          ? "bold vibrant colors"
          : undefined;
  const fluxPrompt = joinUnique([
    tjLock && !/tajik/i.test(fluxCore) ? TJ_SUBJECT[a.kind] : undefined,
    markLead,
    fluxCore,
    spec.flux,
    a.motifs.length && !llm?.flux ? a.motifs.slice(0, 2).join(", ") : undefined,
    tjLock && a.kind !== "photo" && !/\bred\b.*\bgreen\b/i.test(fluxCore) ? "red, white, green and gold palette" : undefined,
    fluxPalette,
    fluxText || undefined,
  ])
    .join(", ")
    .slice(0, 520);

  return {
    ...a,
    imageKind: spec.imageKind,
    subject: finalSubject,
    style,
    composition,
    colors,
    quality,
    avoid,
    aspect: spec.aspect,
    prompt,
    fluxPrompt,
    title: localTitle(raw, a),
  };
}

/** Understand the request and build the brief: one LLM call, deterministic fallback. */
export async function buildImageBrief(raw: string, opts?: { kindHint?: ImageKind | "auto" }): Promise<ImageBrief> {
  const a = analyzeImageRequest(raw, opts?.kindHint);
  if (a.render) return composeBrief(raw, a, TJ_SUBJECT[a.kind], null);
  const llm = await llmBrief(raw, a);
  const subject = llm?.subject ?? (await fallbackSubject(raw, a));
  return composeBrief(raw, a, subject, llm);
}
