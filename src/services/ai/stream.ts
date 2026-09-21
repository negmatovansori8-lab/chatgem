import { detectIntent } from "@/services/ai/router";
import {
  FREE_LIMITS,
  isUsageLimited,
  usageRepository,
} from "@/repositories/usage-repository";
import {
  bootstrapProviders,
  listSelectableModels,
  resolveProviderForModel,
} from "@/providers/ai/registry";
import { subscriptionRepository } from "@/repositories/subscription-repository";
import type { GenerateInput } from "@/providers/ai/types";

export type StreamEvent =
  | { type: "status"; status: string; message: string }
  | { type: "meta"; chatId: string; modelId: string; intent: string }
  | { type: "token"; content: string }
  | { type: "done"; chatId: string; messageId?: string }
  | { type: "error"; code: string; message: string };

type VisionPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** Best → free fallbacks. Always answer if any key works. */
const QUALITY_ORDER = [
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "groq/openai/gpt-oss-120b",
  "groq/openai/gpt-oss-20b",
  "groq/qwen/qwen3.8-27b",
] as const;

const VISION_ORDER = ["openai/gpt-4o", "openai/gpt-4o-mini"] as const;

function configuredModels() {
  return listSelectableModels().filter((m) => m.configured);
}

function buildModelQueue(
  preferredKind: string,
  requested: string | undefined,
  needsVision: boolean,
): string[] {
  const models = configuredModels();
  const ids = new Set(models.map((m) => m.id));
  const queue: string[] = [];

  const push = (id: string) => {
    if (ids.has(id) && !queue.includes(id)) queue.push(id);
  };

  if (needsVision) {
    if (requested) push(requested);
    for (const id of VISION_ORDER) push(id);
    return queue;
  }

  if (requested) push(requested);
  for (const id of QUALITY_ORDER) push(id);

  // Any other configured model (future providers)
  for (const m of models) {
    if (m.kind === preferredKind) push(m.id);
  }
  for (const m of models) push(m.id);

  return queue;
}

function friendlyProviderError(raw: string) {
  const s = raw.toLowerCase();
  if (/insufficient_quota|credit_balance|billing|exceeded.*quota/.test(s)) {
    return "Пули OpenAI тамом шуд. Ҷавоб аз модели ройгони Groq кӯшиш мешавад… / OpenAI quota empty — trying free Groq…";
  }
  if (/incorrect api key|invalid_api_key|401|unauthorized/.test(s)) {
    return "API key нодуруст аст. .env-ро санҷед (OPENAI_API_KEY / GROQ_API_KEY).";
  }
  if (/429|rate.?limit|too many requests/.test(s)) {
    return "Лимити дархост пур шуд — модели дигар кӯшиш мешавад…";
  }
  if (/timeout|network|fetch failed|econnreset|enotfound/.test(s)) {
    return "Пайвастшавӣ қатъ шуд — модели дигар кӯшиш мешавад…";
  }
  if (/model.*(not found|does not exist|decommissioned)/i.test(raw)) {
    return "Модел дастрас нест — модели дигар кӯшиш мешавад…";
  }
  return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;
}

function buildUserContent(
  prompt: string,
  imageDataUrls?: string[],
): string | VisionPart[] {
  const images = (imageDataUrls ?? []).filter((u) =>
    /^data:image\/[a-z0-9.+-]+;base64,/i.test(u),
  );
  if (!images.length) return prompt;

  const parts: VisionPart[] = [{ type: "text", text: prompt }];
  for (const url of images.slice(0, 4)) {
    parts.push({ type: "image_url", image_url: { url } });
  }
  return parts;
}

/**
 * Streams a real provider response.
 * Tries every configured model until one returns a non-empty answer.
 */
export async function* streamChatCompletion(input: {
  prompt: string;
  history?: GenerateInput["messages"];
  modelId?: string;
  userId: string;
  systemPrompt?: string;
  imageDataUrls?: string[];
}): AsyncGenerator<StreamEvent> {
  bootstrapProviders();
  const intent = detectIntent(input.prompt);
  const needsVision = Boolean(input.imageDataUrls?.length);

  if (isUsageLimited(FREE_LIMITS.messages)) {
    const usage = await usageRepository.get(input.userId, "messages");
    if (usage.amount >= FREE_LIMITS.messages!) {
      yield {
        type: "error",
        code: "USAGE_EXCEEDED",
        message: `Лимити паёмҳо (${FREE_LIMITS.messages}/моҳ) пур шуд.`,
      };
      return;
    }
  }

  const queue = buildModelQueue(
    intent.preferredKind,
    input.modelId,
    needsVision,
  );

  if (!queue.length) {
    yield {
      type: "error",
      code: "PROVIDER_NOT_CONFIGURED",
      message: needsVision
        ? "Барои расм OPENAI_API_KEY лозим аст (gpt-4o)."
        : "API key нест. GROQ_API_KEY (ройгон) ё OPENAI_API_KEY-ро дар .env гузоред ва серверро restart кунед.",
    };
    return;
  }

  const userContent = buildUserContent(input.prompt, input.imageDataUrls);
  const messages: GenerateInput["messages"] = [
    ...(input.systemPrompt
      ? [{ role: "system" as const, content: input.systemPrompt }]
      : []),
    ...(input.history ?? []),
    { role: "user", content: userContent },
  ];

  const isPro = await subscriptionRepository.isProOrBetter(input.userId);
  const temperature = 0.25;
  const maxTokens = isPro ? 4096 : 3000;

  let lastError = "";

  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i]!;
    const provider = resolveProviderForModel(id);
    if (!provider?.configured || !provider.stream) {
      lastError = `Provider for ${id} is not configured.`;
      continue;
    }

    if (i > 0) {
      yield {
        type: "status",
        status: "fallback",
        message: `Модели дигар: ${id.split("/").slice(-1)[0]}…`,
      };
    }

    yield {
      type: "meta",
      chatId: "",
      modelId: id,
      intent: needsVision ? "vision" : intent.intent,
    };

    try {
      let text = "";
      for await (const token of provider.stream({
        modelId: id,
        messages,
        temperature,
        maxTokens,
      })) {
        text += token;
        yield { type: "token", content: token };
      }

      if (text.trim()) {
        await usageRepository.increment(input.userId, "messages", 1);
        yield { type: "done", chatId: "" };
        return;
      }

      // Empty body — try next model
      lastError = `${id} returned an empty reply.`;
      continue;
    } catch (error) {
      const raw =
        error instanceof Error ? error.message : "Provider request failed";
      lastError = raw;
      const friendly = friendlyProviderError(raw);

      // If we already streamed a usable partial answer, keep it
      // (checked via lastError only — tokens already sent to client)
      if (i < queue.length - 1) {
        yield {
          type: "status",
          status: "fallback",
          message: friendly,
        };
        continue;
      }
    }
  }

  yield {
    type: "error",
    code: "PROVIDER_ERROR",
    message:
      friendlyProviderError(lastError) ||
      "Ҳоло ҷавоб дода нашуд. Як сония интизор шавед ва бори дигар кӯшиш кунед.",
  };
}
