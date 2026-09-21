import { describe, expect, it } from "vitest";
import { orchestrateUserRequest } from "../src/services/ai/orchestrator";

describe("ai orchestrator", () => {
  it("does not fake completions when providers are missing", async () => {
    const result = await orchestrateUserRequest({ prompt: "Explain gravity" });
    expect(result.status).toBe("providers_not_configured");
    expect(result.message.toLowerCase()).toContain("not configured");
  });
});
