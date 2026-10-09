import { describe, expect, it } from "vitest";
import { detectSpokenLanguage, isNoiseTranscript, normalizeLanguage, voiceLanguage } from "@/lib/voice/languages";

describe("detectSpokenLanguage", () => {
  it("recognizes Tajik even when the provider says Russian", () => {
    expect(detectSpokenLanguage("Салом, шумо чӣ хел ҳастед?", { provider: "russian" })).toBe("tg");
    expect(detectSpokenLanguage("Ман имрӯз ба кор меравам", { provider: "ru" })).toBe("tg");
  });

  it("recognizes Russian", () => {
    expect(detectSpokenLanguage("Привет, как дела? Что ты сегодня делаешь?")).toBe("ru");
  });

  it("recognizes English", () => {
    expect(detectSpokenLanguage("Hello, how are you doing today?")).toBe("en");
  });

  it("picks the dominant language of a mixed sentence", () => {
    expect(detectSpokenLanguage("Салом, ман мехоҳам дар бораи machine learning бидонам")).toBe("tg");
    expect(detectSpokenLanguage("Can you explain what это значит in simple words please")).toBe("en");
  });

  it("uses scripts for other languages", () => {
    expect(detectSpokenLanguage("こんにちは、元気ですか")).toBe("ja");
    expect(detectSpokenLanguage("안녕하세요 잘 지내세요")).toBe("ko");
    expect(detectSpokenLanguage("مرحبا كيف حالك")).toBe("ar");
    expect(detectSpokenLanguage("سلام، چطور هستی؟")).toBe("fa");
  });

  it("trusts the provider for other Latin-script languages", () => {
    expect(detectSpokenLanguage("Bonjour, comment ça va aujourd'hui", { provider: "french" })).toBe("fr");
    expect(detectSpokenLanguage("Hola, ¿cómo estás?", { provider: "es" })).toBe("es");
  });

  it("falls back when there is no text", () => {
    expect(detectSpokenLanguage("", { fallback: "tg" })).toBe("tg");
    expect(detectSpokenLanguage("", { provider: "ru", fallback: "tg" })).toBe("ru");
  });
});

describe("normalizeLanguage / voiceLanguage", () => {
  it("maps provider names and locale tags to ISO codes", () => {
    expect(normalizeLanguage("russian")).toBe("ru");
    expect(normalizeLanguage("ru-RU")).toBe("ru");
    expect(normalizeLanguage("Tajik")).toBe("tg");
    expect(voiceLanguage("tg-TJ")?.browserFallback).toBe("ru-RU");
  });
});

describe("isNoiseTranscript", () => {
  const prompt = "Салом, чӣ хел? Привет, как дела? Hello, how are you?";

  it("drops silence, filler and known STT hallucinations", () => {
    expect(isNoiseTranscript("")).toBe(true);
    expect(isNoiseTranscript("...")).toBe(true);
    expect(isNoiseTranscript("hmm")).toBe(true);
    expect(isNoiseTranscript("Продолжение следует...")).toBe(true);
    expect(isNoiseTranscript("Thank you for watching!")).toBe(true);
  });

  it("drops a full echo of the prompt", () => {
    expect(isNoiseTranscript(prompt, prompt)).toBe(true);
  });

  it("keeps short real greetings that also appear in the prompt", () => {
    expect(isNoiseTranscript("Салом", prompt)).toBe(false);
    expect(isNoiseTranscript("Hello, how are you?", prompt)).toBe(false);
    expect(isNoiseTranscript("Привет", prompt)).toBe(false);
  });

  it("keeps normal questions", () => {
    expect(isNoiseTranscript("Обу ҳаво дар Душанбе чӣ хел аст?", prompt)).toBe(false);
  });
});
