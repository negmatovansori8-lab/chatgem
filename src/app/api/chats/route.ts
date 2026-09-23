import { NextResponse } from "next/server";
import { chatRepository } from "@/repositories/chat-repository";
import { getRequestUserId, withGuestCookie } from "@/server/session";
import { createChatSchema } from "@/types/chat";

export async function GET(request: Request) {
  const userId = await getRequestUserId(request);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const includeArchived = searchParams.get("archived") === "1";
  const chats = await chatRepository.listByUser(userId, { q, includeArchived });
  return withGuestCookie(NextResponse.json({ chats }), userId);
}

export async function POST(request: Request) {
  const userId = await getRequestUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = createChatSchema.safeParse(body);
  if (!parsed.success) {
    return withGuestCookie(
      NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 },
      ),
      userId,
    );
  }
  const chat = await chatRepository.create(userId, parsed.data);
  return withGuestCookie(NextResponse.json({ chat }, { status: 201 }), userId);
}
