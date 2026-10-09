import { NextResponse } from "next/server";
import { z } from "zod";
import { craftCreativeBrief } from "@/lib/creative-brief";
import { runImageGeneration } from "@/providers/images";
import {
  openaiGenerateHd,
  openaiImageEdit,
  openaiImageVariation,
} from "@/providers/images/openai-edit";

export const maxDuration = 120;
export const runtime = "nodejs";

const schema = z.object({
  mode: z.enum([
    "variation",
    "edit",
    "upscale",
    "remove-bg",
    "replace-bg",
    "enhance-quality",
  ]),
  imageUrl: z.string().min(8).max(6_000_000),
  prompt: z.string().max(2000).optional(),
  background: z.string().max(400).optional(),
  aspect: z
    .enum(["1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4"])
    .optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid transform request." } },
      { status: 400 },
    );
  }

  const { mode, imageUrl, aspect } = parsed.data;
  const userPrompt = parsed.data.prompt?.trim() || "";
  const bg = parsed.data.background?.trim() || "soft studio gray";

  try {
    if (mode === "variation") {
      const v = await openaiImageVariation({
        imageUrl,
        aspect,
        signal: request.signal,
      });
      if (v.ok) {
        return NextResponse.json({
          url: v.url,
          provider: v.provider,
          mode,
          width: v.width,
          height: v.height,
        });
      }
      // Fallback: regenerate with variation nudge
      const fallback = await runImageGeneration({
        prompt:
          userPrompt ||
          "Create a fresh professional variation of the same subject and style",
        variation: true,
        aspect: aspect ?? "1:1",
        quality: "hd",
        signal: request.signal,
      });
      if (!fallback.ok) {
        return NextResponse.json(
          { error: { message: v.detail || fallback.detail } },
          { status: 502 },
        );
      }
      return NextResponse.json({
        url: fallback.url,
        provider: fallback.provider,
        mode,
        prompt: fallback.prompt,
        warning: v.detail,
      });
    }

    if (mode === "edit") {
      if (!userPrompt) {
        return NextResponse.json(
          { error: { message: "Describe the edit." } },
          { status: 400 },
        );
      }
      const brief = craftCreativeBrief(userPrompt, "edit");
      const edited = await openaiImageEdit({
        imageUrl,
        prompt: brief,
        aspect,
        signal: request.signal,
      });
      if (edited.ok) {
        return NextResponse.json({
          url: edited.url,
          provider: edited.provider,
          mode,
          prompt: brief,
        });
      }
      const gen = await runImageGeneration({
        prompt: `${brief}. Inspired by the uploaded reference composition.`,
        kind: "general",
        aspect: aspect ?? "1:1",
        quality: "hd",
        signal: request.signal,
      });
      if (!gen.ok) {
        return NextResponse.json(
          { error: { message: edited.detail || gen.detail } },
          { status: 502 },
        );
      }
      return NextResponse.json({
        url: gen.url,
        provider: gen.provider,
        mode,
        prompt: gen.prompt,
        warning: edited.detail,
      });
    }

    if (mode === "remove-bg") {
      const brief = craftCreativeBrief(
        userPrompt ||
          "Isolate the main subject on a pure white seamless background, clean cutout, product studio look",
        "product",
      );
      const edited = await openaiImageEdit({
        imageUrl,
        prompt: brief,
        aspect: aspect ?? "1:1",
        signal: request.signal,
      });
      if (edited.ok) {
        return NextResponse.json({
          url: edited.url,
          provider: edited.provider,
          mode,
          prompt: brief,
        });
      }
      const gen = await runImageGeneration({
        prompt: brief,
        kind: "photo",
        style: "product",
        aspect: aspect ?? "1:1",
        quality: "hd",
        signal: request.signal,
      });
      if (!gen.ok) {
        return NextResponse.json(
          { error: { message: edited.detail || gen.detail } },
          { status: 502 },
        );
      }
      return NextResponse.json({
        url: gen.url,
        provider: gen.provider,
        mode,
        prompt: gen.prompt,
        warning: edited.detail,
      });
    }

    if (mode === "replace-bg") {
      const brief = craftCreativeBrief(
        `Keep the same main subject, replace background with: ${bg}. ${userPrompt}`.trim(),
        "edit",
      );
      const edited = await openaiImageEdit({
        imageUrl,
        prompt: brief,
        aspect: aspect ?? "1:1",
        signal: request.signal,
      });
      if (edited.ok) {
        return NextResponse.json({
          url: edited.url,
          provider: edited.provider,
          mode,
          prompt: brief,
        });
      }
      const gen = await runImageGeneration({
        prompt: brief,
        kind: "photo",
        aspect: aspect ?? "1:1",
        quality: "hd",
        signal: request.signal,
      });
      if (!gen.ok) {
        return NextResponse.json(
          { error: { message: edited.detail || gen.detail } },
          { status: 502 },
        );
      }
      return NextResponse.json({
        url: gen.url,
        provider: gen.provider,
        mode,
        prompt: gen.prompt,
        warning: edited.detail,
      });
    }

    // upscale / enhance-quality
    const brief = craftCreativeBrief(
      userPrompt ||
        "Same image composition and subject, ultra sharp 4K detail, refined lighting, premium finish",
      "general",
    );
    const hd = await openaiGenerateHd({
      prompt: brief,
      kind: "general",
      aspect: aspect ?? "1:1",
      quality: "hd",
      signal: request.signal,
    });
    if (hd.ok) {
      return NextResponse.json({
        url: hd.url,
        provider: hd.provider,
        mode,
        prompt: brief,
        width: hd.width,
        height: hd.height,
      });
    }
    const gen = await runImageGeneration({
      prompt: brief,
      quality: "hd",
      aspect: aspect ?? "1:1",
      signal: request.signal,
    });
    if (!gen.ok) {
      return NextResponse.json(
        { error: { message: hd.detail || gen.detail } },
        { status: 502 },
      );
    }
    return NextResponse.json({
      url: gen.url,
      provider: gen.provider,
      mode,
      prompt: gen.prompt,
      warning: hd.detail,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          message: e instanceof Error ? e.message : "Transform failed",
        },
      },
      { status: 502 },
    );
  }
}
