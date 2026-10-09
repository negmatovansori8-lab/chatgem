import { NextResponse } from "next/server";
import { z } from "zod";
import {
  craftCreativeBrief,
  mapModeToKind,
  withModeFormat,
  type CreativeMode,
} from "@/lib/creative-brief";
import { buildImageBrief } from "@/lib/image-brief";

export const runtime = "nodejs";

const schema = z.object({
  prompt: z.string().min(1).max(2000),
  mode: z
    .enum([
      "general",
      "logo",
      "photo",
      "poster",
      "banner",
      "illustration",
      "icon",
      "sticker",
      "product",
      "social",
      "edit",
    ])
    .optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Enter a short description to enhance." } },
      { status: 400 },
    );
  }

  const mode = (parsed.data.mode ?? "general") as CreativeMode;
  const idea = parsed.data.prompt.trim();

  try {
    const brief = await buildImageBrief(withModeFormat(idea, mode), {
      kindHint: mapModeToKind(mode),
    });
    return NextResponse.json({
      subject: brief.subject,
      enhancedPrompt: brief.prompt,
      fluxPrompt: brief.fluxPrompt,
      kind: brief.imageKind,
      briefKind: brief.kind,
      title: brief.title,
      aspect: brief.aspect,
      mode,
    });
  } catch {
    const fallback = craftCreativeBrief(idea, mode);
    return NextResponse.json({
      subject: idea,
      enhancedPrompt: fallback || idea,
      kind: mapModeToKind(mode),
      mode,
    });
  }
}
