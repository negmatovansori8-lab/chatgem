import { chatRepository } from "@/repositories/chat-repository";
import { memoryRepository } from "@/repositories/memory-repository";
import { knowledgeRepository } from "@/repositories/knowledge-repository";
import { projectRepository } from "@/repositories/project-repository";
import { subscriptionRepository } from "@/repositories/subscription-repository";
import {
  prefsRepository,
  prefsToSystemBlock,
} from "@/repositories/prefs-repository";
import { consumeFreeTurn } from "@/server/free-limit";
import { canUseProMusic } from "@/server/music-access";
import { appendGuestCookie, getRequestUserId } from "@/server/session";
import { streamChatCompletion } from "@/services/ai/stream";
import { chatMessageSchema } from "@/types/chat";
import { pluginSystemPrompt } from "@/features/tools/plugins-catalog";
import { wantsImageGeneration } from "@/lib/image-prompt";
import { generateImageFromPrompt } from "@/lib/generate-image";
import { needsWebSearch, searchContextForChat } from "@/lib/chat-web-search";
import { buildMapAssist, mapAssistMarkdown } from "@/lib/maps/assist";
import { replyLanguageLabel, replyLocaleFor } from "@/lib/i18n/reply-language";
import { resolveMapAssist } from "@/lib/maps/assist-server";
import { voiceLanguage } from "@/lib/voice/languages";
import { detectMediaIntent } from "@/lib/media/intent";
import { isStrongMatch } from "@/lib/media/rank";
import { detectSocialDownload, socialDownloadMarkdown } from "@/lib/media/social-download";
import { encyclopediaBlock, encyclopediaSubject, lookupEncyclopedia } from "@/lib/assistant/encyclopedia";
import {
  mediaAskMarkdown,
  mediaErrorMarkdown,
  mediaReplyMarkdown,
  musicProMarkdown,
  stripMediaBlocks,
} from "@/lib/media/chat-block";
import { searchMedia } from "@/services/media/search";
import {
  answerMaxTokens,
  answerModeBlock,
  deliverableRewriteInstruction,
  deliverableScore,
  detectAnswerPlanInContext,
  isWeakDeliverable,
  withDeliverableReminder,
} from "@/lib/assistant/answer-mode";

function encodeSse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/** The reply language is decided in code (`replyLocaleFor`); the model must not re-guess it. */
function languageRules(replyCode: string, selectedCode: string, voiceTurn: boolean) {
  const label = replyLanguageLabel(replyCode);
  const reason = voiceTurn
    ? "the language of this voice conversation"
    : replyCode === selectedCode.split("-")[0]
      ? "the language the user selected in the app"
      : "the language the user explicitly asked for in this message";
  return [
    "LANGUAGE (MANDATORY — overrides every other language hint in this prompt):",
    `- Write the whole reply ONLY in ${label} — ${reason}.`,
    "- Keep this language even if the question is written in another language, in ALL CAPS, or in Tajik typed without special letters (х/ч/у/и/к/г instead of ҳ/ҷ/ӯ/ӣ/қ/ғ — that is still Tajik, NOT Russian), and even if earlier replies in this chat used another language.",
    "- Switch only when the user explicitly asks for another language in the current message.",
    "- Code, commands, proper names and quoted text stay as they are; everything you write yourself is in the reply language. Never mix languages.",
    ...(replyCode === "tg"
      ? [
          "- Tajik: proper Cyrillic with ҳ, ҷ, ӯ, ӣ, қ, ғ; natural Tajik words — not Russian, not Persian script.",
          "- Use established Tajik terminology (e.g. мавҷ, дарозии мавҷ, басомад, нур, атмосфера, молекула, энергия, ҳуҷайра, муодила). If you are not sure of a Tajik term, use the common international word with a short explanation — never invent words or word-for-word calques.",
          "- Write like an educated native speaker and a good Tajik textbook: correct izofa, verb endings and word order.",
          "- NEVER output Arabic/Persian-script letters inside Tajik text (write «мавҷ», never «موج»); every Tajik word is Cyrillic.",
        ]
      : []),
  ].join("\n");
}

/** Voice Mode: the reply is read aloud, so it must sound like natural speech in the user's language. */
function voiceModeBlock(language?: string, speaker?: "woman" | "man") {
  const lang = voiceLanguage(language);
  const name = lang ? `${lang.native} (${lang.english})` : "the language the user spoke";
  const persona =
    speaker === "woman"
      ? "- The user is a woman. Speak as a woman: natural first person, the way a woman talks in this language. Never sound like a man."
      : speaker === "man"
        ? "- The user is a man. Speak as a man: natural first person, the way a man talks in this language. Never sound like a woman."
        : "";
  return [
    "VOICE CONVERSATION MODE — your reply is spoken aloud by text-to-speech. These rules OVERRIDE every formatting, structure and length rule above:",
    `- The user spoke ${name}. Reply in that language unless they explicitly ask for another one. Tajik → Tajik Cyrillic.`,
    "- If the user mixed languages, answer in the dominant one.",
    "- You can talk about ANYTHING: daily life, school, science, news, work, health, places, stories, advice, and whatever they bring up next.",
    "- Do not lock the chat onto one subject. If they ask whether you can discuss something, say yes — you can talk about everything — then ask what they want now. Follow their latest sentence and drop the old topic when they change it.",
    "- Sound like a friendly person in a live conversation: natural, warm, concise. Usually 1–4 short sentences; go longer only when asked for details or steps.",
    persona,
    "- Plain spoken sentences: no markdown, headings, bullet symbols, tables, emojis or URLs. Say numbers, dates and units the way people say them.",
    "- If the transcript looks garbled, cut off or meaningless, briefly ask the user to repeat — never guess what they meant.",
    "- Only when the user explicitly asks for code, a table or a long document: start with one spoken sentence, then add it in markdown (the app shows it in the chat and skips it when speaking).",
  ]
    .filter(Boolean)
    .join("\n");
}

