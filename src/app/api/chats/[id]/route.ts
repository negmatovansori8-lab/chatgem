import { NextResponse } from "next/server";
import { chatRepository } from "@/repositories/chat-repository";
import { getRequestUserId, withGuestCookie } from "@/server/session";
import { updateChatSchema } from "@/types/chat";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const userId = await getRequestUserId(request);
  const { id } = await params;
  const result = await chatRepository.get(userId, id);
  if (!result) {
    return withGuestCookie(
      NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Chat not found" }, chat: null },
        { status: 404 },
      ),
      userId,
    );
  }
  return withGuestCookie(NextResponse.json(result), userId);
}

export async function PATCH(request: Request, { params }: Params) {
  const userId = await getRequestUserId(request);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateChatSchema.safeParse(body);
  if (!parsed.success) {
    return withGuestCookie(
      NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 },
      ),
      userId,
    );
  }
  const chat = await chatRepository.update(userId, id, parsed.data);
  if (!chat) {
    return withGuestCookie(
      NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Chat not found" } },
        { status: 404 },
      ),
      userId,
    );
  }
  return withGuestCookie(NextResponse.json({ chat }), userId);
}

export async function DELETE(request: Request, { params }: Params) {
  const userId = await getRequestUserId(request);
  const { id } = await params;
  const ok = await chatRepository.remove(userId, id);
  if (!ok) {
    return withGuestCookie(
      NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Chat not found" } },
        { status: 404 },
      ),
      userId,
    );
  }
  return withGuestCookie(NextResponse.json({ ok: true }), userId);
}
