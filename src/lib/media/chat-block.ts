import type { MediaItem, MediaLink, MediaSearchKind, MediaSearchResult } from "@/lib/media/types";

/**
 * Media results travel inside the chat message as a fenced JSON block, so they survive
 * the history sync and reloads; the chat renders the block as media cards.
 */

export const MEDIA_FENCE = "media-results";

const FENCE_RE = new RegExp("```" + MEDIA_FENCE + "\\n([\\s\\S]*?)\\n```", "g");

type Lang = "tg" | "ru" | "en";

const TEXT: Record<Lang, Record<string, string>> = {
  tg: {
    music: "🎵 Барои «{q}» аз манбаъҳои қонунӣ инҳоро ёфтам:",
    movie: "🎬 Барои «{q}» инҳоро ёфтам:",
    any: "🔎 Барои «{q}» инҳоро ёфтам:",
    corrected: "Натиҷаҳо барои «{c}» (шумо «{q}» навиштед).",
    none: "Барои «{q}» дар манбаъҳои қонунӣ чизе ёфт нашуд.",
    noneHint: "Шояд инҳоро дар назар доред:",
    askMusic: "Номи суруд ё ҳунармандро нависед — ман онро дар манбаъҳои қонунӣ меёбам.",
    askMovie: "Номи филмро нависед — ман онро дар манбаъҳои қонунӣ меёбам.",
    askAny: "Номи суруд, ҳунарманд ё филмро нависед — ман онро дар манбаъҳои қонунӣ меёбам.",
    error: "Ҷустуҷӯи медиа ҳоло дастрас нест. Каме баъд аз нав кӯшиш кунед.",
    pro: "Ҷустуҷӯи мусиқӣ дар ChatGem Pro аст. Pro-ро гиред — лимит меравад ва сурудро дар чат меёбед, мешунавед ва агар манбаъ иҷозат диҳад, боргирӣ мекунед.\n\n[Pro гиред](/app/billing)",
  },
  ru: {
    music: "🎵 Вот что нашлось по «{q}» в легальных источниках:",
    movie: "🎬 Вот что нашлось по «{q}»:",
    any: "🔎 Вот что нашлось по «{q}»:",
    corrected: "Результаты для «{c}» (вы написали «{q}»).",
    none: "По «{q}» в легальных источниках ничего не нашлось.",
    noneHint: "Возможно, вы имели в виду:",
    askMusic: "Напишите название песни или исполнителя — я найду её в легальных источниках.",
    askMovie: "Напишите название фильма — я найду его в легальных источниках.",
    askAny: "Напишите название песни, исполнителя или фильма — я найду это в легальных источниках.",
    error: "Поиск медиа сейчас недоступен. Попробуйте чуть позже.",
    pro: "Поиск музыки есть в ChatGem Pro. Возьмите Pro — лимит снимется, и песню можно найти, слушать и скачать, если источник разрешает.\n\n[Взять Pro](/app/billing)",
  },
  en: {
    music: "🎵 Here is what I found for “{q}” from legal sources:",
    movie: "🎬 Here is what I found for “{q}”:",
    any: "🔎 Here is what I found for “{q}”:",
    corrected: "Showing results for “{c}” (you typed “{q}”).",
    none: "Nothing matched “{q}” in the legal sources.",
    noneHint: "Did you mean:",
    askMusic: "Tell me the song or artist name and I'll find it from legal sources.",
    askMovie: "Tell me the film title and I'll find it from legal sources.",
    askAny: "Tell me a song, artist or film and I'll find it from legal sources.",
    error: "Media search is unavailable right now. Please try again shortly.",
    pro: "Music search is part of ChatGem Pro. Get Pro and the message limit lifts. Then you can find a song in chat, play it, and download it when the source allows.\n\n[Get Pro](/app/billing)",
  },
};

function lang(locale: string | undefined): Lang {
  const code = (locale ?? "tg").slice(0, 2);
  return code === "ru" || code === "en" ? code : "tg";
}

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

