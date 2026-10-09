import { describe, expect, it } from "vitest";
import {
  explicitReplyLocale,
  replyLanguageLabel,
  replyLocaleFor,
} from "../src/lib/i18n/reply-language";

describe("reply language follows the selected app language", () => {
  it("keeps Tajik typed without special letters in Tajik", () => {
    expect(replyLocaleFor("ЧАРО ВАКТЕ КИ САВОЛ МЕДИХАМ", "tg")).toBe("tg");
    expect(replyLocaleFor("пойтахти точикистон кадом шахр аст", "tg")).toBe("tg");
  });

  it("does not switch on the language of the question", () => {
    expect(replyLocaleFor("Что такое фотосинтез?", "tg")).toBe("tg");
    expect(replyLocaleFor("What is photosynthesis?", "ru")).toBe("ru");
    expect(replyLocaleFor("Фотосинтез чист?", "en")).toBe("en");
  });

  it("uses the base code of regional locales", () => {
    expect(replyLocaleFor("salom", "en-US")).toBe("en");
  });

  it("honours an explicit request in the message", () => {
    expect(replyLocaleFor("ба забони англисӣ ҷавоб деҳ", "tg")).toBe("en");
    expect(replyLocaleFor("ба забони англиси чавоб дех", "tg")).toBe("en");
    expect(replyLocaleFor("бо русӣ фаҳмон", "tg")).toBe("ru");
    expect(replyLocaleFor("ответь по-таджикски", "ru")).toBe("tg");
    expect(replyLocaleFor("Explain it in Russian please", "en")).toBe("ru");
    expect(replyLocaleFor("ответь на английском", "ru")).toBe("en");
  });

  it("ignores look-alikes that are not language requests", () => {
    expect(explicitReplyLocale("ба Русия чӣ тавр равам")).toBeNull();
    expect(explicitReplyLocale("цены на русском рынке")).toBeNull();
    expect(explicitReplyLocale("the English Channel")).toBeNull();
  });

  it("the last requested language wins", () => {
    expect(explicitReplyLocale("матнро аз англисӣ тарҷума кун ба забони русӣ")).toBe("ru");
  });

  it("labels Tajik as Cyrillic Tajik", () => {
    expect(replyLanguageLabel("tg")).toContain("Tajik");
    expect(replyLanguageLabel("ru")).toContain("Russian");
  });
});
