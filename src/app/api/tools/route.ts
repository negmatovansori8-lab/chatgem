import { NextResponse } from "next/server";
import { z } from "zod";
import { runCalculator, syncToolConfiguredFlags, toolRegistry } from "@/tools/registry";
import { generateText } from "@/services/ai/generate";
import { webSearch } from "@/services/search/web-search";

export async function GET() {
  syncToolConfiguredFlags();
  return NextResponse.json({ tools: toolRegistry.list() });
}

const execSchema = z.object({
  slug: z.string(),
  input: z.string().min(1).max(8000),
});

export async function POST(request: Request) {
  syncToolConfiguredFlags();
  const body = await request.json().catch(() => ({}));
  const parsed = execSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const tool = toolRegistry.get(parsed.data.slug);
  if (!tool) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Tool not found" } },
      { status: 404 },
    );
  }
  if (!tool.configured) {
    return NextResponse.json(
      {
        error: {
          code: "PROVIDER_NOT_CONFIGURED",
          message: `${tool.name} is not configured.`,
        },
      },
      { status: 503 },
    );
  }

  try {
    if (tool.slug === "calculator") {
      const result = runCalculator(parsed.data.input);
      if (!result.ok) {
        return NextResponse.json(
          { error: { code: "TOOL_ERROR", message: result.error } },
          { status: 400 },
        );
      }
      return NextResponse.json({ result: String(result.result) });
    }

    if (tool.slug === "web-search") {
      const search = await webSearch(parsed.data.input);
      if (!search.configured) {
        return NextResponse.json({
          result: search.message,
          sources: [],
        });
      }
      const lines = search.results.map(
        (r, i) => `${i + 1}. ${r.title} (${r.domain})\n${r.url}\n${r.snippet}`,
      );
      return NextResponse.json({
        result: lines.join("\n\n") || "No results.",
        sources: search.results,
        hint: search.answerHint,
      });
    }

    if (tool.slug === "translator") {
      const { content, modelId } = await generateText({
        system:
          "You are ChatGem translator. Detect language and translate clearly. Preserve meaning. Reply with translation only unless asked otherwise.",
        prompt: parsed.data.input,
      });
      return NextResponse.json({ result: content, modelId });
    }

    if (tool.slug === "code-utils") {
      const { content, modelId } = await generateText({
        system:
          "You are ChatGem Code. Explain, fix, or refactor the given code. Be concise and accurate.",
        prompt: parsed.data.input,
      });
      return NextResponse.json({ result: content, modelId });
    }

    if (tool.slug === "file-reader") {
      const { content, modelId } = await generateText({
        system:
          "You are ChatGem File Reader. Summarize or answer questions about the pasted text.",
        prompt: parsed.data.input,
      });
      return NextResponse.json({ result: content, modelId });
    }

    return NextResponse.json(
      {
        error: {
          code: "NOT_IMPLEMENTED",
          message: `${tool.name} handler not implemented.`,
        },
      },
      { status: 501 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "TOOL_ERROR",
          message: error instanceof Error ? error.message : "Tool failed",
        },
      },
      { status: 502 },
    );
  }
}
