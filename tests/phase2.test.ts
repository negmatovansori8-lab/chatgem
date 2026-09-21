import { describe, expect, it } from "vitest";
import { FREE_LIMITS, isUsageLimited } from "../src/repositories/usage-repository";
import { detectIntent } from "../src/services/ai/router";

describe("phase 2 foundations", () => {
  it("allows unlimited messages by default", () => {
    expect(isUsageLimited(FREE_LIMITS.messages)).toBe(false);
    expect(FREE_LIMITS.messages).toBeNull();
  });

  it("routes regenerate-style coding prompts", () => {
    expect(detectIntent("debug this python function").preferredKind).toBe("coding");
  });
});
