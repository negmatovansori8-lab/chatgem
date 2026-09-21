import { describe, expect, it } from "vitest";
import { PLANS } from "../src/types/business";

describe("phase 5 business", () => {
  it("defines free pro and business plans", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["free", "pro", "business"]);
  });

  it("keeps free plan at zero price", () => {
    expect(PLANS.find((p) => p.id === "free")?.priceMonthly).toBe(0);
  });
});