function isCorrectionRequest(text: string) {
  return /ҷавоб(и)?\s*дуруст|правильно|correct\s*answer|дуруст\s*деҳ|дуруст\s*гӯй|боз\s*ҷавоб|лучше\s*отве|wrong|хато|нодуруст/i.test(
    text,
  );
}

function isEmptyAck(text: string) {
  return /^(бале|ҳа|ok|okay|да|yes)[,!.\s]*(ман\s+кӯшиш|бубинед|кӯшиш\s+мекунам|попробую|i'?ll\s+try)?[.!…]?$/i.test(
    text.trim(),
  );
}

/** «Салом», «раҳмат», «чӣ хел?», «хайр» — a short friendly reply is the right answer here. */
function isSmallTalk(text: string) {
  return /^(?:салом|салам|ассалом\S*|ассалому\s+алейкум|привет|здравствуй\S*|hi|hello|hey|раҳмат|рахмат|ташаккур|спасибо|thanks?(?:\s+you)?|хайр|пока|bye|ок|ok|okay|хуб|майлаш|чӣ\s*хел\S*|чи\s*хел\S*|чӣ\s*ҳол\S*|ҳолат\s+чӣ\s*хел|как\s+дела|how\s+are\s+you|субҳ\s+ба\s+хайр|шаб\s+ба\s+хайр|доброе\s+утро|добрый\s+(?:день|вечер)|good\s+(?:morning|evening|night))(?:[\s,!.?)]+(?:бародар|дӯстам|дустам|ака|апа|chatgem|бот|ту|шумо|друг|bro))*[\s!.?)]*$/iu.test(
    text.trim(),
  );
}

/** Lazy ChatGPT-style fluff: only names itself / "ask me anything" without teaching. */
function isLazyFluff(reply: string, userPrompt: string) {
  const t = reply.trim();
  const q = userPrompt.trim();
  if (isSmallTalk(q)) return false;
  // User asked something that looks like a real question (not "who are you")
  const askingIdentity =
    /ту\s*кист|номи\s*ту|who\s*are\s*you|как\s*тебя\s*зовут|что\s*ты\s*за/i.test(
      q,
    );
  if (askingIdentity) return false;

  const onlySelfIntro =
    /номи\s+ман\s+chatgem|меня\s+зовут\s+chatgem|my\s+name\s+is\s+chatgem|i'?m\s+chatgem/i.test(
      t,
    ) &&
    /агар\s+савол|если\s+есть|if\s+you\s+have|бо\s+хушнудӣ\s+кумак|с\s+радостью|happy\s+to\s+help/i.test(
      t,
    );

  if (onlySelfIntro) return true;

  // Ultra-short for a question that isn't clearly "yes/no" or math
  const looksLikeQuestion =
    /\?|чист|чӣ|чи|что|как|why|what|who|when|где|куҷо|чаро|кадом/i.test(q) ||
    q.split(/\s+/).length <= 4;
  if (looksLikeQuestion && t.length < 80 && !/\d/.test(t)) {
    // One short paragraph that's only greeting/intro
    if (/^салом|^привет|^hello/i.test(t) && t.length < 120) return true;
  }
  return false;
}

/** Extreme stubs only — short Q can get short A when the answer is actually the answer. */
function isTooShortStub(reply: string, userPrompt: string) {
  const wantsShort =
    /як\s*калима|танҳо\s*рақам|only\s*one\s*word|one\s*word|кӯтоҳ\s*ҷавоб|just\s*the\s*number/i.test(
      userPrompt,
    );
  if (wantsShort || isSmallTalk(userPrompt)) return false;
  if (isLazyFluff(reply, userPrompt)) return true;
  const t = reply.trim();
  // «2+2 чанд» → «4» is a complete answer.
  if (/\d/.test(t) && /^[\s\d.,:+\-–−×*/=%()°]+[\p{L}.%°]{0,12}$/u.test(t)) return false;
  if (t.length >= 100) return false;
  if (t.split(/\s+/).filter(Boolean).length >= 18) return false;
  // Real short facts OK (dates, numbers, day names) if not fluff
  if (/^\s*[\d\wа-яёғӣқӯҳҷА-ЯЁҒӢҚӮҲҶ\-–.,\s]{2,40}\s*$/i.test(t) && !/chatgem/i.test(t)) {
    return false;
  }
  return t.length < 40;
}

