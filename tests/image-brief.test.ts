import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeImageRequest, buildImageBrief, detectBriefKind } from "../src/lib/image-brief";
import { wantsImageGeneration } from "../src/lib/image-prompt";
import { runImageGeneration } from "../src/providers/images";

const PERSON = /\b(?:woman|girl|lady|female|portrait|person)\b/i;

function withoutAvoid(prompt: string) {
  return prompt.replace(/Avoid:[^]*$/i, "");
}

describe("image request analysis", () => {
  it("understands the four example requests", () => {
    expect(analyzeImageRequest("Логотипи Тоҷикистонро соз")).toMatchObject({ kind: "logo", tajikistan: true, wantsPeople: false, render: "tajikistan-logo" });
    expect(analyzeImageRequest("Харитаи Тоҷикистонро соз")).toMatchObject({ kind: "map", tajikistan: true, render: "tajikistan-map", lang: "tg" });
    expect(analyzeImageRequest("Парчами Тоҷикистонро соз")).toMatchObject({ kind: "flag", tajikistan: true, render: "tajikistan-flag" });
    expect(analyzeImageRequest("Логотипи зан соз")).toMatchObject({ kind: "logo", tajikistan: false, wantsPeople: true });
  });

  it("treats Tajikistan, TJ and Tajik as the country, never a person", () => {
    for (const text of ["ЛОГОТИП TAJIKISTAN", "логотип TJ соз", "Логотип Таджикистана", "тоҷикистон соз", "make a Tajikistan logo"]) {
      const a = analyzeImageRequest(text);
      expect(a.tajikistan, text).toBe(true);
      expect(a.wantsPeople, text).toBe(false);
    }
    expect(analyzeImageRequest("духтари тоҷик дар либоси миллӣ").wantsPeople).toBe(true);
  });

  it("detects the format before the subject", () => {
    expect(detectBriefKind("иконкаи Тоҷикистон барои барнома")).toBe("icon");
    expect(detectBriefKind("app icon for a weather app")).toBe("icon");
    expect(detectBriefKind("плакати Наврӯз")).toBe("poster");
    expect(detectBriefKind("логотипи Тоҷикистон бо харита")).toBe("logo");
    expect(detectBriefKind("карта Таджикистана")).toBe("map");
    expect(detectBriefKind("акси кӯҳҳои Помир")).toBe("photo");
  });

  it("picks Tajikistan motifs from the request instead of cramming all of them", () => {
    const withMap = analyzeImageRequest("логотипи Тоҷикистон бо харита ва рангҳои парчам");
    expect(withMap.motifs).toEqual([
      "the recognizable outline of the map of Tajikistan",
      "the national flag colours red, white and green",
    ]);
    expect(analyzeImageRequest("логотипи Тоҷикистон соз").motifs.length).toBeGreaterThan(0);
  });

  it("only renders exactly when nothing creative was asked", () => {
    expect(analyzeImageRequest("Харитаи Тоҷикистон ба забони англисӣ").render).toBe("tajikistan-map");
    expect(analyzeImageRequest("Харитаи Тоҷикистон ба забони англисӣ").labelLang).toBe("en");
    expect(analyzeImageRequest("карта Таджикистана").render).toBe("tajikistan-map");
    expect(analyzeImageRequest("3D харитаи Тоҷикистон дар шакли акварел").render).toBeNull();
    expect(analyzeImageRequest("парчами Тоҷикистон дар шамол дар болои кӯҳ").render).toBeNull();
  });

  it("draws the map-and-flag national logo for a plain Tajikistan logo request", () => {
    for (const text of [
      "як логатипи точикистон дар сатхи чахони соз",
      "Логотипи Тоҷикистон дар сатҳи ҷаҳонӣ соз",
      "логотипи замонавии Тоҷикистонро соз",
      "Сделай логотип Таджикистана",
      "make a world-class Tajikistan logo",
    ]) {
      expect(analyzeImageRequest(text).render, text).toBe("tajikistan-logo");
    }
    expect(analyzeImageRequest("make a world-class Tajikistan logo").lang).toBe("en");
    for (const text of ["логотипи ширкати сайёҳии Тоҷикистон соз", "логотипи тоҷик бо кӯҳҳои Помир", "Логотипи зан соз", "логотипи Тоҷикистон бо духтар"]) {
      expect(analyzeImageRequest(text).render, text).toBeNull();
    }
  });

  it("draws the flag-coloured map logo for descriptive prompts in any language", () => {
    const prompts = [
      'Логотипи харитаи Тоҷикистон бо рангҳои парчам, тоҷи тиллоӣ дар марказ ва матни сурхи "Tajikistan" дар зери он. Заминаи сафед.',
      "Create a clean, professional vector-style map of Tajikistan. Fill the Tajikistan map with the three official flag colors: TOP: red MIDDLE: white BOTTOM: green. Place the national emblem in the center of the white stripe. No unnecessary objects, buildings, mountains, people or scenery.",
      "Создай готовое изображение карты Таджикистана в цветах государственного флага: верх — красный, центр — белый, низ — зелёный, герб в центре. Без соседних стран, без людей. Если добавляешь название, напиши только: Tajikistan",
      "Харитаи Тоҷикистонро бо рангҳои парчам: боло сурх, миёна сафед, поён сабз ва Нишони давлатӣ дар маркази қисми сафед.",
    ];
    for (const text of prompts) {
      expect(wantsImageGeneration(text), text).toBe(true);
      const a = analyzeImageRequest(text);
      expect(a, text).toMatchObject({ kind: "logo", wantsPeople: false, render: "tajikistan-logo" });
    }
    expect(analyzeImageRequest(prompts[0]!).wordmark).toBe("Tajikistan");
    expect(analyzeImageRequest(prompts[2]!).wordmark).toBe("Tajikistan");
    expect(analyzeImageRequest(prompts[3]!).wordmark).toBeUndefined();
    expect(analyzeImageRequest("логотипи харитаи Тоҷикистон бо рангҳои парчам, бе матн").wordmark).toBeNull();
    expect(analyzeImageRequest("харитаи Тоҷикистон бо вилоятҳо").render).not.toBe("tajikistan-logo");
    expect(analyzeImageRequest("харитаи Тоҷикистон бо парчам ва духтари тоҷик").render).toBeNull();
    expect(wantsImageGeneration("логотипи ман дар сайт намоён нест")).toBe(false);
    expect(wantsImageGeneration("Логотипи Тоҷикистон чӣ маъно дорад?")).toBe(false);
  });

  it("routes map, flag, icon and poster requests to image generation, not code", () => {
    for (const text of ["Харитаи Тоҷикистонро соз", "Парчами Тоҷикистонро соз", "иконкаи барнома соз", "плакати консерт соз", "make an app icon"]) {
      expect(wantsImageGeneration(text), text).toBe(true);
    }
    expect(wantsImageGeneration("роҳи Душанбе то Хуҷандро дар харита нишон деҳ")).toBe(false);
  });
});

