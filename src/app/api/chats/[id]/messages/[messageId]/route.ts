import { NextResponse } from "next/server";
import { z } from "zod";
import { chatRepository } from "@/repositories/chat-repository";
import { getRequestUserId } from "@/server/session";

const schema = z.object({
  content: z.string().min(1).max(8000),
});

/**
 * Replace a map reply with the real result the embedded map found
 * (places, route, errors). Only messages written by the maps assistant.
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id: chatId, messageId } = await ctx.params;
  const userId = await getRequestUserId(request);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid message" } }, { status: 400 });
  }
  const message = await chatRepository.updateAssistantMessage(
    userId,
    chatId,
    messageId,
    "maps",
    parsed.data.content,
  );
  if (!message) {
    return NextResponse.json({ error: { message: "Message not found" } }, { status: 404 });
  }
  return NextResponse.json({ message });
}
