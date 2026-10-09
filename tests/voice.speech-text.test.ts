import { describe, expect, it } from "vitest";
import { SentenceChunker, toSpeakable } from "@/lib/voice/speech-text";
import { NORMAL_DETECTOR, STRICT_DETECTOR, SpeechDetector } from "@/features/voice/speech-detector";

describe("toSpeakable", () => {
  it("strips markdown, code, links, URLs and emoji", () => {
    const md = [
      "## Ҷавоб 😀",
      "**Муҳим:** ин [ҳуҷҷат](https://example.com/doc) аст.",
      "- банди якум",
      "```js",
      "console.log('hidden')",
      "```",
      "| a | b |",
      "Сайт: https://example.com",
    ].join("\n");
    const out = toSpeakable(md);
    expect(out).toContain("Ҷавоб");
    expect(out).toContain("Муҳим: ин ҳуҷҷат аст.");
    expect(out).toContain("банди якум");
    expect(out).not.toMatch(/console|https?:|\||[*#`]|😀/);
  });
});

describe("SentenceChunker", () => {
  it("emits a short first chunk quickly, then larger ones as text streams", () => {
    const c = new SentenceChunker();
    const full = "Салом! Ман ассистенти шумо ҳастам. Имрӯз ҳаво хуб аст ва офтоб мебарояд. Боз чӣ савол доред?";
    const got: string[] = [];
    for (let i = 1; i <= full.length; i += 7) got.push(...c.update(full.slice(0, i)).chunks);
    got.push(...c.update(full, true).chunks);
    expect(got.length).toBeGreaterThanOrEqual(2);
    expect(got[0]!.length).toBeLessThan(60);
    expect(got.join(" ").replace(/\s+/g, " ")).toBe(full);
  });

  it("never reads code blocks, even unfinished ones", () => {
    const c = new SentenceChunker({ firstMinChars: 5 });
    const partial = "Here is code. ```python\nprint('x')\n";
    const first = c.update(partial).chunks;
    expect(first.join(" ")).toBe("Here is code.");
    const done = c.update(partial + "```\nThat prints x.", true).chunks;
    expect(done.join(" ")).toBe("That prints x.");
  });

  it("signals reset when the answer is replaced", () => {
    const c = new SentenceChunker({ firstMinChars: 5 });
    c.update("First answer. More text");
    const r = c.update("Completely different answer.", true);
    expect(r.reset).toBe(true);
    expect(r.chunks.join(" ")).toBe("Completely different answer.");
  });

  it("cuts very long sentences without punctuation", () => {
    const c = new SentenceChunker({ maxChars: 80 });
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const chunks = c.update(long).chunks;
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((x) => x.length <= 80)).toBe(true);
  });
});

describe("SpeechDetector", () => {
  function run(d: SpeechDetector, rms: number, fromMs: number, toMs: number, step = 40) {
    const events: string[] = [];
    for (let t = fromMs; t < toMs; t += step) {
      const e = d.push(rms, t);
      if (e) events.push(`${e}@${t}`);
    }
    return events;
  }

  it("detects speech start after a sustained voice and end after silence", () => {
    const d = new SpeechDetector(NORMAL_DETECTOR);
    expect(run(d, 0.003, 0, 1000)).toEqual([]);
    const start = run(d, 0.08, 1000, 2000);
    expect(start).toHaveLength(1);
    expect(start[0]).toMatch(/^speech-start/);
    const end = run(d, 0.003, 2000, 3500);
    expect(end).toHaveLength(1);
    expect(end[0]).toMatch(/^speech-end/);
  });

  it("ignores short clicks", () => {
    const d = new SpeechDetector(NORMAL_DETECTOR);
    run(d, 0.003, 0, 1000);
    expect(run(d, 0.2, 1000, 1080)).toEqual([]);
    expect(run(d, 0.003, 1080, 2000)).toEqual([]);
  });

  it("adapts to a noisy room", () => {
    const d = new SpeechDetector(NORMAL_DETECTOR);
    expect(run(d, 0.02, 0, 3000)).toEqual([]);
    expect(run(d, 0.12, 3000, 4000)[0]).toMatch(/^speech-start/);
  });

  it("treats a steady hum that starts later as background noise", () => {
    const d = new SpeechDetector(NORMAL_DETECTOR);
    run(d, 0.003, 0, 1000);
    const events = run(d, 0.03, 1000, 9000);
    expect(events[0]).toMatch(/^speech-start/);
    expect(events[1]).toMatch(/^speech-end/);
    expect(run(d, 0.03, 9000, 12000)).toEqual([]);
    expect(run(d, 0.15, 12000, 13000)[0]).toMatch(/^speech-start/);
  });

  it("interrupt detection tolerates the gaps between syllables", () => {
    const d = new SpeechDetector(STRICT_DETECTOR);
    run(d, 0.003, 0, 1000);
    const events: string[] = [];
    // 80 ms voiced, 80 ms dip — like real speech — for one second.
    for (let t = 1000; t < 2000; t += 40) {
      const e = d.push(Math.floor((t - 1000) / 80) % 2 === 0 ? 0.1 : 0.01, t);
      if (e) events.push(e);
    }
    expect(events).toEqual(["speech-start"]);
  });

  it("strict mode (while the AI talks) needs a louder voice", () => {
    const d = new SpeechDetector(STRICT_DETECTOR);
    run(d, 0.003, 0, 1000);
    expect(run(d, 0.03, 1000, 2000)).toEqual([]);
    expect(run(d, 0.1, 2000, 3000)[0]).toMatch(/^speech-start/);
  });
});