describe("offline brief (no AI key)", () => {
  beforeEach(() => {
    for (const key of ["OPENAI_API_KEY", "GOOGLE_AI_API_KEY", "GROQ_API_KEY"]) vi.stubEnv(key, "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("writes a professional Tajikistan logo prompt with no woman in it", async () => {
    const brief = await buildImageBrief("Логотипи Тоҷикистонро соз");
    expect(brief.prompt).toMatch(/^Professional logo representing the Republic of Tajikistan \(Tajikistan country\)/);
    expect(withoutAvoid(brief.prompt)).not.toMatch(PERSON);
    expect(brief.avoid).toEqual(expect.arrayContaining(["people", "woman", "human face"]));
    expect(brief.fluxPrompt).toMatch(/Tajikistan/);
    expect(brief.fluxPrompt).not.toMatch(PERSON);
    expect(brief.aspect).toBe("1:1");
    expect(brief.title).toBe("Логотипи Тоҷикистон");
  });

  it("gives Flux a colour direction for an ordinary logo so it is not drawn in grey", async () => {
    const brief = await buildImageBrief("ба ман логатипи мошин", { kindHint: "logo" });
    expect(brief.kind).toBe("logo");
    expect(brief.fluxPrompt).toMatch(/\bcar\b/i);
    expect(brief.fluxPrompt).toMatch(/vibrant colors/);
  });

  it("keeps a woman when the user asked for one", async () => {
    const brief = await buildImageBrief("Логотипи зан соз");
    expect(brief.kind).toBe("logo");
    expect(brief.subject).toMatch(/woman/i);
    expect(brief.avoid).not.toContain("woman");
  });
});

describe("exact renders through the image pipeline", () => {
  it("returns the official flag and the real map without calling any image API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const flag = await runImageGeneration({ prompt: "Парчами Тоҷикистонро соз" });
      expect(flag.ok && flag.provider).toBe("chatgem-official-flag");
      const map = await runImageGeneration({ prompt: "Харитаи Тоҷикистонро соз", kind: "photo" });
      expect(map.ok && map.provider).toBe("chatgem-cartography");
      if (map.ok) expect(map.title).toBe("Харитаи Тоҷикистон");
      const logo = await runImageGeneration({ prompt: "як логатипи точикистон дар сатхи чахони соз", kind: "logo" });
      expect(logo.ok && logo.provider).toBe("chatgem-national-logo");
      if (logo.ok) expect([logo.aspect, logo.title]).toEqual(["1:1", "Логотипи Тоҷикистон"]);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  }, 30_000);
});
