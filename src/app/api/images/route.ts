import { NextResponse } from "next/server";
import { z } from "zod";
import { enhanceImagePrompt } from "@/lib/image-prompt";

export const maxDuration = 90;
export const runtime = "nodejs";

const schema = z.object({
  prompt: z.string().min(1).max(2000),
  kind: z.enum(["logo", "photo", "general", "auto"]).optional(),
});

type GenOk = { ok: true; url: string; provider: string };
type GenFail = { ok: false; detail: string; status?: number };

async function toDataUrl(
  bytes: ArrayBuffer,
  mime = "image/png",
): Promise<string> {
  const b64 = Buffer.from(bytes).toString("base64");
  return `data:${mime};base64,${b64}`;
}

async function generateWithOpenAI(prompt: string): Promise<GenOk | GenFail> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { ok: false, detail: "OPENAI_API_KEY missing" };
  }

  const attempts: Array<Record<string, unknown>> = [
    {
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
      quality: "standard",
    },
    {
      model: "dall-e-2",
      prompt,
      n: 1,
      size: "512x512",
      response_format: "b64_json",
    },
  ];

  let lastDetail = "OpenAI images failed";
  let lastStatus = 0;

  for (const body of attempts) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text().catch(() => "");
    if (!res.ok) {
      lastStatus = res.status;
      lastDetail = raw.slice(0, 300) || `HTTP ${res.status}`;
      continue;
    }
    try {
      const data = JSON.parse(raw) as {
        data?: Array<{ url?: string; b64_json?: string }>;
      };
      const first = data.data?.[0];
      if (first?.b64_json) {
        return {
          ok: true,
          provider: String(body.model),
          url: `data:image/png;base64,${first.b64_json}`,
        };
      }
      if (first?.url) {
        const img = await fetch(first.url);
        if (img.ok) {
          const buf = await img.arrayBuffer();
          return {
            ok: true,
            provider: String(body.model),
            url: await toDataUrl(
              buf,
              img.headers.get("content-type") || "image/png",
            ),
          };
        }
      }
      lastDetail = "Empty image payload from OpenAI";
    } catch {
      lastDetail = "Invalid OpenAI response";
    }
  }

  return { ok: false, detail: lastDetail, status: lastStatus };
}

async function generateWithPollinations(
  prompt: string,
  kind: "logo" | "photo" | "general",
): Promise<GenOk | GenFail> {
  const encoded = encodeURIComponent(prompt);
  const seed = Date.now() % 100000;
  const style =
    kind === "logo"
      ? "&model=flux&style=logo"
      : kind === "photo"
        ? "&model=flux"
        : "&model=flux";
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&enhance=true&seed=${seed}${style}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(75_000),
    });
    if (!res.ok) {
      return { ok: false, detail: `Pollinations HTTP ${res.status}` };
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) {
      return { ok: false, detail: "Pollinations returned empty image" };
    }
    const mime = res.headers.get("content-type") || "image/jpeg";
    return {
      ok: true,
      provider: "pollinations",
      url: await toDataUrl(buf, mime),
    };
  } catch (error) {
    return {
      ok: false,
      detail:
        error instanceof Error ? error.message : "Pollinations fetch failed",
    };
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const enhanced = enhanceImagePrompt(parsed.data.prompt);
  const kind =
    parsed.data.kind && parsed.data.kind !== "auto"
      ? parsed.data.kind
      : enhanced.kind;
  const prompt = enhanced.prompt;

  const openai = await generateWithOpenAI(prompt);
  if (openai.ok) {
    return NextResponse.json({
      configured: true,
      provider: openai.provider,
      kind,
      url: openai.url,
      prompt,
      message:
        kind === "logo"
          ? "Логотип омода."
          : kind === "photo"
            ? "Сурат омода."
            : `Тасвир омода (${openai.provider}).`,
    });
  }

  const poll = await generateWithPollinations(prompt, kind);
  if (poll.ok) {
    return NextResponse.json({
      configured: true,
      provider: poll.provider,
      kind,
      url: poll.url,
      prompt,
      openaiError: { detail: openai.detail, status: openai.status },
      message:
        kind === "logo"
          ? "Логотип омода (Pollinations)."
          : kind === "photo"
            ? "Сурат омода (Pollinations)."
            : "Тасвир омода (Pollinations).",
    });
  }

  return NextResponse.json(
    {
      error: {
        code: "IMAGE_FAILED",
        message: `Тасвир сохта нашуд. OpenAI: ${openai.detail}. Fallback: ${poll.detail}`,
      },
      openaiError: { detail: openai.detail, status: openai.status },
    },
    { status: 502 },
  );
}
