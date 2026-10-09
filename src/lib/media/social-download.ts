/**
 * «Ин видеоро скачат кун https://instagram.com/reel/…» — social platforms forbid third-party
 * downloading in their terms, so the chat answers in code (not the LLM) with the platform's
 * own save button and a link back to the post.
 */

export type SocialPlatform = "instagram" | "tiktok" | "youtube" | "facebook" | "telegram" | "vk" | "vimeo" | "x";

export type SocialDownload = { platform: SocialPlatform; url: string };

const HOSTS: Array<[SocialPlatform, RegExp]> = [
  ["instagram", /(?:^|\.)instagram\.com$|^instagr\.am$/],
  ["tiktok", /(?:^|\.)tiktok\.com$/],
  ["youtube", /(?:^|\.)youtube\.com$|^youtu\.be$/],
  ["facebook", /(?:^|\.)facebook\.com$|^fb\.watch$/],
  ["telegram", /^t\.me$|^telegram\.me$/],
  ["vk", /(?:^|\.)vk\.com$|(?:^|\.)vkvideo\.ru$/],
  ["vimeo", /(?:^|\.)vimeo\.com$/],
  ["x", /^(?:www\.|mobile\.)?(?:x|twitter)\.com$/],
];

const DOWNLOAD_VERB =
  /скач|сохран|загруз|download|save|боргир|зеркаш|захира|юклаб|yukla|\bdl\b/i;

function platformOf(raw: string): SocialDownload | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  const hit = HOSTS.find(([, re]) => re.test(host));
  if (!hit) return null;
  url.protocol = "https:";
  return { platform: hit[0], url: url.toString() };
}

export function detectSocialDownload(text: string): SocialDownload | null {
  if (!DOWNLOAD_VERB.test(text.replace(/https?:\/\/\S+/gi, " "))) return null;
  for (const raw of text.match(/https?:\/\/[^\s<>"'«»]+/gi) ?? []) {
    const found = platformOf(raw.replace(/[),.!?]+$/, ""));
    if (found) return found;
  }
  return null;
}

const NAMES: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  telegram: "Telegram",
  vk: "VK",
  vimeo: "Vimeo",
  x: "X",
};

type Lang = "tg" | "ru" | "en";

const STEPS: Record<Lang, Record<SocialPlatform, string[]>> = {
  tg: {
    instagram: [
      "Reel-ро дар барномаи Instagram кушоед.",
      "Тугмаи ✈ (Фиристодан)-ро пахш кунед.",
      "«Download» / «Скачать»-ро интихоб кунед — видео ба Галерея захира мешавад.",
    ],
    tiktok: ["Видеоро дар барномаи TikTok кушоед.", "Тугмаи ➦ (Мубодила)-ро пахш кунед.", "«Save video» / «Сохранить видео»-ро интихоб кунед."],
    youtube: ["Видеоро дар барномаи YouTube кушоед.", "Дар зери видео тугмаи «Download» / «Скачать»-ро пахш кунед — видео дар худи YouTube офлайн захира мешавад."],
    facebook: ["Видеоро дар Facebook кушоед.", "«⋯»-ро пахш кунед ва «Save video»-ро интихоб кунед."],
    telegram: ["Видеоро дар Telegram кушоед.", "«⋯»-ро пахш кунед ва «Save to Gallery» / «Сохранить в галерею»-ро интихоб кунед."],
    vk: ["Видеоро дар барномаи VK кушоед.", "Агар муаллиф иҷозат дода бошад, аз менюи «⋯» «Скачать»-ро интихоб кунед."],
    vimeo: ["Видеоро дар Vimeo кушоед.", "Агар муаллиф иҷозат дода бошад, дар зери видео тугмаи «Download» ҳаст."],
    x: ["Постро дар барномаи X кушоед.", "Онро бо 🔖 «Bookmark» нигоҳ доред."],
  },
  ru: {
    instagram: [
      "Откройте Reels в приложении Instagram.",
      "Нажмите ✈ (Поделиться).",
      "Выберите «Скачать» — видео сохранится в Галерею.",
    ],
    tiktok: ["Откройте видео в приложении TikTok.", "Нажмите ➦ (Поделиться).", "Выберите «Сохранить видео»."],
    youtube: ["Откройте видео в приложении YouTube.", "Нажмите «Скачать» под видео — оно сохранится офлайн в самом YouTube."],
    facebook: ["Откройте видео в Facebook.", "Нажмите «⋯» и выберите «Сохранить видео»."],
    telegram: ["Откройте видео в Telegram.", "Нажмите «⋯» и выберите «Сохранить в галерею»."],
    vk: ["Откройте видео в приложении VK.", "Если автор разрешил, в меню «⋯» есть «Скачать»."],
    vimeo: ["Откройте видео на Vimeo.", "Если автор разрешил, под видео есть кнопка «Download»."],
    x: ["Откройте пост в приложении X.", "Сохраните его через 🔖 «Закладки»."],
  },
  en: {
    instagram: ["Open the reel in the Instagram app.", "Tap ✈ (Share).", "Choose “Download” — the video is saved to your Gallery."],
    tiktok: ["Open the video in the TikTok app.", "Tap ➦ (Share).", "Choose “Save video”."],
    youtube: ["Open the video in the YouTube app.", "Tap “Download” under the video — it is saved offline inside YouTube."],
    facebook: ["Open the video on Facebook.", "Tap “⋯” and choose “Save video”."],
    telegram: ["Open the video in Telegram.", "Tap “⋯” and choose “Save to Gallery”."],
    vk: ["Open the video in the VK app.", "If the author allows it, “Download” is in the “⋯” menu."],
    vimeo: ["Open the video on Vimeo.", "If the author allows it, there is a “Download” button under the video."],
    x: ["Open the post in the X app.", "Keep it with 🔖 “Bookmark”."],
  },
};