/** ChatGPT-quality assistant persona — world-class answers. */
function coreAssistantRules(isPro: boolean) {
  return [
    "YOU ARE ChatGem — a world-class AI assistant at ChatGPT / Claude quality.",
    "Every answer must feel excellent: clear, correct, complete, and easy to use.",
    "",
    "LANGUAGE:",
    "- Reply in the language given in the LANGUAGE section below (the user's selected app language).",
    "- Understand questions in any language or spelling; fix typos from context; never refuse for typos or ALL CAPS.",
    "",
    "INTENT ROUTING (pick the best response shape):",
    "- Coding → working code in fenced blocks + short what/why. Language tag on fences.",
    "- Translation → polished translation first; optional nuance notes after.",
    "- Math / calculation → numbered steps, then **final answer** clearly.",
    "- Ideas / brainstorm → 5–8 structured bullets or a short numbered list.",
    "- Prompt engineering / «промт диҳ» / ТЗ / for Cursor, ChatGPT, Gemini → a COMPLETE ready-to-paste prompt in one ```text block (follow ANSWER MODE below). Do NOT generate an image. Never replace the prompt with advice.",
    "- Website / app / bot idea → ТЗ + project structure + ready prompt — a practical deliverable, not tips.",
    "- Image CREATE request («сурат соз», «логотип соз», «нарисуй», «create an image») → the app generates the image; confirm briefly. NEVER reply with a weak Midjourney/Cursor prompt instead of generating.",
    "- Ordinary questions (what/how/why/савол) → answer in text. Never start image generation for Q&A.",
    "- When writing any image prompt for the user: world-class craft (subject, lighting, materials, composition, lens/design). Never thin prompts like «blue and white abstract symbol».",
    "- File / screenshot analysis → describe what you see, then actionable help.",
    "- Simple factual Q → short direct answer; no essay.",
    "- Complex / tutoring → headings + bullets + one example.",
    "",
    "UNDERSTAND THE QUESTION (critical):",
    "- Infer what the user MOST LIKELY wants — never the laziest reading.",
    "- Short ALL-CAPS Tajik like «ИСМ ЧИСТ» is often a REAL subject question, NOT «what is your name».",
    "  • «ИСМ ЧИСТ» → grammar: what a noun (исм) is + 3–5 examples + tip.",
    "  • «канспект / конспект синфи N» → real school notes: topic outline, key points, short examples for that grade.",
    "  • «РУЗИ ЧИСТ» → correct day/date + one-line reason.",
    "- Only say your name if they clearly ask who you are.",
    "- Fix Tajik typed without special letters: х→ҳ, ч→ҷ, у→ӯ, и→ӣ («дех» = «деҳ», «сатхи чахони» = «сатҳи ҷаҳонӣ» = world-class quality).",
    "- If critical details are missing, proceed with sensible, clearly stated assumptions; ask ONE short question only when an answer is truly impossible without it.",
    "- If ambiguous but answerable two ways, cover top 2 meanings briefly (A / B), then ask which one.",
    "",
    "LENGTH:",
    "- Greetings and small talk («салом», «раҳмат», «чӣ хел?», «привет», «thanks») → reply like a friendly person in 1–2 short sentences (e.g. «Салом! Чӣ хизмат кунам?»). Never explain what the greeting word means.",
    "- Simple yes-no / one-fact → 1–3 short sentences.",
    "- How-to / tutoring / analysis → structured detail with headings and lists.",
    "- Never pad with filler; never invent current events without search context.",
    "",
    "WORLD-CLASS ANSWER STRUCTURE:",
    "1) First sentence = direct answer.",
    "2) Then a clear explanation a student can understand.",
    "3) Examples, steps, or mini lists when useful.",
    "4) Markdown ALWAYS when it helps readability:",
    "   - ## / ### headings for longer answers",
    "   - **bold** key terms",
    "   - bullets and numbered lists",
    "   - tables when comparing options",
    "   - fenced code with language tags",
    "   - formulas in LaTeX: inline $$E = mc^2$$, display on its own lines between $$ … $$ (never bare \\frac or \\lambda in plain text)",
    "5) NEVER dump one giant wall of text — break into short paragraphs.",
    "6) School / conspect → title, main ideas, definitions, 3–7 bullets, short example.",
    "7) NEVER invent facts. If unsure, say so briefly and give the best known answer.",
    "8) NEVER end with empty «Агар саволи дигаре доред…» unless the answer was already complete.",
    "9) Keep simple questions short; only expand when the task is complex.",
    "10) When LIVE WEB SEARCH RESULTS are provided, use them and cite as [1], [2] with URLs.",
    "",
    "FORBIDDEN lazy replies:",
    "- Only «Номи ман ChatGem аст» for a subject question.",
    "- Only «Бале / Кӯшиш мекунам / Look».",
    "- One-sentence brush-offs with no teaching value.",
    "- Refusing ordinary school, science, language, math, daily-life, or coding help.",
    "",
    "DELIVER, DON'T JUST ADVISE: when the user wants to build or create something, hand over the ready result (prompt, ТЗ, code, plan).",
    "",
    "BEFORE SENDING (silent self-check — never print it):",
    "- Did I understand the real intent? Is EVERY explicit requirement covered — nothing important dropped?",
    "- Is the output directly usable (copy-paste ready prompt/code), correct, clear and professional?",
    "- Does the length fit: simple question → short; technical → steps; build → ТЗ + structure + prompt?",
    "",
    "ALWAYS ANSWER ordinary questions. Typos, ALL CAPS, mixed languages — still answer fully.",
    "TONE: warm expert tutor — accurate, patient, professional.",
    isPro
      ? "- Pro: deeper detail, still clear and structured."
      : "- Free: same correctness and clarity as Pro for the answer itself.",
  ].join("\n");
}

function groundedFacts() {
  return [
    "FACT ANCHOR (when relevant):",
    "- Tajikistan capital: Душанбе. Currency: сомонӣ (TJS). Language: тоҷикӣ.",
    "- «Исмоили Сомонӣ» (849–907) is a person: amir of Bukhara and founder of the Samanid state; the currency is named after him. A question about him is about the person, not the money.",
    "- You are ChatGem.",
  ].join("\n");
}


function mediaCapabilityRules() {
  return [
    "MEDIA & VISION (mandatory when relevant):",
    "- Guests and signed-in users get full helpful answers — no account required to chat.",
    "- IMAGE GENERATION: Only when the user clearly asks YOU to create a picture NOW (сурат соз, тасвир соз, акс соз, логотип/логатип соз, нарисуй, create an image, «ба ман мошин соз»). For logo requests: GENERATE a world-class ChatGem logo — do NOT answer with text tips. Bare «СОЗ» after logo intent = create the logo. Do NOT generate when they ask for a prompt or a question (промт диҳ, барои Cursor). Do NOT invent random letters like C03.",
    "- When images OR video frames are attached: LOOK carefully. Read on-screen text (OCR), logos, actors, posters, UI chrome (Netflix, YouTube, TikTok, Telegram).",
    "- MOVIE / SERIES / CLIP ID (highest priority when media looks like entertainment):",
    "  1) First line: official title in original language + common local title if known (e.g. English + Russian).",
    "  2) Year, type (film / series / anime / clip), and 1-line why you think so.",
    "  3) If unsure: give top 2–3 candidates with confidence (high/medium/low) — never invent a fake title.",
    "  4) Then optional: IMDb / Wikipedia / YouTube trailer search links.",
    "- Screenshots from gallery, WhatsApp, Telegram, Instagram, TikTok, or phone camera: treat as identify-this-media requests even if the user only attaches the file with little/no text.",
    "- Beautify / edit photo requests (when they already attached a photo AND ask to improve it): describe concrete improvements. Suggest /app/gallery only for a brand-new image from a prompt.",
    "- Video: frames may be attached as images — use them like screenshots to name the film/show/clip.",
    "- Video/photo LINKS (YouTube, TikTok, Instagram, Telegram, etc.): identify from URL path, slug, title text the user pasted, and any description. Reply with the correct title.",
    "- ALWAYS give real clickable https:// links when helpful (YouTube, Google, IMDb, Wikipedia). Prefer full URLs on their own line.",
    "- If user asks скачать / скачат / download a movie or video: you CANNOT provide pirate/torrent/crack links — never.",
    "- BUT you MUST still give useful legal links, for example:",
    "  • YouTube search: https://www.youtube.com/results?search_query=MOVIE+NAME+trailer",
    "  • Google: https://www.google.com/search?q=MOVIE+NAME+watch+online+legal",
    "  • IMDb: https://www.imdb.com/find/?q=MOVIE+NAME",
    "  • Replace MOVIE+NAME with the real title encoded with +.",
    "- Also name legal apps (YouTube, Netflix, Instagram Reels save for own content, etc.) briefly.",
    "- Public-domain / user-owned media: OK to guide how to save their own file from their device or official export.",
  ].join("\n");
}

