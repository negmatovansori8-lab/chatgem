import { chatRepository } from "@/repositories/chat-repository";
import { memoryRepository } from "@/repositories/memory-repository";
import { knowledgeRepository } from "@/repositories/knowledge-repository";
import { projectRepository } from "@/repositories/project-repository";
import { subscriptionRepository } from "@/repositories/subscription-repository";
import {
  prefsRepository,
  prefsToSystemBlock,
} from "@/repositories/prefs-repository";
import { appendGuestCookie, getRequestUserId } from "@/server/session";
import { streamChatCompletion } from "@/services/ai/stream";
import { chatMessageSchema } from "@/types/chat";
import { getLocaleInfo } from "@/lib/i18n/locales";
import { pluginSystemPrompt } from "@/features/tools/plugins-catalog";
import { wantsImageGeneration } from "@/lib/image-prompt";
import { generateImageFromPrompt } from "@/lib/generate-image";

function encodeSse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Match user language when clear; else UI locale.
 */
function languageRules(userMessage: string, locale?: string) {
  const code = locale?.trim() || "tg";
  const info = getLocaleInfo(code);
  const ui = code.split("-")[0]?.toLowerCase() ?? "tg";

  const hasTajik =
    /[ғӣқӯҳҷҒӢҚӮҲҶ]/.test(userMessage) ||
    /салом|чӣ|куҷо|чаро|мехоҳ|лутфан|раҳмат|тоҷик/i.test(userMessage);
  const hasRussian =
    /[ёъыэ]/i.test(userMessage) ||
    /\b(что|как|почему|привет|спасибо|это)\b/i.test(userMessage);
  const hasEnglish =
    /\b(what|how|why|please|thanks|hello|the|is|are)\b/i.test(userMessage) &&
    !hasTajik;

  let replyLang = info.native;
  if (hasTajik) replyLang = "тоҷикӣ (Tajik Cyrillic)";
  else if (hasRussian && ui !== "en") replyLang = "русский";
  else if (hasEnglish && !hasTajik && !hasRussian) replyLang = "English";
  else if (ui === "tg") replyLang = "тоҷикӣ (Tajik Cyrillic)";
  else if (ui === "ru") replyLang = "русский";
  else if (ui === "en") replyLang = "English";

  return [
    "LANGUAGE:",
    `- Answer in the user's language when clear. Preferred now: ${replyLang}.`,
    `- App UI language (fallback): ${info.native} (${info.name}).`,
    "- If the user writes Tajik → reply in Tajik. If Russian → Russian. If English → English.",
    "- Do not mix languages in one reply. Do not refuse because of typos.",
  ].join("\n");
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

/** Lazy ChatGPT-style fluff: only names itself / "ask me anything" without teaching. */
function isLazyFluff(reply: string, userPrompt: string) {
  const t = reply.trim();
  const q = userPrompt.trim();
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
  if (wantsShort) return false;
  if (isLazyFluff(reply, userPrompt)) return true;
  const t = reply.trim();
  if (t.length >= 100) return false;
  if (t.split(/\s+/).filter(Boolean).length >= 18) return false;
  // Real short facts OK (dates, numbers, day names) if not fluff
  if (/^\s*[\d\wа-яёғӣқӯҳҷА-ЯЁҒӢҚӮҲҶ\-–.,\s]{2,40}\s*$/i.test(t) && !/chatgem/i.test(t)) {
    return false;
  }
  return t.length < 40;
}

/** ChatGPT-quality assistant persona. */
function coreAssistantRules(isPro: boolean) {
  return [
    "YOU ARE ChatGem — a world-class AI assistant like ChatGPT (helpful, clear, accurate, warm).",
    "Goal: every reply should feel as useful as a strong ChatGPT answer — never lazy or empty.",
    "",
    "LANGUAGE:",
    "- Reply in the user's language (Tajik → тоҷикӣ, Russian → русский, English → English).",
    "- Tajik: simple, fluent Cyrillic. Fix typos from context; do not refuse because of typos or ALL CAPS.",
    "",
    "UNDERSTAND THE QUESTION (critical):",
    "- Think what the user MOST LIKELY wants — do not pick the laziest reading.",
    "- Short ALL-CAPS Tajik like «ИСМ ЧИСТ» is often a REAL question, NOT «what is your name».",
    "  Examples:",
    "  • «ИСМ ЧИСТ» → explain what an ИСМ (noun) is in grammar: definition + 3–5 examples + short tip. Optionally note: if they meant the bot's name, say ChatGem in one line.",
    "  • «РУЗИ ЧИСТ» / date questions → give the correct day/date with a one-line reason.",
    "  • «ЧӢ КУНАМ» → ask what goal they have OR give 2–3 practical options.",
    "- Only answer with your own name if they clearly ask who you are / your name.",
    "- If truly ambiguous, cover the top 2 meanings briefly (A / B), then invite which one they meant.",
    "",
    "ANSWER QUALITY (like ChatGPT):",
    "1) Lead with the direct answer in the first sentence.",
    "2) Then explain clearly so a student understands.",
    "3) Add examples, steps, or a mini list when useful.",
    "4) Use markdown: **bold** key terms, bullets, numbered steps, tables when comparing.",
    "5) Short factual Q → still give a COMPLETE mini-answer (definition + example), not one word and not a sales closer.",
    "6) Complex Q → structured, step-by-step, complete.",
    "7) NEVER end with empty fluff like «Агар саволи дигаре доред…» unless you already delivered a full useful answer.",
    "8) NEVER invent facts. If unsure, say so and give the best known answer + what would confirm it.",
    "",
    "FORBIDDEN lazy replies:",
    "- Only «Номи ман ChatGem аст» when the user asked a subject question.",
    "- Only «Бале / Кӯшиш мекунам / Look».",
    "- One-sentence brush-offs with no teaching value.",
    "",
    "ALWAYS ANSWER:",
    "- Never refuse ordinary questions (school, science, language, math, daily life, coding help).",
    "- Never say you cannot help unless the request is illegal/harmful.",
    "- If unsure, give the best correct answer you can and note uncertainty briefly.",
    "- Typos, ALL CAPS, mixed languages — still answer.",
    "",
    "CODE: clean, working, respect existing project structure; say briefly what changed.",
    "",
    "TONE: friendly, calm, professional — a real helpful tutor/assistant.",
    isPro
      ? "- Pro user: deeper detail, still clear."
      : "- Free user: same correctness and clarity as Pro for the answer itself.",
  ].join("\n");
}

function groundedFacts() {
  return [
    "FACT ANCHOR (when relevant):",
    "- Tajikistan capital: Душанбе. Currency: сомонӣ (TJS). Language: тоҷикӣ.",
    "- You are ChatGem.",
  ].join("\n");
}


function mediaCapabilityRules() {
  return [
    "MEDIA & VISION (mandatory when relevant):",
    "- Guests and signed-in users get full helpful answers — no account required to chat.",
    "- IMAGE GENERATION: The app generates images automatically when the user asks (сурат соз, тасвир соз, нарисуй, create an image, logo, draw…). Do NOT say you cannot create images. Do NOT list Canva/Midjourney as a substitute for a clear generate request — the image pipeline handles it.",
    "- When images are attached: LOOK at them. Identify objects, posters, scenes, text (OCR), people/context.",
    "- Movie/show from screenshot, poster, or scene: give the most likely title(s) with short confidence note.",
    "- Beautify / edit photo requests (when they already attached a photo): describe concrete improvements (crop, light, color, background, retouch) and give step-by-step for free tools (Photos, Snapseed, CapCut). Suggest /app/gallery for a brand-new image from a prompt.",
    "- Video file attached (no frame access): use filename + user text. Ask one short clarifying question only if needed. Still help identify titles and next steps.",
    "- Video/photo LINKS (YouTube, TikTok, Instagram, Telegram, etc.): help identify the film/clip from the URL/title/description the user gives.",
    "- ALWAYS give real clickable https:// links when helpful (YouTube, Google, IMDb, Wikipedia, official store pages). Prefer full URLs on their own line.",
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
    .replace(/\[Attached files:.*?\]/gi, " ")
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
    `Write only the correct answer in the user's language. No «I will try», no «look», no apologies — just the answer.`,
  ].join("\n");
}

function defaultMediaPrompt(
  content: string,
  attachments?: Array<{ name: string; mimeType: string; size: number }>,
) {
  const trimmed = content.trim();
  if (trimmed) {
    if (!attachments?.length) return trimmed;
    const names = attachments.map((a) => `${a.name} (${a.mimeType})`).join(", ");
    return `${trimmed}\n\n[Attached files: ${names}]`;
  }
  if (!attachments?.length) return content;
  const hasImage = attachments.some((a) => a.mimeType.startsWith("image/"));
  const hasVideo = attachments.some((a) => a.mimeType.startsWith("video/"));
  const names = attachments.map((a) => a.name).join(", ");
  if (hasImage && !hasVideo) {
    return `Please analyze the attached image(s): ${names}. Describe what you see. If it looks like a movie/show poster or scene, name it. If the user wants it prettier, suggest concrete edits.`;
  }
  if (hasVideo) {
    return `User attached video file(s): ${names}. Help identify the content/movie if possible from the filename and any context. If they want a download, explain legal options only — no piracy.`;
  }
  return `User attached: ${names}. Help with their request.`;
}

async function buildSystemPrompt(
  userId: string,
  userMessage: string,
  locale?: string,
  pluginId?: string,
  agentInstructions?: string,
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
    languageRules(userMessage, locale),
    mediaCapabilityRules(),
  ];

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
      let hits = await knowledgeRepository.search(userId, base.id, userMessage);
      if (!hits.length) {
        const bundle = await knowledgeRepository.getBase(userId, base.id);
        hits = bundle?.items.slice(0, 2) ?? [];
      }
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
    "Формат: аввал ҷавоби асосӣ, баъд шарҳ/мисол агар лозим. Забони корбар. Дӯстона, равшан, бе маълумоти зиёдатӣ.",
  );

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

  await chatRepository.addMessage(userId, chatId, {
    role: "USER",
    content: userContent,
    modelId: parsed.data.modelId ?? null,
    attachments: storedAttachments.length ? storedAttachments : undefined,
  });

  const historyBundle = await chatRepository.get(userId, chatId);
  const history =
    historyBundle?.messages
      .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
      .slice(0, -1)
      .map((m) => ({
        role: (m.role === "USER" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
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

  const systemPrompt = await buildSystemPrompt(
    userId,
    userContent,
    replyLocale,
    parsed.data.pluginId,
    parsed.data.agentInstructions,
  );
  const encoder = new TextEncoder();
  let assistantText = "";
  let usedModel: string | null = parsed.data.modelId ?? null;
  const promptForModel = resolveUserPrompt(userContent, history);
  const correction = isCorrectionRequest(userContent);

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
          const caption =
            img.kind === "logo"
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
          `${promptForModel}\n\nCRITICAL REWRITE: Previous draft was lazy or off-topic (e.g. only said your name). Answer like strong ChatGPT: correct meaning of the user's question, direct answer first, then clear explanation + examples. Tajik if they wrote Tajik. No empty «ask me anything» closer without teaching.`,
          false,
        );
        if (result.text.trim()) {
          finalText = result.text.trim();
          replaced = true;
        }
      }

      if (finalText && isTooShortStub(finalText, userContent)) {
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
          `Answer this user question fully and correctly in their language. Question:\n${promptForModel}`,
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
