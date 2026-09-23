import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  prompt: z.string().min(1).max(2000),
});

type OpenAIResult =
  | { ok: true; url: string; model: string }
  | { ok: false; status: number; detail: string };

async function generateWithOpenAI(prompt: string): Promise<OpenAIResult> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { ok: false, status: 0, detail: "OPENAI_API_KEY missing on server" };
  }

  // Try DALL·E 3, then DALL·E 2 (wider availability on some accounts).
  const attempts: Array<{ model: string; size: string }> = [
    { model: "dall-e-3", size: "1024x1024" },
    { model: "dall-e-2", size: "1024x1024" },
  ];

  let lastDetail = "unknown";
  let lastStatus = 0;

  for (const attempt of attempts) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: attempt.model,
        prompt,
        n: 1,
        size: attempt.size,
      }),
    });

    const raw = await res.text().catch(() => "");
    if (!res.ok) {
      lastStatus = res.status;
      lastDetail = raw.slice(0, 280) || `HTTP ${res.status}`;
      continue;
    }

    try {
      const data = JSON.parse(raw) as {
        data?: Array<{ url?: string; b64_json?: string }>;
      };
      const first = data.data?.[0];
      if (first?.url) {
        return { ok: true, url: first.url, model: attempt.model };
      }
      if (first?.b64_json) {
        return {
          ok: true,
          url: `data:image/png;base64,${first.b64_json}`,
          model: attempt.model,
        };
      }
      lastDetail = "OpenAI returned empty image payload";
    } catch {
      lastDetail = "Invalid JSON from OpenAI images API";
    }
  }

  return { ok: false, status: lastStatus, detail: lastDetail };
}

function pollinationsUrl(prompt: string) {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&enhance=true&seed=${Date.now() % 100000}`;
}

/**
 * Image generation: OpenAI DALL·E when available, else free Pollinations.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const prompt = parsed.data.prompt.trim();

  try {
    const openai = await generateWithOpenAI(prompt);
    if (openai.ok) {
      return NextResponse.json({
        configured: true,
        provider: `openai-${openai.model}`,
        url: openai.url,
        prompt,
        message: `Тасвир бо ${openai.model} сохта шуд.`,
      });
    }

    const url = pollinationsUrl(prompt);
    return NextResponse.json({
      configured: true,
      provider: "pollinations",
      url,
      prompt,
      openaiError: {
        status: openai.status,
        detail: openai.detail,
      },
      message:
        "OpenAI тасвир надод — Pollinations (бепул). 10–30 сония интизор шавед то акс бор шавад. Агар холӣ монад, промпти дигар санҷед.",
    });
  } catch (error) {
    const url = pollinationsUrl(prompt);
    return NextResponse.json({
      configured: true,
      provider: "pollinations",
      url,
      prompt,
      message:
        error instanceof Error
          ? `Хато: ${error.message}. Pollinations истифода шуд.`
          : "Хато — Pollinations истифода шуд.",
    });
  }
}
