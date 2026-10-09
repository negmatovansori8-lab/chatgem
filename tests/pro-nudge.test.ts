import { describe, expect, it } from "vitest";
import { proNudgeDue } from "@/lib/pro-nudge";

describe("proNudgeDue", () => {
  it("waits a full month", () => {
    const start = "2026-09-03T12:00:00.000Z";
    expect(proNudgeDue(start, new Date("2026-10-02T12:00:00.000Z"))).toBe(false);
    expect(proNudgeDue(start, new Date("2026-10-03T12:00:00.000Z"))).toBe(true);
  });

  it("ignores a bad date", () => {
    expect(proNudgeDue("not-a-date")).toBe(false);
  });
});
