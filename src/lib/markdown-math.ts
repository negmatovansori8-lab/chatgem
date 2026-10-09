/**
 * Models write LaTeX as \( … \), \[ … \] or $…$. remark-math only reads $$…$$ here
 * (single-dollar math is off so prices like «$5 and $10» stay text), so normalise before rendering.
 */

const CODE_RE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g;

function convert(text: string): string {
  return (
    text
      .replace(/\\\[([\s\S]+?)\\\]/g, (_, body: string) => `\n$$\n${body.trim()}\n$$\n`)
      .replace(/\\\(([\s\S]+?)\\\)/g, (_, body: string) => `$$${body.trim()}$$`)
      // $…$ only when it clearly is math (a TeX command, ^ or _), never «$5 or $10».
      .replace(/(?<![\\$\w])\$(?!\s)([^$\n]*?[\\^_][^$\n]*?)(?<!\s)\$(?![\w$])/g, (_, body: string) => `$$${body}$$`)
  );
}

export function normalizeMath(markdown: string): string {
  if (!/[\\$]/.test(markdown)) return markdown;
  return markdown
    .split(CODE_RE)
    .map((part, i) => (i % 2 === 1 ? part : convert(part)))
    .join("");
}
