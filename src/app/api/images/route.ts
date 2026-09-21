import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  prompt: z.string().min(1).max(2000),
});

async function generateWithOpenAI(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("OpenAI image error", res.status, errText.slice(0, 400));
    return null;
  }

  const data = (await res.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
  };
  const first = data.data?.[0];
  if (first?.url) return first.url;
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  return null;
}

function pollinationsUrl(prompt: string) {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Date.now() % 100000}`;
}

/**
 * Image generation: OpenAI DALL·E 3 when keyed, else free Pollinations.
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
    const openaiUrl = await generateWithOpenAI(prompt);
    if (openaiUrl) {
      return NextResponse.json({
        configured: true,
        provider: "openai-dall-e-3",
        url: openaiUrl,
        prompt,
        message: "Image generated with OpenAI DALL·E 3.",
      });
    }
  } catch (error) {
    console.error("OpenAI image failed", error);
  }

  const url = pollinationsUrl(prompt);
  return NextResponse.json({
    configured: true,
    provider: "pollinations",
    url,
    prompt,
    message:
      "OpenAI image unavailable — using free Pollinations. Wait a few seconds for the image to load.",
  });
}
