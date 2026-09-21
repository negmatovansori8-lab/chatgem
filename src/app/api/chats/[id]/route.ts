import { NextResponse } from "next/server";
import { chatRepository } from "@/repositories/chat-repository";
import { getRequestUserId } from "@/server/session";
import { updateChatSchema } from "@/types/chat";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const result = await chatRepository.get(userId, id);
  if (!result) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Chat not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json(result);
}

export async function PATCH(request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }
  const chat = await chatRepository.update(userId, id, parsed.data);
  if (!chat) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Chat not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ chat });
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const ok = await chatRepository.remove(userId, id);
  if (!ok) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Chat not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
