import { NextResponse } from "next/server";
import { memoryRepository } from "@/repositories/memory-repository";
import { getRequestUserId } from "@/server/session";
import { memoryUpdateSchema } from "@/types/knowledge";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = memoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }
  const memory = await memoryRepository.update(userId, id, parsed.data);
  if (!memory) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Memory not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ memory });
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const ok = await memoryRepository.remove(userId, id);
  if (!ok) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Memory not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
