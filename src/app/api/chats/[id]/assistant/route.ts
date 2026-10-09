import { NextResponse } from "next/server";
import { z } from "zod";
import { chatRepository } from "@/repositories/chat-repository";
import { getRequestUserId } from "@/server/session";

const schema = z.object({
  content: z.string().min(1).max(8000),
  userContent: z.string().min(1).max(8000).optional(),
  modelId: z.string().max(120).optional(),
});

/** Persist an assistant turn after client-side image generation. */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: chatId } = await ctx.params;
  const userId = await getRequestUserId(request);
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid message" } },
      { status: 400 },
    );
  }

  const existing = await chatRepository.get(userId, chatId);
  if (!existing) {
    return NextResponse.json(
      { error: { message: "Chat not found" } },
      { status: 404 },
    );
  }

  if (parsed.data.userContent?.trim()) {
    await chatRepository.addMessage(userId, chatId, {
      role: "USER",
      content: parsed.data.userContent.trim(),
      modelId: parsed.data.modelId ?? null,
    });
  }

  const record = await chatRepository.addMessage(userId, chatId, {
    role: "ASSISTANT",
    content: parsed.data.content,
    modelId: parsed.data.modelId ?? "image",
  });

  return NextResponse.json({ message: record });
}
