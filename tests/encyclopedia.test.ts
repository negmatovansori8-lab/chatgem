import { afterEach, describe, expect, it, vi } from "vitest";
import { encyclopediaBlock, encyclopediaSubject, lookupEncyclopedia } from "../src/lib/assistant/encyclopedia";

describe("encyclopedia questions", () => {
  it("finds the subject of «who is» questions in Tajik, Russian and English", () => {
    expect(encyclopediaSubject("исмоили сомони кист")).toBe("исмоили сомони");
    expect(encyclopediaSubject("Рӯдакӣ кӣ буд?")).toBe("Рӯдакӣ");
    expect(encyclopediaSubject("кто такой Ибн Сина")).toBe("Ибн Сина");
    expect(encyclopediaSubject("Who was Avicenna?")).toBe("Avicenna");
  });

  it("also grounds «tell me about» and «what is <Name>» questions", () => {
    expect(encyclopediaSubject("дар бораи Садриддин Айнӣ маълумот деҳ")).toBe("Садриддин Айнӣ");
    expect(encyclopediaSubject("расскажи о Рудаки")).toBe("Рудаки");
    expect(encyclopediaSubject("tell me about Ibn Sina")).toBe("Ibn Sina");
    expect(encyclopediaSubject("Помир чист?")).toBe("Помир");
    expect(encyclopediaSubject("What is Python")).toBe("Python");
  });

  it("ignores questions about the assistant and ordinary requests", () => {
    expect(encyclopediaSubject("ИСМ ЧИСТ")).toBeNull();
    expect(encyclopediaSubject("what is the capital of France")).toBeNull();
    expect(encyclopediaSubject("ин чист")).toBeNull();
    expect(encyclopediaSubject("ту кист")).toBeNull();
    expect(encyclopediaSubject("who are you")).toBeNull();
    expect(encyclopediaSubject("ба ман промт деҳ")).toBeNull();
    expect(encyclopediaSubject("исм чист")).toBeNull();
  });
});

describe("encyclopedia lookup", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("matches Tajik typed without special letters and returns the intro", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        const url = new URL(String(input));
        calls.push(url.searchParams.get("srsearch") ?? url.searchParams.get("pageids") ?? "");
        if (url.searchParams.get("list") === "search") {
          const q = url.searchParams.get("srsearch");
          const search =
            q === "исмоили сомонӣ"
              ? [{ pageid: 1, title: "Исмоили Сомонӣ" }, { pageid: 2, title: "Ордени Исмоили Сомонӣ" }]
              : [{ pageid: 9, title: "Зайналобуддин Боқизода" }];
          return Response.json({ query: { search } });
        }
        return Response.json({
          query: {
            pages: {
              "1": {
                title: "Исмоили Сомонӣ",
                fullurl: "https://tg.wikipedia.org/wiki/Исмоили_Сомонӣ",
                extract: "Абуиброҳим Исмоил ибни Аҳмади Сомонӣ (апрели 849, Фарғона — 24 ноябри 907, Бухоро) — асосгузори давлати Сомониён.",
              },
            },
          },
        });
      }),
    );

    const entry = await lookupEncyclopedia("исмоили сомони");
    expect(entry).toMatchObject({ title: "Исмоили Сомонӣ", lang: "tg" });
    expect(calls).toContain("исмоили сомонӣ");
    expect(encyclopediaBlock(entry!)).toContain("849");
  });

  it("follows a redirect name to the article («Темурланг» → «Темур»)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        const url = new URL(String(input));
        if (url.searchParams.get("list") === "search") {
          return Response.json({
            query: { search: [{ pageid: 6659, title: "Темур", redirecttitle: "Темурланг" }, { pageid: 2, title: "Амир" }] },
          });
        }
        if (url.searchParams.get("prop") === "langlinks") {
          return Response.json({ query: { pages: { "6659": { langlinks: [{ lang: "ru", "*": "Тамерлан" }] } } } });
        }
        if (url.hostname.startsWith("ru.")) {
          return Response.json({
            query: {
              pages: {
                "7": {
                  title: "Тамерлан",
                  fullurl: "https://ru.wikipedia.org/wiki/Тамерлан",
                  extract: "Тиму́р ибн Тараґай Барлас, известный как Тамерлан (9 апреля 1336, Кеш — 18 февраля 1405, Отрар) — среднеазиатский завоеватель, основатель империи Тимуридов.",
                },
              },
            },
          });
        }
        return Response.json({
          query: {
            pages: {
              "6659": {
                title: "Темур",
                fullurl: "https://tg.wikipedia.org/wiki/Темур",
                extract: "Темур (Темурланг; 9 апрели 1336, Кеш — 18 феврали 1405, Ўтрор) — сарлашкар ва асосгузори давлати Темуриён.",
              },
            },
          },
        });
      }),
    );
    const entry = await lookupEncyclopedia("темурланг");
    expect(entry).toMatchObject({ title: "Темур", lang: "tg", more: { title: "Тамерлан", lang: "ru" } });
    expect(encyclopediaBlock(entry!)).toContain("1336");
  });

  it("returns nothing when no article really matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ query: { search: [{ pageid: 5, title: "Something else" }] } })),
    );
    expect(await lookupEncyclopedia("xyzzy qwerty")).toBeNull();
  });
});
