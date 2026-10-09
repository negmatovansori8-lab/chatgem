import type { MediaSearchKind } from "@/lib/media/types";

/**
 * Does a chat message ask to find a song / artist / film? Tajik, Russian and English.
 *
 * `explicit` — the user named the media type («суруди…», «фильм…», «song…») or quoted a
 * title after «find». Otherwise (a bare «Shape of You», «find X») the chat only answers
 * with media when a provider returns a strong match, so ordinary questions still reach
 * the AI.
 */
export type MediaIntent = {
  kind: MediaSearchKind;
  /** Search text without the command words; empty when the user gave no title yet. */
  query: string;
  artist?: string;
  title?: string;
  explicit: boolean;
  /** Just a name, no command word — only a quick music lookup is worth the latency. */
  bare: boolean;
  wantsDownload: boolean;
};

const W = "[\\p{L}\\p{N}ӣӯқғҳҷ]";
const word = (re: string) => new RegExp(`(?<!${W})(?:${re})(?!${W})`, "iu");

const MUSIC_NOUN =
  "суруд(?:и|ро|ҳо|ҳоро|еро|ашро)?|мусиқ(?:ӣ|и|иро|ии)|трек\\p{L}*|альбом\\p{L}*|албом\\p{L}*|ҳунарманд\\p{L}*|сароянда\\p{L}*|овозхон\\p{L}*|песн\\p{L}*|песен|музык\\p{L}*|исполнител\\p{L}*|певц\\p{L}*|певиц\\p{L}*|певец|songs?|tracks?|music|album|singer|artist|band";
const MOVIE_NOUN =
  "фил(?:ь)?м(?:и|ро|ҳо|ҳоро|еро|ашро)?|фильм\\p{L}*|кино\\p{L}*|мультфил(?:ь)?м\\p{L}*|мультик\\p{L}*|movies?|films?|cartoons?";
const FIND_VERB =
  "ёб(?:ед)?|ёфта\\s+(?:деҳ|диҳед|бидеҳ|бидиҳед)|пайдо\\s+кун(?:ед)?|ҷустуҷӯ(?:\\s+кун(?:ед)?)?|кофта\\s+ёб|найди(?:те)?|найти|поищи(?:те)?|ищу|find|search(?:\\s+for)?|look\\s+up|get\\s+me|show\\s+me";
const LISTEN_VERB =
  "гӯш\\s+(?:кардан|кунам|мекунам|кун|кунед)|шунавон(?:ед)?|послушать|послушай|listen(?:\\s+to)?";
const WATCH_VERB = "тамошо(?:\\s+(?:кардан|кунам|мекунам|кун|кунед))?|посмотреть|смотреть|watch";
const PLAY_VERB = "гузор(?:ед)?|включи(?:те)?|поставь(?:те)?|play";
const DOWNLOAD_VERB = "боргир(?:ӣ|и)(?:\\s+кун(?:ед)?)?|зеркаш\\p{L}*|скача\\p{L}*|скачать|загрузи(?:ть|те)?|download";

/** Questions *about* media (bio, plot, lyrics, writing) belong to the AI, not to search. */
const ABOUT_RE = word(
  "кист|чист|кӣ\\s+аст|чӣ\\s+аст|who\\s+is|who\\s+sings|what\\s+is|кто\\s+такой|кто\\s+такая|что\\s+такое|кто\\s+поет|кто\\s+поёт|дар\\s+бора(?:и)?|about|tell\\s+me|расскажи|нақл|биограф\\p{L}*|biography|explain|шарҳ|маънои|meaning|lyrics|матн(?:и|ашро)?|текст\\p{L}*|перевод\\p{L}*|translate|тарҷума|review|отзыв\\p{L}*|сюжет|plot|summary|хулоса|нависед|навис|напиши|сочини|write|compose|бисоз|созед|create|generate|кашида|draw|нарисуй|recommend|тавсия|посоветуй|монанд|похож\\p{L}*|similar\\s+to",
);

/** Command filler removed from the search text. English pronouns stay: they are common in titles («Call Me Maybe»). */
const FILLER =
  "ин|ҳамин|инро|ҳаминро|барои\\s+ман|ба\\s+ман|лутфан|илтимос|please|pls|пожалуйста|мне|для\\s+меня|for\\s+me|the\\s+song|the\\s+movie|the\\s+film|этот|эту|это|номи|номаш|name\\s+of|the\\s+name\\s+of|название|называется|called|мехоҳам|хочу|i\\s+want\\s+to|i\\s+want|want\\s+to|can\\s+you|метавонӣ|метавонед|метонӣ|ро";

