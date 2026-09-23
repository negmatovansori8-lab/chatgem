import type { AIProvider, GenerateInput, GenerateResult } from "@/providers/ai/types";

type CompatibleConfig = {
  apiKeyEnv: string;
  baseUrl: string;
  stripPrefix: string;
  errorLabel: string;
};

async function* streamCompatible(
  config: CompatibleConfig,
  input: GenerateInput,
): AsyncIterable<string> {
  const key = process.env[config.apiKeyEnv];
  if (!key) {
    throw new Error(`${config.apiKeyEnv} is not configured`);
  }

  const model = input.modelId.includes("/")
    ? input.modelId.slice(input.modelId.indexOf("/") + 1)
    : input.modelId.replace(config.stripPrefix, "");

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
      frequency_penalty: 0.2,
      presence_penalty: 0.15,
      messages: input.messages,
    }),
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new Error(`${config.errorLabel} error: ${response.status} ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
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
          throw new Error(`${config.errorLabel} error: ${json.error.message}`);
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
    throw new Error(`${config.errorLabel} error: empty completion`);
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