const TEXT: Record<Lang, { cant: string; how: string; missing: string; song: string; open: string }> = {
  tg: {
    cant: "Ман видеоро аз {name} бевосита скачат карда наметавонам: {name} ин корро ба барномаҳои дигар иҷозат намедиҳад ва видео ба муаллифаш тааллуқ дорад.",
    how: "Роҳи расмӣ ва бехатар:",
    missing: "Агар тугмаи «Download» набошад, муаллиф скачатро манъ кардааст.",
    song: "🎵 Агар суруди ин видеоро хоҳед — номи он дар поёни видео навишта шудааст. Онро ба ман нависед, ман сурудро меёбам.",
    open: "Кушодани видео дар {name}",
  },
  ru: {
    cant: "Я не могу скачать видео из {name} напрямую: {name} запрещает это сторонним приложениям, а видео принадлежит автору.",
    how: "Официальный и безопасный способ:",
    missing: "Если кнопки «Скачать» нет — автор запретил скачивание.",
    song: "🎵 Если нужна песня из этого видео — её название написано внизу видео. Напишите его мне, и я найду песню.",
    open: "Открыть видео в {name}",
  },
  en: {
    cant: "I can't download videos from {name} directly: {name} doesn't allow other apps to do it, and the video belongs to its creator.",
    how: "The official, safe way:",
    missing: "If there is no “Download” button, the creator has turned downloads off.",
    song: "🎵 Want the song from this video? Its name is shown at the bottom of the video — send it to me and I'll find the song.",
    open: "Open the video on {name}",
  },
};

function lang(locale: string): Lang {
  const code = locale.split("-")[0]?.toLowerCase();
  return code === "ru" || code === "en" ? code : "tg";
}

export function socialDownloadMarkdown(found: SocialDownload, locale: string): string {
  const l = lang(locale);
  const t = TEXT[l];
  const name = NAMES[found.platform];
  const fill = (s: string) => s.replaceAll("{name}", name);
  const href = found.url.replace(/[()]/g, (c) => encodeURIComponent(c));
  const lines = [
    fill(t.cant),
    "",
    t.how,
    ...STEPS[l][found.platform].map((step, i) => `${i + 1}. ${step}`),
  ];
  if (["instagram", "tiktok", "youtube", "vk", "vimeo"].includes(found.platform)) lines.push("", t.missing);
  lines.push("", `[${fill(t.open)}](${href})`, "", t.song);
  return lines.join("\n");
}
