export type ToolDefinition = {
  slug: string;
  name: string;
  description: string;
  category: string;
  configured: boolean;
};

/**
 * Tool Registry foundation.
 * Tools execute only when their backends are configured (except pure local tools).
 */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition) {
    this.tools.set(tool.slug, tool);
  }

  list() {
    return Array.from(this.tools.values());
  }

  get(slug: string) {
    return this.tools.get(slug);
  }
}

export const toolRegistry = new ToolRegistry();

toolRegistry.register({
  slug: "calculator",
  name: "Calculator",
  description: "Deterministic math utilities.",
  category: "productivity",
  configured: true,
});

toolRegistry.register({
  slug: "web-search",
  name: "Web Search",
  description: "Search the web (DuckDuckGo free or Tavily when configured).",
  category: "research",
  configured: true,
});

toolRegistry.register({
  slug: "file-reader",
  name: "File Reader",
  description: "Summarize or explain text you paste / uploaded file text.",
  category: "files",
  configured: true,
});

toolRegistry.register({
  slug: "translator",
  name: "Translation",
  description: "Translation via Groq / OpenAI when a key is set.",
  category: "language",
  configured: false,
});

toolRegistry.register({
  slug: "code-utils",
  name: "Code Utilities",
  description: "Explain, fix, or refactor code with AI.",
  category: "coding",
  configured: true,
});

/** Safe calculator — only digits and + - * / ( ) . % */
export function runCalculator(expression: string): { ok: true; result: number } | { ok: false; error: string } {
  const cleaned = expression.replace(/\s+/g, "");
  if (!/^[0-9+\-*/().%]+$/.test(cleaned)) {
    return { ok: false, error: "Only basic arithmetic characters are allowed." };
  }
  try {
    const value = Function(`"use strict"; return (${cleaned});`)() as unknown;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ok: false, error: "Invalid calculation result." };
    }
    return { ok: true, result: value };
  } catch {
    return { ok: false, error: "Could not evaluate expression." };
  }
}

function hasAiKey() {
  return Boolean(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
}

export function syncToolConfiguredFlags() {
  const translator = toolRegistry.get("translator");
  if (translator) translator.configured = hasAiKey();
  const code = toolRegistry.get("code-utils");
  if (code) code.configured = hasAiKey();
  const fileReader = toolRegistry.get("file-reader");
  if (fileReader) fileReader.configured = hasAiKey();
  const web = toolRegistry.get("web-search");
  if (web) web.configured = true;
}
