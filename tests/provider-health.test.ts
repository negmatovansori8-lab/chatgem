import { afterEach, describe, expect, it, vi } from "vitest";
import { isAccountError, isProviderDown, markProviderDown, providerOfModel } from "../src/lib/provider-health";
import { getVoiceStack, voiceStatus } from "../src/services/voice";

describe("provider health", () => {
  it("recognises errors that retrying cannot fix", () => {
    expect(isAccountError(429, '{"error":{"code":"insufficient_quota"}}')).toBe(true);
    expect(isAccountError(400, '{"error":{"code":"credit_balance_exhausted"}}')).toBe(true);
    expect(isAccountError(401, "")).toBe(true);
    expect(isAccountError(429, '{"error":{"message":"Rate limit reached"}}')).toBe(false);
    expect(isAccountError(500, "upstream error")).toBe(false);
  });

  it("pauses a provider after an account error", () => {
    expect(isProviderDown("test-provider")).toBe(false);
    markProviderDown("test-provider", "no credit");
    expect(isProviderDown("test-provider")).toBe(true);
    expect(providerOfModel("groq/openai/gpt-oss-120b")).toBe("groq");
  });
});

describe("voice with an OpenAI key that has no credit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("falls back to Groq speech-to-text and device voices instead of failing every sentence", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"error":{"code":"insufficient_quota"}}', { status: 429 }),
    );

    const tts = getVoiceStack().tts;
    expect(tts?.id).toBe("openai");
    await expect(tts!.synthesize({ text: "Салом", language: "tg" })).rejects.toMatchObject({ code: "not_configured" });

    expect(getVoiceStack().tts).toBeNull();
    expect(voiceStatus()).toMatchObject({ stt: { available: true, provider: "groq" }, tts: { available: false, provider: "browser" } });
  });
});
