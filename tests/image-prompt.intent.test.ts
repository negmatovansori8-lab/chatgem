import { describe, expect, it } from "vitest";
import {
  enhanceImagePrompt,
  isLogoRequest,
  wantsImageGeneration,
} from "@/lib/image-prompt";

describe("wantsImageGeneration", () => {
  it("does not generate when user asks for a text prompt", () => {
    expect(
      wantsImageGeneration(
        "БА МАН ЯК ПРОМТ ДЕХ БАРОИ КУРСОР ТО КИ БАРНОМАИ МАРО АКСХОЯШРО СОЗ КУНАД",
      ),
    ).toBe(false);
    expect(wantsImageGeneration("ба ман як промт диҳ барои midjourney")).toBe(
      false,
    );
    expect(
      wantsImageGeneration("Write me a prompt for Cursor to generate logos"),
    ).toBe(false);
    expect(wantsImageGeneration("чӣ тавр акс сохтан")).toBe(false);
  });

  it("generates when user asks to create an image now", () => {
    expect(wantsImageGeneration("сурат соз мошин")).toBe(true);
    expect(wantsImageGeneration("ба ман мошини ламборгини соз")).toBe(true);
    expect(wantsImageGeneration("логотип соз ChatGem")).toBe(true);
    expect(wantsImageGeneration("ЛОГАТИП СОЗ")).toBe(true);
    expect(wantsImageGeneration("СОЗ")).toBe(true);
    expect(wantsImageGeneration("нарисуй кота")).toBe(true);
    expect(wantsImageGeneration("create an image of a sunset")).toBe(true);
    expect(wantsImageGeneration("Ман мехоҳам сурат")).toBe(true);
  });

  it("answers questions instead of generating", () => {
    expect(wantsImageGeneration("Чи саволе дар бораи мошин")).toBe(false);
    expect(wantsImageGeneration("Ман мехоҳам бидонам логотип чист")).toBe(false);
    expect(wantsImageGeneration("Логотипи Тоҷикистон чӣ маъно дорад?")).toBe(false);
    expect(wantsImageGeneration("чаро осмон кабуд аст")).toBe(false);
  });
});

describe("logo quality", () => {
  it("maps bare logo/соз to ChatGem world-class logo prompt", () => {
    expect(isLogoRequest("ЛОГАТИП СОЗ")).toBe(true);
    expect(isLogoRequest("СОЗ")).toBe(true);
    const a = enhanceImagePrompt("ЛОГАТИП СОЗ");
    expect(a.kind).toBe("logo");
    expect(a.subject).toBe("ChatGem");
    expect(a.prompt.toLowerCase()).toContain("chatgem");
    expect(a.prompt.toLowerCase()).not.toContain("c03");
    const b = enhanceImagePrompt("СОЗ");
    expect(b.kind).toBe("logo");
    expect(b.subject).toBe("ChatGem");
  });
});
