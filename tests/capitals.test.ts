import { describe, expect, it } from "vitest";
import { capitalAnswer } from "@/lib/assistant/capitals";
import { encyclopediaSubject } from "@/lib/assistant/encyclopedia";

describe("capital questions", () => {
  it("names Tokyo instead of inventing a printer part", () => {
    expect(capitalAnswer("Пойтахти чопон чист")).toBe("Пойтахти Ҷопон — Токио.");
    expect(capitalAnswer("пойтахти Ҷопон?")).toBe("Пойтахти Ҷопон — Токио.");
    expect(capitalAnswer("столица Японии")).toBe("Столица Японии — Токио.");
    expect(capitalAnswer("what is the capital of Japan")).toBe("The capital of Japan is Токио.");
  });

  it("does not treat a capital question as an unknown word to define", () => {
    expect(encyclopediaSubject("Пойтахти чопон чист")).toBeNull();
  });

  it("leaves ordinary chat alone", () => {
    expect(capitalAnswer("Салом")).toBeNull();
    expect(capitalAnswer("сурат соз пойтахти Ҷопон")).toBeNull();
  });
});
