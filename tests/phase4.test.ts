import { describe, expect, it } from "vitest";
import { runCalculator } from "../src/tools/registry";

describe("phase 4 tools", () => {
  it("evaluates safe calculator expressions", () => {
    const result = runCalculator("2+2*3");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.result).toBe(8);
  });

  it("rejects unsafe calculator input", () => {
    const result = runCalculator("process.exit(1)");
    expect(result.ok).toBe(false);
  });
});