const GREETING =
  /^(?:салом(?:\s+алейкум)?|ассалому\s+алейкум|раҳмат|рахмат|ташаккур|хуб|нағз|ҳа|бале|не|хайр|ok(?:ay)?|ок|hi|hello|hey|thanks?|thank\s+you|yes|no|привет|здравствуй(?:те)?|спасибо|да|нет|пока|тест|test|чӣ\s+хел|чи\s+хел)$/iu;

/** Words that make a message a sentence rather than a title (Tajik/Russian; English titles often contain pronouns). */
const FUNCTION_WORDS = new Set(
  "ман ту вай мо шумо онҳо чӣ чи чаро кай куҷо чанд чӣ-хел ҳаст нест буд мекунам мекунӣ кун кунед барои агар ки ва ё аммо лекин ҳам низ я ты он она мы вы они что как почему зачем где когда сколько это не да нет и или но для если чтобы мне тебе меня".split(
    " ",
  ),
);
const EN_QUESTION = /^(?:what|how|why|where|when|who|which|please|can|could|would|should|does|do|is|are|will|help|explain|tell)\b/i;

function has(re: string, text: string) {
  return word(re).test(text);
}

function strip(re: string, text: string) {
  return text.replace(new RegExp(`(?<!${W})(?:${re})(?!${W})`, "giu"), " ");
}

function quoted(text: string): string | undefined {
  const m = /[«“"„]([^«»“”"„]{2,100})[»”"“]/u.exec(text);
  return m?.[1]?.trim();
}

function tidy(text: string): string {
  return text
    .replace(/[«»“”„"?!.,:;()]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, "")
    .trim();
}

function splitArtistTitle(query: string): { artist?: string; title?: string } {
  const by = /^(.{2,80}?)\s+(?:by|от|аз)\s+(.{2,60})$/iu.exec(query);
  if (by) return { title: by[1]!.trim(), artist: by[2]!.trim() };
  const dash = /^(.{2,60}?)\s+[-–—]\s+(.{2,80})$/u.exec(query);
  if (dash) return { artist: dash[1]!.trim(), title: dash[2]!.trim() };
  return {};
}

export function detectMediaIntent(text: string): MediaIntent | null {
  const raw = text.trim();
  if (!raw || raw.length > 200 || /https?:\/\/|```|[<>{}=]/.test(raw)) return null;
  if (raw.split(/\n/).length > 2) return null;
  if (/^[\d\s+\-*/=().,%]+$/.test(raw)) return null;
  if (ABOUT_RE.test(raw)) return null;

  const musicNoun = has(MUSIC_NOUN, raw);
  const movieNoun = has(MOVIE_NOUN, raw);
  const find = has(FIND_VERB, raw);
  const listen = has(LISTEN_VERB, raw);
  const watch = has(WATCH_VERB, raw);
  const play = has(PLAY_VERB, raw);
  const download = has(DOWNLOAD_VERB, raw);
  const title = quoted(raw);

  let rest = title ?? raw;
  if (!title) {
    rest = rest.replace(/[-‐]\s*(?:ро|ра)(?!\p{L})/giu, " ");
    for (const re of [FILLER, FIND_VERB, LISTEN_VERB, WATCH_VERB, PLAY_VERB, DOWNLOAD_VERB, MUSIC_NOUN, MOVIE_NOUN]) {
      rest = strip(re, rest);
    }
  }
  let query = tidy(rest);
  // Tajik object marker on a Cyrillic title word right before the verb: «Лолаҷонро ёб».
  if (!title && /[ӣӯқғҳҷ]|(?<!\p{L})(?:ёб|ёбед|кун|кунед)(?!\p{L})/iu.test(raw)) {
    query = query.replace(/(\p{L}{3,})ро$/u, "$1");
  }

  const kind: MediaSearchKind =
    musicNoun || listen ? (movieNoun || watch ? "any" : "music") : movieNoun || watch ? "movie" : "any";
  const explicit = musicNoun || movieNoun || listen || (watch && /watch|тамошо/i.test(raw)) || Boolean(title && find);
  const words = query ? query.split(" ").length : 0;

  if (explicit) {
    if (words > 12 || query.length > 100) return null;
    return { kind, query, ...splitArtistTitle(query), explicit: true, bare: false, wantsDownload: download };
  }

  if (!query || words > 7 || query.length > 80) return null;
  const commanded = find || play || download || watch;
  if (!commanded) {
    // A bare title / artist name: short, not a question, not a greeting or a sentence.
    if (/\?$/.test(raw) || GREETING.test(query) || EN_QUESTION.test(query)) return null;
    const tokens = query.toLowerCase().split(" ");
    if (tokens.some((t) => FUNCTION_WORDS.has(t))) return null;
    if (!/\p{L}{2,}/u.test(query)) return null;
  }
  return { kind, query, ...splitArtistTitle(query), explicit: false, bare: !commanded, wantsDownload: download };
}
