import { describe, expect, it } from "vitest";
import { normalizeMath } from "../src/lib/markdown-math";

describe("normalizeMath", () => {
  it("turns \\( \\) and \\[ \\] into KaTeX delimiters", () => {
    expect(normalizeMath("Рэлей: \\(I \\propto \\frac{1}{\\lambda^4}\\).")).toBe("Рэлей: $$I \\propto \\frac{1}{\\lambda^4}$$.");
    expect(normalizeMath("\\[E = mc^2\\]")).toBe("\n$$\nE = mc^2\n$$\n");
  });

  it("converts single-dollar math but keeps prices as text", () => {
    expect(normalizeMath("масса $m_1$ ва $x^2$")).toBe("масса $$m_1$$ ва $$x^2$$");
    expect(normalizeMath("Нарх $5 ва $10 аст")).toBe("Нарх $5 ва $10 аст");
  });

  it("leaves code untouched", () => {
    const code = "```js\nconst s = `$x^2$`; // \\(a\\)\n```";
    expect(normalizeMath(code)).toBe(code);
    expect(normalizeMath("use `\\(x\\)` here")).toBe("use `\\(x\\)` here");
  });
});
