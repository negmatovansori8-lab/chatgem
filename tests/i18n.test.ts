import { describe, expect, it } from "vitest";
import { WORLD_LOCALES, t, getDictionary } from "../src/lib/i18n";

describe("world languages", () => {
  it("supports more than 200 locales", () => {
    expect(WORLD_LOCALES.length).toBeGreaterThan(200);
  });

  it("falls back to English for untranslated locales", () => {
    expect(t("nav.start", "zu")).toBe("Start Free");
    expect(getDictionary("zu")["nav.signin"]).toBe("Sign In");
  });

  it("translates Tajik core keys", () => {
    expect(t("nav.signin", "tg")).toBe("Воридшавӣ");
  });
});
