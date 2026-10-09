import { describe, expect, it, vi } from "vitest";
import { detectImageKind, enhanceImagePrompt, isLogoRequest } from "../src/lib/image-prompt";
import { lexiconToEnglish } from "../src/lib/image-subject";
import { runImageGeneration } from "../src/providers/images";
import { fluxFriendlyPrompt } from "../src/providers/images/pollinations";

describe("image subject translation", () => {
  it("spells out the Tajikistan flag instead of sending Tajik words to Flux", () => {
    const subject = lexiconToEnglish("ЛОГАТИПИ ПАРЧАМИ ТОЧИКИСТОН ДАР САТХИ ЧАХОНИ");
    expect(subject).toMatch(/^Tajikistan flag: horizontal red, wide white and green stripes/);
    expect(subject).not.toMatch(/[\u0400-\u04FF]/);
  });

  it("understands typos like «ЛОГАТППИ ТОЧИКИСТОГРО» as a Tajikistan logo", () => {
    const text = "БА МАН ЛОГАТППИ ТОЧИКИСТОГРО СОЗ";
    expect(isLogoRequest(text)).toBe(true);
    expect(detectImageKind(text)).toBe("logo");
    const { subject, kind } = enhanceImagePrompt(text);
    expect(kind).toBe("logo");
    expect(subject).toMatch(/^Tajikistan emblem/);
    expect(subject).not.toMatch(/[\u0400-\u04FF]/);
    expect(lexiconToEnglish("таомҳои тоҷикӣ")).toBe("");
  });

  it("leaves untranslated Cyrillic to the LLM translator", () => {
    expect(lexiconToEnglish("ба ман шери кӯҳӣ дар барф")).toBe("");
  });

  it("translates common Tajik words and drops izofa crumbs", () => {
    expect(lexiconToEnglish("ба ман гурбаи сафед соз")).toBe("cat white");
    expect(lexiconToEnglish("аспи сиёҳ")).toBe("horse black");
    expect(lexiconToEnglish("распечатай")).toBe("");
  });

  it("refuses to send an untranslated prompt to Flux instead of returning a random woman", async () => {
    for (const key of ["OPENAI_API_KEY", "GOOGLE_AI_API_KEY", "GROQ_API_KEY", "POLLINATIONS_API_KEY"]) {
      vi.stubEnv(key, "");
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const result = await runImageGeneration({ prompt: "нарисуй космонавта на крыше небоскрёба" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.detail).toMatch(/translation failed/i);
      expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("pollinations"))).toBe(false);
    } finally {
      fetchSpy.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("keeps logos flat instead of photorealistic", () => {
    const logo = fluxFriendlyPrompt("Tajikistan flag emblem, logo");
    expect(logo).toContain("flat vector logo");
    expect(logo).toContain("no letters");
    expect(logo).not.toContain("photorealistic");
    expect(fluxFriendlyPrompt(logo)).toBe(logo);
    expect(fluxFriendlyPrompt("red apple on a table")).toContain("photorealistic");
  });
});
