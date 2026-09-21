import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  prompt: z.string().min(1).max(2000),
});

/**
 * Image generation via free Pollinations CDN (no API key).
 * Optional: set IMAGE_PROVIDERS_CONFIGURED + OpenAI for vendor path later.
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
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Date.now() % 100000}`;

  return NextResponse.json({
    configured: true,
    provider: "pollinations",
    url,
    prompt,
    message: "Image URL ready — opens a generated image from Pollinations (free).",
  });
}
