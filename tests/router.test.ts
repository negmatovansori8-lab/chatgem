import { describe, expect, it } from "vitest";
import { detectIntent } from "../src/services/ai/router";

describe("smart model router", () => {
  it("routes coding prompts to coding models", () => {
    const decision = detectIntent("Please refactor this TypeScript bug");
    expect(decision.intent).toBe("coding");
    expect(decision.preferredKind).toBe("coding");
  });

  it("routes simple prompts to chat", () => {
    const decision = detectIntent("Hello");
    expect(decision.intent).toBe("simple");
    expect(decision.preferredKind).toBe("chat");
  });

  it("routes translation prompts to language models", () => {
    const decision = detectIntent("Please translate this to Tajik");
    expect(decision.intent).toBe("translation");
  });
});
