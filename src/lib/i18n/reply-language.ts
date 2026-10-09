import { getLocaleInfo } from "@/lib/i18n/locales";

/**
 * "Answer in X" requests inside the message itself. Word boundaries matter: «ба Русия» (to Russia)
 * or «на русском рынке» must not switch the reply language.
 */
const EXPLICIT_REQUESTS: Array<[string, RegExp]> = [
  [
    "en",
    /\b(?:in|into|to)\s+english\b|по-английски|на\s+английском(?:\s+языке|(?=\s*[.,!?)]|\s*$))|(?:ба|бо)\s+(?:забони\s+)?англис[иӣ](?!\p{L})/iu,
  ],
  [
    "ru",
    /\b(?:in|into|to)\s+russian\b|по-русски|на\s+русском(?:\s+языке|(?=\s*[.,!?)]|\s*$))|(?:ба|бо)\s+(?:забони\s+)?рус[иӣ](?!\p{L})/iu,
  ],
  [
    "tg",
    /\b(?:in|into|to)\s+tajik\b|по-таджикски|на\s+таджикском(?:\s+языке|(?=\s*[.,!?)]|\s*$))|(?:ба|бо)\s+(?:забони\s+)?то[чҷ]ик[иӣ](?!\p{L})/iu,
  ],
];

function baseCode(locale: string) {
  return locale.split("-")[0]?.toLowerCase() || "tg";
}

/** Language the user asked for in this message, if any (the last one mentioned wins). */
export function explicitReplyLocale(text: string): string | null {
  let best: { code: string; at: number } | null = null;
  for (const [code, re] of EXPLICIT_REQUESTS) {
    const m = re.exec(text);
    if (m && (!best || m.index > best.at)) best = { code, at: m.index };
  }
  return best?.code ?? null;
}

/**
 * The reply language is the language the user selected in the app. The text of the question
 * never overrides it (Tajik typed without ҳ/ҷ/ӯ/ӣ looks like Russian); only an explicit request does.
 */
export function replyLocaleFor(text: string, selectedLocale: string): string {
  return explicitReplyLocale(text) ?? baseCode(selectedLocale);
}

export function replyLanguageLabel(locale: string): string {
  const code = baseCode(locale);
  if (code === "tg") return "Tajik (тоҷикӣ, Cyrillic script)";
  const info = getLocaleInfo(code);
  return info.code === code ? `${info.name} (${info.native})` : code;
}
