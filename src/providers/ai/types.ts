export type AICapability =
  | "generate"
  | "stream"
  | "embed"
  | "transcribe"
  | "textToSpeech"
  | "generateImage";

export interface AIModel {
  id: string;
  providerId: string;
  name: string;
  kind: "chat" | "reasoning" | "coding" | "language" | "image" | "speech" | "embedding";
  capabilities: AICapability[];
}

export interface AIProvider {
  id: string;
  name: string;
  configured: boolean;
  models: AIModel[];
  generate?(input: GenerateInput): Promise<GenerateResult>;
  stream?(input: GenerateInput): AsyncIterable<string>;
  embed?(input: string): Promise<number[]>;
  transcribe?(input: Blob): Promise<string>;
  textToSpeech?(input: string): Promise<Blob>;
  generateImage?(input: string): Promise<{ url?: string; notConfigured: boolean }>;
}

export interface GenerateInput {
  modelId: string;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content:
      | string
      | Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
        >;
  }>;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResult {
  content: string;
  modelId: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

/**
 * Provider registry — Phase 1 foundation only.
 * Real providers are wired in later phases when API keys exist.
 */
export class ProviderRegistry {
  private providers = new Map<string, AIProvider>();

  register(provider: AIProvider) {
    this.providers.set(provider.id, provider);
  }

  list() {
    return Array.from(this.providers.values());
  }

  get(id: string) {
    return this.providers.get(id);
  }

  configured() {
    return this.list().filter((p) => p.configured);
  }
}

export const providerRegistry = new ProviderRegistry();
