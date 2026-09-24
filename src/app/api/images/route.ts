import { NextResponse } from "next/server";
import { z } from "zod";
import { generateImageFromPrompt } from "@/lib/generate-image";

export const maxDuration = 90;
export const runtime = "nodejs";

const schema = z.object({
  prompt: z.string().min(1).max(2000),
  kind: z.enum(["logo", "photo", "general", "auto"]).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const result = await generateImageFromPrompt(
    parsed.data.prompt,
    parsed.data.kind,
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: {
          code: "IMAGE_FAILED",
          message: `Тасвир сохта нашуд. ${result.detail}`,
        },
      },
      { status: 502 },
    );
  }

  const kind = result.kind;
  return NextResponse.json({
    configured: true,
    provider: result.provider,
    kind,
    url: result.url,
    prompt: result.prompt,
    subject: result.subject,
    warning: "warning" in result ? result.warning : undefined,
    captionKey:
      kind === "logo" ? "logoReady" : kind === "photo" ? "photoReady" : "imageReady",
    message:
      kind === "logo"
        ? "Here is your logo."
        : kind === "photo"
          ? "Here is your photo."
          : "Here is your image.",
  });
}