/** Keeps the JSON inside the fence: no backticks can close it early. */
function encode(result: MediaSearchResult): string {
  return JSON.stringify(result).replace(/`/g, "\\u0060");
}

export function mediaReplyMarkdown(result: MediaSearchResult, locale?: string): string {
  const t = TEXT[lang(locale)];
  const shown = result.corrected ?? result.query;
  const intro = result.items.length
    ? [fill(t[result.kind], { q: shown }), result.corrected ? fill(t.corrected, { c: result.corrected, q: result.query }) : ""]
    : [fill(t.none, { q: result.query }), result.suggestions.length ? t.noneHint : ""];
  return `${intro.filter(Boolean).join("\n\n")}\n\n\`\`\`${MEDIA_FENCE}\n${encode(result)}\n\`\`\``;
}

export function mediaAskMarkdown(kind: MediaSearchKind, locale?: string): string {
  const t = TEXT[lang(locale)];
  return kind === "music" ? t.askMusic : kind === "movie" ? t.askMovie : t.askAny;
}

export function mediaErrorMarkdown(locale?: string): string {
  return TEXT[lang(locale)].error;
}

export function musicProMarkdown(locale?: string): string {
  return TEXT[lang(locale)].pro;
}

const HTTPS = /^https:\/\/[^\s]+$/i;

function safeUrl(value: unknown): string | undefined {
  return typeof value === "string" && HTTPS.test(value) ? value : undefined;
}

function str(value: unknown, max = 400): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Rebuilds items field by field: message content is user-editable data, not trusted markup. */
function parseItem(raw: unknown): MediaItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = str(o.title, 200);
  const kind = o.kind === "movie" ? "movie" : o.kind === "music" ? "music" : null;
  const source = o.source as Record<string, unknown> | undefined;
  if (!title || !kind || !source || typeof source !== "object") return null;
  const play = o.play as Record<string, unknown> | undefined;
  const download = o.download as Record<string, unknown> | undefined;
  const playUrl = safeUrl(play?.url);
  const downloadUrl = safeUrl(download?.url);
  const links = Array.isArray(o.links)
    ? o.links
        .map((l) => l as Record<string, unknown>)
        .filter((l) => safeUrl(l?.url) && str(l?.label, 80))
        .map(
          (l): MediaLink => ({
            label: str(l.label, 80)!,
            url: safeUrl(l.url)!,
            role: l.role === "listen" ? "listen" : l.role === "watch" ? "watch" : "info",
          }),
        )
        .slice(0, 4)
    : undefined;
  return {
    id: str(o.id, 200) ?? title,
    kind,
    title,
    artist: str(o.artist, 200),
    album: str(o.album, 200),
    year: num(o.year),
    description: str(o.description, 600),
    durationSec: num(o.durationSec),
    cover: safeUrl(o.cover),
    explicit: o.explicit === true,
    source: {
      provider: (["itunes", "commons", "wikipedia", "jamendo", "tmdb"] as const).find((p) => p === source.provider) ?? "wikipedia",
      name: str(source.name, 60) ?? "",
      url: safeUrl(source.url),
      license: str(source.license, 60),
    },
    play: playUrl
      ? { url: playUrl, kind: play?.kind === "video" ? "video" : "audio", preview: play?.preview === true, sourceName: str(play?.sourceName, 60) }
      : undefined,
    download:
      downloadUrl && typeof download?.mimeType === "string"
        ? {
            url: downloadUrl,
            mimeType: download.mimeType.slice(0, 80),
            size: num(download.size),
            sourceName: str(download.sourceName, 60),
            license: str(download.license, 60),
          }
        : undefined,
    links,
    score: num(o.score) ?? 0,
  };
}

export function parseMediaBlock(json: string): MediaSearchResult | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const kind = o.kind === "music" || o.kind === "movie" ? o.kind : "any";
  return {
    query: str(o.query, 100) ?? "",
    corrected: str(o.corrected, 100),
    kind,
    items: Array.isArray(o.items) ? o.items.map(parseItem).filter((i): i is MediaItem => Boolean(i)).slice(0, 12) : [],
    suggestions: Array.isArray(o.suggestions) ? o.suggestions.map((s) => str(s, 80)).filter((s): s is string => Boolean(s)).slice(0, 6) : [],
    providers: [],
  };
}

export type MessageSegment = { type: "markdown"; text: string } | { type: "media"; result: MediaSearchResult };

/** Markdown text around media blocks, in order, for rendering cards between paragraphs. */
export function splitMediaBlocks(content: string): MessageSegment[] {
  if (!content.includes("```" + MEDIA_FENCE)) return [{ type: "markdown", text: content }];
  const out: MessageSegment[] = [];
  let last = 0;
  for (const m of content.matchAll(FENCE_RE)) {
    const before = content.slice(last, m.index).trim();
    if (before) out.push({ type: "markdown", text: before });
    const result = parseMediaBlock(m[1]!);
    if (result) out.push({ type: "media", result });
    last = m.index! + m[0].length;
  }
  const after = content.slice(last).trim();
  if (after) out.push({ type: "markdown", text: after });
  return out;
}

function itemLine(item: MediaItem): string {
  const who = item.kind === "movie" ? (item.year ? ` (${item.year})` : "") : item.artist ? ` — ${item.artist}` : "";
  return `${item.title}${who} [${item.source.name}${item.download ? ", download allowed" : ""}]`;
}

/**
 * Plain-text version of a message with media blocks: what the AI sees in history and
 * what Copy / Share / text-to-speech use.
 */
export function stripMediaBlocks(content: string): string {
  if (!content.includes("```" + MEDIA_FENCE)) return content;
  return content
    .replace(FENCE_RE, (_, json: string) => {
      const result = parseMediaBlock(json);
      if (!result?.items.length) return result?.suggestions.length ? result.suggestions.join("; ") : "";
      return result.items.map((i) => `- ${itemLine(i)}`).join("\n");
    })
    .trim();
}
