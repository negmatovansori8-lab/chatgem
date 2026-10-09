import { describe, expect, it } from "vitest";
import { musicSearchAllowed } from "../src/lib/music-access";

describe("music search access", () => {
  it("opens for Pro, Business, and admins", () => {
    expect(musicSearchAllowed({ planId: "pro" })).toBe(true);
    expect(musicSearchAllowed({ planId: "business" })).toBe(true);
    expect(musicSearchAllowed({ role: "ADMIN", planId: "free" })).toBe(true);
    expect(musicSearchAllowed({ role: "SUPER_ADMIN", planId: "free" })).toBe(true);
  });

  it("stays closed on the free plan", () => {
    expect(musicSearchAllowed({ role: "USER", planId: "free" })).toBe(false);
    expect(musicSearchAllowed({ planId: null })).toBe(false);
  });
});
