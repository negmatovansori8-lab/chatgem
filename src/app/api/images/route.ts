import { NextResponse } from "next/server";
import { z } from "zod";
import { runImageGeneration } from "@/providers/images";
import { storeDataUrl } from "@/lib/stored-image";
import { consumeFreeTurn } from "@/server/free-limit";
import { getRequestUserId } from "@/server/session";

export const maxDuration = 120;
export const runtime = "nodejs";

const schema = z.object({
  prompt: z.string().min(1).max(2000),
  kind: z.enum(["logo", "photo", "general", "auto"]).optional(),
  aspect: z
    .enum(["1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4"])
    .optional(),
  style: z
    .enum([
      "auto",
      "photo",
      "cinematic",
      "illustration",
      "3d",
      "product",
      "concept",
      "poster",
      "anime",
      "fantasy",
      "scifi",
    ])
    .optional(),
  negativePrompt: z.string().max(800).optional(),
  quality: z.enum(["standard", "hd"]).optional(),
  variants: z.number().int().min(1).max(4).optional(),
  variation: z.boolean().optional(),
  skipEnhance: z.boolean().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Check your prompt and image settings, then try again." } },
      { status: 400 },
    );
  }

  const userId = await getRequestUserId(request);
  const turn = await consumeFreeTurn(userId);
  if (!turn.ok) {
    return NextResponse.json(
      {
        error: {
          code: "USAGE_EXCEEDED",
          message: "Message limit reached",
          resetAt: turn.resetAt,
          limit: turn.limit,
        },
      },
      { status: 429 },
    );
  }

  const result = await runImageGeneration({
    prompt: parsed.data.prompt,
    kind: parsed.data.kind,
    aspect: parsed.data.aspect,
    style: parsed.data.style,
    negativePrompt: parsed.data.negativePrompt,
    quality: parsed.data.quality,
    variants: parsed.data.variants,
    variation: parsed.data.variation,
    skipEnhance: parsed.data.skipEnhance,
    signal: request.signal,
  });

  if (!result.ok) {
    const status =
      result.code === "AUTH"
        ? 401
        : result.code === "QUOTA" || result.code === "RATE_LIMIT"
          ? 429
          : result.status === 499
            ? 499
            : 502;
    return NextResponse.json(
      {
        error: {
          code: result.code ?? "IMAGE_FAILED",
          message: result.detail,
        },
      },
      { status },
    );
  }

  const url = result.url.startsWith("data:")
    ? (await storeDataUrl(result.url)) ?? result.url
    : result.url;
  const images = (result.images?.length
    ? result.images
    : [{ url: result.url, width: result.width, height: result.height, provider: result.provider }]
  ).map((image) => ({ ...image, url: image.url === result.url ? url : image.url }));

  return NextResponse.json({
    configured: true,
    provider: result.provider,
    kind: result.kind,
    url,
    prompt: result.prompt,
    originalPrompt: result.originalPrompt,
    subject: result.subject,
    aspect: result.aspect,
    style: result.style,
    width: result.width,
    height: result.height,
    warning: result.warning,
    title: result.title,
    briefKind: result.briefKind,
    images,
    captionKey:
      result.kind === "logo"
        ? "logoReady"
        : result.kind === "photo"
          ? "photoReady"
          : "imageReady",
    message:
      result.kind === "logo"
        ? "Here is your logo."
        : result.kind === "photo"
          ? "Here is your photo."
          : "Here is your image.",
  });
}
