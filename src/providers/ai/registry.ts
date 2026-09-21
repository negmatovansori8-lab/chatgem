import { providerRegistry } from "@/providers/ai/types";
import { groqProvider, openAIProvider } from "@/providers/ai/openai";
import type { AIProvider } from "@/providers/ai/types";

const placeholderProviders: AIProvider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    configured: Boolean(process.env.ANTHROPIC_API_KEY),
    models: [
      {
        id: "anthropic/claude-sonnet",
        providerId: "anthropic",
        name: "Claude Sonnet",
        kind: "reasoning",
        capabilities: ["generate", "stream"],
      },
    ],
  },
  {
    id: "google",
    name: "Google AI",
    configured: Boolean(process.env.GOOGLE_AI_API_KEY),
    models: [
      {
        id: "google/gemini-flash",
        providerId: "google",
        name: "Gemini Flash",
        kind: "chat",
        capabilities: ["generate", "stream"],
      },
    ],
  },
];

function providerHasKey(providerId: string) {
  if (providerId === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (providerId === "groq") return Boolean(process.env.GROQ_API_KEY);
  if (providerId === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
  if (providerId === "google") return Boolean(process.env.GOOGLE_AI_API_KEY);
  return false;
}

let bootstrapped = false;

export function bootstrapProviders() {
  if (bootstrapped) return providerRegistry;
  // Prefer free Groq first in registry list order for default picks.
  providerRegistry.register(groqProvider);
  providerRegistry.register(openAIProvider);
  for (const provider of placeholderProviders) {
    providerRegistry.register(provider);
  }
  bootstrapped = true;
  return providerRegistry;
}

export function listSelectableModels() {
  bootstrapProviders();
  return providerRegistry.list().flatMap((provider) => {
    const hasKey = providerHasKey(provider.id);
    const executable = Boolean(provider.stream || provider.generate);
    const configured = hasKey && executable;
    provider.configured = configured;

    return provider.models.map((model) => ({
      ...model,
      providerName: provider.name,
      configured,
    }));
  });
}

export function resolveProviderForModel(modelId: string) {
  bootstrapProviders();
  const providerId = modelId.includes("/") ? modelId.split("/")[0] : modelId;
  const provider = providerRegistry.get(providerId);
  if (!provider) return undefined;
  provider.configured =
    providerHasKey(provider.id) && Boolean(provider.stream || provider.generate);
  return provider;
}
