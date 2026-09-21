import {
  bootstrapProviders,
  listSelectableModels,
  resolveProviderForModel,
} from "@/providers/ai/registry";

/** Pick first configured executable chat model (prefers Groq). */
export function pickLiveModel() {
  bootstrapProviders();
  const models = listSelectableModels().filter((m) => m.configured);
  return (
    models.find((m) => m.providerId === "groq") ??
    models.find((m) => m.kind === "chat") ??
    models[0] ??
    null
  );
}

export async function generateText(input: {
  system?: string;
  prompt: string;
  temperature?: number;
}) {
  const model = pickLiveModel();
  if (!model) {
    throw new Error(
      "No AI provider configured. Add GROQ_API_KEY or OPENAI_API_KEY in .env.",
    );
  }
  const provider = resolveProviderForModel(model.id);
  if (!provider?.generate) {
    throw new Error(`Provider ${model.providerId} cannot generate.`);
  }
  const result = await provider.generate({
    modelId: model.id,
    temperature: input.temperature ?? 0.4,
    messages: [
      ...(input.system
        ? [{ role: "system" as const, content: input.system }]
        : []),
      { role: "user", content: input.prompt },
    ],
  });
  return { content: result.content, modelId: model.id };
}
