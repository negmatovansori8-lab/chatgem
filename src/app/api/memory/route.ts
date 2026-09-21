import { NextResponse } from "next/server";
import { memoryRepository } from "@/repositories/memory-repository";
import { getRequestUserId } from "@/server/session";
import { memoryCreateSchema } from "@/types/knowledge";

export async function GET() {
  const userId = await getRequestUserId();
  const [memories, enabled] = await Promise.all([
    memoryRepository.list(userId),
    memoryRepository.isEnabled(userId),
  ]);
  return NextResponse.json({ memories, enabled });
}

export async function POST(request: Request) {
  const userId = await getRequestUserId();
  const body = await request.json().catch(() => ({}));
  if ("enabled" in body && typeof body.enabled === "boolean" && !body.content) {
    const enabled = await memoryRepository.setEnabled(userId, body.enabled);
    return NextResponse.json({ enabled });
  }
  const parsed = memoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }
  const memory = await memoryRepository.create(userId, parsed.data);
  return NextResponse.json({ memory }, { status: 201 });
}
