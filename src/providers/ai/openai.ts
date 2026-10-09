import { isAccountError, markProviderDown } from "@/lib/provider-health";
import type { AIProvider, GenerateInput, GenerateResult } from "@/providers/ai/types";

type CompatibleConfig = {
  apiKeyEnv: string;
  baseUrl: string;
  stripPrefix: string;
  errorLabel: string;
  /** Upstream model name when it differs from the app's model id. */
  upstreamModel?: () => string;
  /** Gemini's compatibility layer rejects OpenAI's repetition penalties. */
  penalties?: boolean;
};

/** A stalled provider must fail over to the next model instead of hanging the chat. */
const FIRST_BYTE_TIMEOUT_MS = 35_000;
const IDLE_TIMEOUT_MS = 30_000;

async function* streamCompatible(
  config: CompatibleConfig,
  input: GenerateInput,
): AsyncIterable<string> {
  const key = process.env[config.apiKeyEnv];
  if (!key) {
    throw new Error(`${config.apiKeyEnv} is not configured`);
  }

  const model =
    config.upstreamModel?.() ??
    (input.modelId.includes("/")
      ? input.modelId.slice(input.modelId.indexOf("/") + 1)
      : input.modelId.replace(config.stripPrefix, ""));

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(
      () => controller.abort(new Error(`${config.errorLabel} error: timeout after ${Math.round(ms / 1000)}s`)),
      ms,
    );
  };
  arm(FIRST_BYTE_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: input.temperature ?? 0.45,
        max_tokens: input.maxTokens ?? 4096,
        ...(config.penalties === false ? {} : { frequency_penalty: 0.2, presence_penalty: 0.15 }),
        messages: input.messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      if (isAccountError(response.status, text)) {
        markProviderDown(config.stripPrefix.replace(/\/$/, ""), `${response.status} ${text}`);
      }
      throw new Error(`${config.errorLabel} error: ${response.status} ${text}`);
    }

    yield* readCompletion(response.body, config.errorLabel, () => arm(IDLE_TIMEOUT_MS));
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

async function* readCompletion(
  body: ReadableStream<Uint8Array>,
  errorLabel: string,
  beforeRead: () => void,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    beforeRead();
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data) as {
          error?: { message?: string };
          choices?: Array<{
            delta?: { content?: string };
            finish_reason?: string | null;
          }>;
        };
        if (json.error?.message) {
          throw new Error(`${errorLabel} error: ${json.error.message}`);
        }
        const token = json.choices?.[0]?.delta?.content;
        if (!token) continue;
        full += token;
        // Hard-stop token loops like «Донишгоҳи Донишгоҳи…»
        const tail = full.slice(-120);
        const loop = /(\S{3,40})(?:\s+\1){4,}/.test(tail);
        if (loop) return;
        yield token;
      } catch (err) {
        if (err instanceof Error && err.message.includes("error:")) throw err;
        // ignore malformed chunks
      }
    }
  }

  if (!full.trim()) {
    throw new Error(`${errorLabel} error: empty completion`);
  }
}

async function generateCompatible(
  config: CompatibleConfig,
  input: GenerateInput,
): Promise<GenerateResult> {
  let content = "";
  for await (const chunk of streamCompatible(config, input)) {
    content += chunk;
  }
  return { content, modelId: input.modelId };
}

const openaiConfig: CompatibleConfig = {
  apiKeyEnv: "OPENAI_API_KEY",
  baseUrl: "https://api.openai.com/v1",
  stripPrefix: "openai/",
  errorLabel: "OpenAI",
};

const groqConfig: CompatibleConfig = {
  apiKeyEnv: "GROQ_API_KEY",
  baseUrl: "https://api.groq.com/openai/v1",
  stripPrefix: "groq/",
  errorLabel: "Groq",
};

export const openAIProvider: AIProvider = {
  id: "openai",
  name: "OpenAI",
  configured: Boolean(process.env.OPENAI_API_KEY),
  models: [
    {
      id: "openai/gpt-4o-mini",
      providerId: "openai",
      name: "GPT-4o mini",
      kind: "chat",
      capabilities: ["generate", "stream"],
    },
    {
      id: "openai/gpt-4o",
      providerId: "openai",
      name: "GPT-4o",
      kind: "reasoning",
      capabilities: ["generate", "stream"],
    },
  ],
  generate: (input) => generateCompatible(openaiConfig, input),
  stream: (input) => streamCompatible(openaiConfig, input),
};

const googleConfig: CompatibleConfig = {
  apiKeyEnv: "GOOGLE_AI_API_KEY",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  stripPrefix: "google/",
  errorLabel: "Gemini",
  upstreamModel: () => process.env.GOOGLE_AI_MODEL?.trim() || "gemini-flash-latest",
  penalties: false,
};

/** Free tier in Google AI Studio — https://aistudio.google.com/apikey. Strong in Tajik. */
export const googleProvider: AIProvider = {
  id: "google",
  name: "Google Gemini",
  configured: Boolean(process.env.GOOGLE_AI_API_KEY),
  models: [
    {
      id: "google/gemini-flash",
      providerId: "google",
      name: "Gemini Flash",
      kind: "reasoning",
      capabilities: ["generate", "stream"],
    },
  ],
  generate: (input) => generateCompatible(googleConfig, input),
  stream: (input) => streamCompatible(googleConfig, input),
};

/** Free-tier friendly — https://console.groq.com/keys */
export const groqProvider: AIProvider = {
  id: "groq",
  name: "Groq (free)",
  configured: Boolean(process.env.GROQ_API_KEY),
  models: [
    {
      id: "groq/openai/gpt-oss-120b",
      providerId: "groq",
      name: "GPT OSS 120B",
      kind: "reasoning",
      capabilities: ["generate", "stream"],
    },
    {
      id: "groq/openai/gpt-oss-20b",
      providerId: "groq",
      name: "GPT OSS 20B",
      kind: "chat",
      capabilities: ["generate", "stream"],
    },
    {
      id: "groq/qwen/qwen3.8-27b",
      providerId: "groq",
      name: "Qwen3.8 27B",
      kind: "chat",
      capabilities: ["generate", "stream"],
    },
  ],
  generate: (input) => generateCompatible(groqConfig, input),
  stream: (input) => streamCompatible(groqConfig, input),
};