function wantsLegalMediaLinks(text: string) {
  return /скач|download|\bdl\b|трейлер|trailer|ютуб|youtube|линк.*(?:кино|фильм|видео)|(?:кино|фильм|видео).*(?:линк|скач)|что\s*за\s*фильм|номи\s*кино|watch\s*online/i.test(
    text,
  );
}

function extractMediaSearchQuery(userText: string, assistantText: string) {
  const fromReply =
    assistantText.match(/[«"„]([^»"“]{2,80})[»"“]/)?.[1] ||
    assistantText.match(
      /(?:ном(?:и)?|title|фильм|кино|movie)\s*[:\-–]\s*([^\n.!?]{2,80})/i,
    )?.[1];

  let q = userText
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(
      /скачать|скачат|скачай|download|линкро|линк|link|видеоро|видео|video|фильми|фильм|кинои|кино|номи|ёб|гузор|соз|кун|please|pls|ро\s+мехоҳам/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (q.length < 2 && fromReply) q = fromReply.trim();
  if (q.length < 2) q = fromReply?.trim() || "movie trailer";
  return q.split(/\s+/).slice(0, 10).join(" ");
}

function buildLegalMediaLinks(query: string, locale?: string) {
  const encoded = encodeURIComponent(query);
  const yt = `https://www.youtube.com/results?search_query=${encoded}`;
  const google = `https://www.google.com/search?q=${encoded}`;
  const imdb = `https://www.imdb.com/find/?q=${encoded}`;
  const ui = (locale || "tg").split("-")[0]?.toLowerCase() ?? "tg";

  if (ui === "ru") {
    return [
      "",
      "Ссылки:",
      `YouTube: ${yt}`,
      `Google: ${google}`,
      `IMDb: ${imdb}`,
    ].join("\n");
  }
  if (ui === "en") {
    return [
      "",
      "Links:",
      `YouTube: ${yt}`,
      `Google: ${google}`,
      `IMDb: ${imdb}`,
    ].join("\n");
  }
  return [
    "",
    "Линкҳо:",
    `YouTube: ${yt}`,
    `Google: ${google}`,
    `IMDb: ${imdb}`,
  ].join("\n");
}

function ensureLegalMediaLinks(
  reply: string,
  userPrompt: string,
  locale?: string,
) {
  if (!wantsLegalMediaLinks(userPrompt)) return reply;
  if (/youtube\.com|imdb\.com|google\.com\/search/i.test(reply)) return reply;
  const query = extractMediaSearchQuery(userPrompt, reply);
  return `${reply.trim()}${buildLegalMediaLinks(query, locale)}`;
}

/** Expand meta-commands into a real answer task using prior user question. */
function resolveUserPrompt(
  content: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
) {
  if (!isCorrectionRequest(content)) return content;
  const prevUser = [...history].reverse().find((m) => m.role === "user");
  if (!prevUser?.content?.trim()) {
    return `${content}\n\n(User wants a correct full answer now — do not acknowledge; answer helpfully.)`;
  }
  return [
    `The user rejected the previous reply and demands a CORRECT answer.`,
    `Original question to answer fully now:`,
    prevUser.content,
    `Write only the correct answer, in the reply language from the LANGUAGE rules. No «I will try», no «look», no apologies — just the answer.`,
  ].join("\n");
}

function defaultMediaPrompt(
  content: string,
  attachments?: Array<{ name: string; mimeType: string; size: number }>,
) {
  const trimmed = content.trim();
  const urlMatch = trimmed.match(
    /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|tiktok\.com|instagram\.com|t\.me|telegram\.me|vk\.com|facebook\.com|fb\.watch|vimeo\.com|netflix\.com|imdb\.com)\S*/i,
  );
  const names = attachments?.map((a) => `${a.name} (${a.mimeType})`).join(", ") ?? "";
  const hasImage = Boolean(
    attachments?.some(
      (a) =>
        a.mimeType.startsWith("image/") ||
        /-frame\d+\.jpg$/i.test(a.name),
    ),
  );
  const hasVideo = Boolean(
    attachments?.some((a) => a.mimeType.startsWith("video/")),
  );

  if (trimmed) {
    let prompt = trimmed;
    if (attachments?.length) {
      prompt += `\n\n[Attached files: ${names}]`;
    }
    if (urlMatch) {
      prompt +=
        "\n\n[Link shared from another app. Identify the exact movie/show/clip title from this URL and any attached frames. Lead with the correct name.]";
    }
    if (hasImage || hasVideo) {
      prompt +=
        "\n\n[Vision task: If this is a poster, screenshot, or video frame of a film/series/clip, name the title correctly first. Use OCR on any on-screen text.]";
    }
    return prompt;
  }

  if (!attachments?.length && !urlMatch) return content;

  if (hasImage || hasVideo) {
    return [
      "Ин акс/видео аз галерея ё барномаи дигар фиристода шуд.",
      "Номи кино / сериал / клипро дуруст гӯй (title + year агар маълум бошад).",
      "Агар номуайян бошад — 2–3 номзади эҳтимолӣ бо эътимод.",
      "Матинҳои рӯйи экранро (OCR) хон.",
      names ? `Файлҳо: ${names}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (urlMatch) {
    return `User shared this link from another app: ${urlMatch[0]}. Identify the exact movie, series, or video title. Answer with the correct name first, then a short note and useful legal links.`;
  }

  return `User attached: ${names}. Help with their request.`;
}

async function buildSystemPrompt(
  userId: string,
  userMessage: string,
  language: { reply: string; selected: string; voice: boolean },
  pluginId?: string,
  agentInstructions?: string,
  webBlock?: string,
  answerBlock?: string,
  voiceBlock?: string,
) {
  let isPro = false;
  try {
    isPro = await subscriptionRepository.isProOrBetter(userId);
  } catch {
    // optional
  }

  const parts = [
    coreAssistantRules(isPro),
    groundedFacts(),
    languageRules(language.reply, language.selected, language.voice),
    mediaCapabilityRules(),
  ];

  if (webBlock?.trim()) {
    parts.push(webBlock.trim());
  }

  if (pluginId) {
    const plug = pluginSystemPrompt(pluginId);
    if (plug) parts.push(plug);
  }

  if (agentInstructions?.trim()) {
    parts.push(
      `CUSTOM AGENT MODE — follow these instructions carefully:\n${agentInstructions.trim()}`,
    );
  }

  try {
    const prefs = await prefsRepository.get(userId);
    const block = prefsToSystemBlock(prefs);
    if (block) parts.push(block);
  } catch {
    // optional
  }

  try {
    const enabled = await memoryRepository.isEnabled(userId);
    if (enabled) {
      const memories = await memoryRepository.list(userId);
      const active = memories.filter((m) => m.enabled).slice(0, 24);
      if (active.length) {
        parts.push(
          "User memories (use only when relevant):\n" +
            active.map((m) => `- ${m.content}`).join("\n"),
        );
      }
    }
  } catch {
    // optional
  }

  try {
    const projects = await projectRepository.list(userId);
    const withInstructions = projects
      .filter((p) => p.instructions?.trim())
      .slice(0, 5);
    if (withInstructions.length) {
      parts.push(
        "Active project instructions:\n" +
          withInstructions
            .map((p) => `- ${p.name}: ${p.instructions}`)
            .join("\n"),
      );
    }
  } catch {
    // optional
  }

  try {
    const bases = await knowledgeRepository.listBases(userId);
    const snippets: string[] = [];
    for (const base of bases.slice(0, 3)) {
      const hits = await knowledgeRepository.search(userId, base.id, userMessage);
      for (const hit of hits.slice(0, 3)) {
        snippets.push(`[${base.name}] ${hit.title}: ${hit.content.slice(0, 400)}`);
      }
    }
    if (snippets.length) {
      parts.push(
        "Knowledge base excerpts (use when relevant):\n" + snippets.join("\n---\n"),
      );
    }
  } catch {
    // optional
  }

  parts.push(
    "MAPS & NAVIGATION:",
    "- ChatGem has a live Maps module at /app/maps covering the whole world and all of Tajikistan.",
    "- For pharmacies, hospitals, cafés, addresses, routes («как добраться», «наздик», «аптека рядом»): briefly answer AND give a markdown link `/app/maps?q=QUERY`.",
    "- Never invent distances, walking/driving times, bus/marshrutka times or arrival times. Only the Maps routing provider supplies them; otherwise say «Маълумот дастрас нест».",
    "- Never claim you stored the user’s GPS; location is only used after the user allows it in the Maps UI.",
  );

  parts.push(
    "Формат: аввал ҷавоби асосӣ, баъд шарҳ/мисол агар лозим. Забони корбар. Дӯстона, равшан, бе маълумоти зиёдатӣ.",
  );

  // Last on purpose: the answer mode overrides the generic length/format rules above.
  if (answerBlock) parts.push(answerBlock);
  // Spoken replies override the written answer format.
  if (voiceBlock) parts.push(voiceBlock);

  return parts.join("\n\n");
}

export async function POST(request: Request) {
  const userId = await getRequestUserId(request);
  const body = await request.json().catch(() => null);
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    const headers = new Headers({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    });
    appendGuestCookie(headers, userId);
    return new Response(
      encodeSse({
        type: "error",
        code: "VALIDATION_ERROR",
        message: parsed.error.message,
      }),
      { status: 400, headers },
    );
  }

  const turn = await consumeFreeTurn(userId);
  if (!turn.ok) {
    const headers = new Headers({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    });
    appendGuestCookie(headers, userId);
    return new Response(
      encodeSse({
        type: "error",
        code: "USAGE_EXCEEDED",
        resetAt: turn.resetAt,
        limit: turn.limit,
        message: "Message limit reached",
      }),
      { status: 200, headers },
    );
  }

  // Never block answers on a stale chatId (Render disk wipe / guest mismatch).
  let chatId = parsed.data.chatId;
  if (chatId) {
    const existing = await chatRepository.get(userId, chatId);
    if (!existing) {
      chatId = undefined;
    }
  }
  if (!chatId) {
    const chat = await chatRepository.create(userId, {
      modelId: parsed.data.modelId,
    });
    chatId = chat.id;
  }

  const rawAttachments = parsed.data.attachments ?? [];
  const imageDataUrls = rawAttachments
    .map((a) => a.dataUrl)
    .filter((u): u is string => Boolean(u && /^data:image\//i.test(u)));
  const storedAttachments = rawAttachments.map(({ name, mimeType, size }) => ({
    name,
    mimeType,
    size,
  }));
  const userContent = defaultMediaPrompt(
    parsed.data.content ?? "",
    storedAttachments.length ? storedAttachments : undefined,
  );

  const isRegenerate = Boolean(parsed.data.regenerate);
  const editId = parsed.data.editMessageId?.trim();

  if (editId) {
    await chatRepository.truncateFromMessage(userId, chatId!, editId);
    await chatRepository.addMessage(userId, chatId!, {
      role: "USER",
      content: userContent,
      modelId: parsed.data.modelId ?? null,
      attachments: storedAttachments.length ? storedAttachments : undefined,
    });
  } else if (isRegenerate) {
    await chatRepository.removeLastAssistant(userId, chatId!);
    // Keep existing last USER message — do not append a duplicate.
  } else {
    await chatRepository.addMessage(userId, chatId!, {
      role: "USER",
      content: userContent,
      modelId: parsed.data.modelId ?? null,
      attachments: storedAttachments.length ? storedAttachments : undefined,
    });
  }

  const historyBundle = await chatRepository.get(userId, chatId!);
  const history =
    historyBundle?.messages
      .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
      .slice(0, -1)
      .map((m) => ({
        role: (m.role === "USER" ? "user" : "assistant") as "user" | "assistant",
        content: m.role === "USER" ? m.content : stripMediaBlocks(m.content),
      })) ?? [];

  const cookieLocale = (() => {
    const raw = request.headers.get("cookie") || "";
    const m = raw.match(/(?:^|;\s*)nj_locale=([^;]+)/);
    if (!m?.[1]) return undefined;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  })();
  const replyLocale = parsed.data.locale || cookieLocale || "tg";

  let webBlock = "";
  if (
    parsed.data.webSearch ||
    (needsWebSearch(userContent) && !imageDataUrls.length)
  ) {
    const found = await searchContextForChat(userContent);
    webBlock = found.block;
  }
  const encyclopediaTopic = imageDataUrls.length ? null : encyclopediaSubject(userContent);
  if (encyclopediaTopic) {
    const entry = await lookupEncyclopedia(
      encyclopediaTopic,
      AbortSignal.any([request.signal, AbortSignal.timeout(7000)]),
    ).catch(() => null);
        const note = entry
          ? encyclopediaBlock(entry)
          : `ENCYCLOPEDIA REFERENCE: none found for «${encyclopediaTopic}». Answer only from facts you are sure of (it may be a historical figure, a place or a known person under another spelling). If you do not reliably know this subject, say so in one or two sentences and ask the user to clarify. Never invent meanings, etymologies, tables or "possible interpretations".`;
        webBlock = [webBlock, note].filter(Boolean).join("\n\n");
  }

  const voiceTurn = Boolean(parsed.data.voice);
  const resolvedPrompt = resolveUserPrompt(userContent, history);
  const correction = isCorrectionRequest(userContent);
  const answerPlan = detectAnswerPlanInContext(
    resolvedPrompt,
    [...history].reverse().find((m) => m.role === "user")?.content,
  );
  const answerLocale = voiceTurn
    ? voiceLanguage(parsed.data.voice?.language)?.code ?? replyLocaleFor(userContent, replyLocale)
    : replyLocaleFor(userContent, replyLocale);
  const spokenPlan = voiceTurn && !answerMaxTokens(answerPlan);
  const speaker = parsed.data.voice?.speaker;
  const speakerLine =
    speaker === "woman"
      ? " Speak as a woman, because the user is a woman."
      : speaker === "man"
        ? " Speak as a man, because the user is a man."
        : "";
  const promptForModel = spokenPlan
    ? `${resolvedPrompt}\n\n(Voice reply: speak naturally in ${voiceLanguage(parsed.data.voice?.language)?.english ?? "the user's language"} about whatever they asked — any topic, not only the previous one. 1–4 short sentences, no lists, headings or markdown.${speakerLine})`
    : withDeliverableReminder(resolvedPrompt, answerPlan, answerLocale);
  const systemPrompt = await buildSystemPrompt(
    userId,
    userContent,
    { reply: answerLocale, selected: replyLocale, voice: voiceTurn },
    parsed.data.pluginId,
    parsed.data.agentInstructions,
    webBlock,
    // Structured "mini-lesson" answers would be read aloud as long lists — voice has its own style.
    spokenPlan ? undefined : answerModeBlock(answerPlan, answerLocale),
    voiceTurn ? voiceModeBlock(parsed.data.voice?.language, speaker) : undefined,
  );
  // Spoken answers stay short unless the user explicitly asked for code / a build.
  const maxTokens = answerMaxTokens(answerPlan) ?? (voiceTurn ? 900 : undefined);
  const encoder = new TextEncoder();
  let assistantText = "";
  let usedModel: string | null = parsed.data.modelId ?? null;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          encodeSse({
            type: "meta",
            chatId,
            modelId: usedModel,
            intent: "pending",
          }),
        ),
      );

      const socialDownload = !voiceTurn && !correction ? detectSocialDownload(userContent) : null;
      if (socialDownload) {
        const reply = socialDownloadMarkdown(socialDownload, answerLocale);
        assistantText = reply;
        usedModel = "media";
        await chatRepository.addMessage(userId, chatId!, { role: "ASSISTANT", content: reply, modelId: "media" });
        controller.enqueue(encoder.encode(encodeSse({ type: "replace", content: reply, chatId })));
        controller.enqueue(encoder.encode(encodeSse({ type: "meta", chatId, modelId: "media", intent: "media" })));
        controller.enqueue(encoder.encode(encodeSse({ type: "done", chatId })));
        controller.close();
        return;
      }

      // A named song or film is music search, even if the title is also a place («Medina»).
      const wantsImage = parsed.data.forceImage || wantsImageGeneration(userContent);
      const mediaIntent =
        !imageDataUrls.length && !correction && !wantsImage ? detectMediaIntent(userContent) : null;
      const musicAsk = mediaIntent?.kind === "music";
      const mediaFirst = Boolean(mediaIntent && (mediaIntent.explicit || musicAsk));

      // AI ↔ Maps: nearby/search/route intents and follow-ups ("How far is it?")
      const mapLocale = answerLocale;
      const detectedMapAssist =
        !mediaFirst &&
        !imageDataUrls.length &&
        !correction &&
        !wantsImage
          ? buildMapAssist({
              text: userContent,
              locale: mapLocale,
              context: parsed.data.mapContext,
            })
          : null;
      const mapAssist = detectedMapAssist
        ? await resolveMapAssist(detectedMapAssist, mapLocale, {
            tzOffsetMinutes: parsed.data.tzOffsetMinutes ?? parsed.data.mapContext?.tzOffsetMinutes,
          })
        : null;
      if (mapAssist) {
        const mapReply = mapAssistMarkdown(mapAssist, mapLocale);
        assistantText = mapReply;
        usedModel = "maps";
        const mapMessage = await chatRepository.addMessage(userId, chatId!, {
          role: "ASSISTANT",
          content: mapReply,
          modelId: "maps",
        });
        controller.enqueue(
          encoder.encode(
            encodeSse({ type: "replace", content: mapReply, chatId }),
          ),
        );
        controller.enqueue(
          encoder.encode(
            encodeSse({
              type: "meta",
              chatId,
              modelId: "maps",
              intent: "maps",
            }),
          ),
        );
        if (mapAssist.action) {
          controller.enqueue(
            encoder.encode(
              encodeSse({
                type: "action",
                action: "open_map",
                href: mapAssist.action.href,
                mapAction: mapAssist.action,
                messageId: mapMessage?.id,
              }),
            ),
          );
        }
        controller.enqueue(
          encoder.encode(encodeSse({ type: "done", chatId })),
        );
        controller.close();
        return;
      }

      // Legal media search: «Shape of You-ро ёб», «суруди …», «фильм …», or a bare title.
      if (musicAsk && !(await canUseProMusic())) {
        const reply = musicProMarkdown(answerLocale);
        assistantText = reply;
        usedModel = "media";
        await chatRepository.addMessage(userId, chatId!, {
          role: "ASSISTANT",
          content: reply,
          modelId: "media",
        });
        controller.enqueue(encoder.encode(encodeSse({ type: "replace", content: reply, chatId })));
        controller.enqueue(encoder.encode(encodeSse({ type: "meta", chatId, modelId: "media", intent: "media" })));
        controller.enqueue(encoder.encode(encodeSse({ type: "done", chatId })));
        controller.close();
        return;
      }
      if (
        mediaIntent &&
        (musicAsk || !voiceTurn) &&
        (mediaIntent.explicit || !(parsed.data.pluginId || parsed.data.agentInstructions))
      ) {
        let mediaReply: string | null = null;
        if (!mediaIntent.query) {
          if (mediaIntent.explicit) mediaReply = mediaAskMarkdown(mediaIntent.kind, answerLocale);
        } else {
          controller.enqueue(encoder.encode(encodeSse({ type: "status", message: "searching_media", chatId })));
          try {
            const result = await searchMedia(
              {
                query: mediaIntent.query,
                kind: mediaIntent.kind,
                artist: mediaIntent.artist,
                title: mediaIntent.title,
                quick: mediaIntent.bare,
                locale: answerLocale,
              },
              AbortSignal.any([request.signal, AbortSignal.timeout(mediaIntent.explicit ? 20_000 : 8_000)]),
            );
            if (mediaIntent.explicit) {
              mediaReply = result.providers.length ? mediaReplyMarkdown(result, answerLocale) : mediaErrorMarkdown(answerLocale);
            } else if (isStrongMatch(result.items, mediaIntent, mediaIntent.bare)) {
              mediaReply = mediaReplyMarkdown(result, answerLocale);
            }
          } catch {
            if (mediaIntent.explicit) mediaReply = mediaErrorMarkdown(answerLocale);
          }
        }
        if (mediaReply) {
          assistantText = mediaReply;
          usedModel = "media";
          await chatRepository.addMessage(userId, chatId!, {
            role: "ASSISTANT",
            content: mediaReply,
            modelId: "media",
          });
          controller.enqueue(encoder.encode(encodeSse({ type: "replace", content: mediaReply, chatId })));
          controller.enqueue(encoder.encode(encodeSse({ type: "meta", chatId, modelId: "media", intent: "media" })));
          controller.enqueue(encoder.encode(encodeSse({ type: "done", chatId })));
          controller.close();
          return;
        }
      }

      // ChatGPT-style: generate images in chat instead of LLM refusal.
      if (
        (parsed.data.forceImage || wantsImageGeneration(userContent)) &&
        !imageDataUrls.length
      ) {
        controller.enqueue(
          encoder.encode(
            encodeSse({
              type: "status",
              message: "creating_image",
              chatId,
            }),
          ),
        );
        const img = await generateImageFromPrompt(userContent);
        if (img.ok) {
          const caption = img.title?.trim()
            ? `Тасвири шумо омода: ${img.title.trim()}.`
            : img.subject?.trim()
            ? `Тасвири шумо омода: ${img.subject.trim()}.`
            : img.kind === "logo"
              ? "Логотипи шумо омода."
              : img.kind === "photo"
                ? "Сурати шумо омода."
                : "Тасвири шумо омода.";
          await chatRepository.addMessage(userId, chatId!, {
            role: "ASSISTANT",
            content: `${caption}\n\n[image:${img.provider}]`,
            modelId: usedModel ?? "image",
          });
          controller.enqueue(
            encoder.encode(
              encodeSse({
                type: "image",
                url: img.url,
                kind: img.kind,
                provider: img.provider,
                chatId,
              }),
            ),
          );
          controller.enqueue(
            encoder.encode(
              encodeSse({ type: "replace", content: caption, chatId }),
            ),
          );
          controller.enqueue(
            encoder.encode(encodeSse({ type: "done", chatId })),
          );
          controller.close();
          return;
        }
        const failMsg = `Тасвир сохта нашуд. ${img.detail} Gallery: /app/gallery`;
        await chatRepository.addMessage(userId, chatId!, {
          role: "ASSISTANT",
          content: failMsg,
          modelId: usedModel,
        });
        controller.enqueue(
          encoder.encode(
            encodeSse({ type: "replace", content: failMsg, chatId }),
          ),
        );
        controller.enqueue(
          encoder.encode(encodeSse({ type: "done", chatId })),
        );
        controller.close();
        return;
      }

      async function runOnce(prompt: string, streamTokens: boolean) {
        let text = "";
        for await (const event of streamChatCompletion({
          prompt,
          history,
          modelId: parsed.data?.modelId,
          userId,
          systemPrompt,
          imageDataUrls: imageDataUrls.length ? imageDataUrls : undefined,
          maxTokens,
        })) {
          if (event.type === "meta") {
            usedModel = event.modelId;
            controller.enqueue(encoder.encode(encodeSse({ ...event, chatId })));
            continue;
          }
          if (event.type === "token") {
            text += event.content;
            if (streamTokens) {
              controller.enqueue(encoder.encode(encodeSse(event)));
            }
            continue;
          }
          if (event.type === "status") {
            // Next model starts from scratch — drop the failed model's partial text.
            if (event.status === "fallback" && text) {
              text = "";
              if (streamTokens) {
                controller.enqueue(encoder.encode(encodeSse({ type: "replace", content: "", chatId })));
              }
            }
            controller.enqueue(encoder.encode(encodeSse({ ...event, chatId })));
            continue;
          }
          if (event.type === "error") {
            return { error: event.message, text };
          }
          if (event.type === "done") {
            return { text };
          }
        }
        return { text };
      }

      // For «ҶАВОБИ ДУРУСТ ДЕҲ» buffer first so we never show empty «ман кӯшиш мекунам».
      let result = await runOnce(promptForModel, !correction);
      if (result.error) {
        await chatRepository.addMessage(userId, chatId!, {
          role: "ASSISTANT",
          content: result.error,
          modelId: usedModel,
        });
        controller.enqueue(
          encoder.encode(
            encodeSse({
              type: "error",
              code: "PROVIDER_ERROR",
              message: result.error,
              chatId,
            }),
          ),
        );
        controller.enqueue(encoder.encode(encodeSse({ type: "done", chatId })));
        controller.close();
        return;
      }

      let finalText = result.text.trim();
      let replaced = false;
      if (!finalText || isEmptyAck(finalText) || isLazyFluff(finalText, userContent)) {
        result = await runOnce(
          `${promptForModel}\n\nCRITICAL REWRITE: Previous draft was lazy or off-topic (e.g. only said your name). Answer like strong ChatGPT: correct meaning of the user's question, direct answer first, then clear explanation + examples. Write it in ${replyLanguageLabel(answerLocale)}. No empty «ask me anything» closer without teaching.`,
          false,
        );
        if (result.text.trim()) {
          finalText = result.text.trim();
          replaced = true;
        }
      }

      if (finalText && isWeakDeliverable(answerPlan, finalText)) {
        result = await runOnce(`${promptForModel}\n\n${deliverableRewriteInstruction(answerPlan)}`, false);
        const retry = result.text.trim();
        if (retry && deliverableScore(retry) > deliverableScore(finalText)) {
          finalText = retry;
          replaced = true;
        }
      }

      // Short spoken answers are the goal in Voice Mode, not a defect.
      if (finalText && !voiceTurn && isTooShortStub(finalText, userContent)) {
        result = await runOnce(
          `${promptForModel}\n\nCRITICAL: Previous reply was too thin. Rewrite like ChatGPT: COMPLETE mini-lesson. First sentence = direct answer. Then 2–4 sentences or bullets with examples. Markdown OK. No fluff about «ask another question».`,
          false,
        );
        if (result.text.trim()) {
          finalText = result.text.trim();
          replaced = true;
        }
      }

      // Last resort — never leave the user without an answer text
      if (!finalText) {
        result = await runOnce(
          `Answer this user question fully and correctly in ${replyLanguageLabel(answerLocale)}. Question:\n${promptForModel}`,
          false,
        );
        finalText =
          result.text.trim() ||
          result.error ||
          "Мутаассифона ҳоло ҷавоб омода нашуд. Лутфан бори дигар кӯшиш кунед.";
        replaced = true;
      }

      const withLinks = ensureLegalMediaLinks(
        finalText,
        userContent,
        replyLocale,
      );
      const linksSuffix =
        withLinks.length > finalText.length
          ? withLinks.slice(finalText.length)
          : "";
      finalText = withLinks;

      if (correction) {
        if (finalText) {
          controller.enqueue(
            encoder.encode(encodeSse({ type: "token", content: finalText })),
          );
        }
      } else if (replaced && finalText) {
        controller.enqueue(
          encoder.encode(
            encodeSse({ type: "replace", content: finalText, chatId }),
          ),
        );
      } else if (linksSuffix) {
        controller.enqueue(
          encoder.encode(encodeSse({ type: "token", content: linksSuffix })),
        );
      }

      assistantText = finalText;

      if (finalText) {
        const saved = await chatRepository.addMessage(userId, chatId!, {
          role: "ASSISTANT",
          content: finalText,
          modelId: usedModel,
        });
        controller.enqueue(
          encoder.encode(
            encodeSse({
              type: "done",
              chatId,
              messageId: saved?.id,
            }),
          ),
        );
      } else {
        const notice = "Ҷавоб холӣ омад. Бори дигар саволро нависед.";
        await chatRepository.addMessage(userId, chatId!, {
          role: "ASSISTANT",
          content: notice,
          modelId: usedModel,
        });
        controller.enqueue(
          encoder.encode(
            encodeSse({
              type: "error",
              code: "EMPTY_REPLY",
              message: notice,
              chatId,
            }),
          ),
        );
        controller.enqueue(encoder.encode(encodeSse({ type: "done", chatId })));
      }
      controller.close();
    },
  });

  const headers = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  appendGuestCookie(headers, userId);

  return new Response(stream, { headers });
}
