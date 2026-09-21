import { NextResponse } from "next/server";
import { fileRepository } from "@/repositories/file-repository";
import { getRequestUserId } from "@/server/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const file = await fileRepository.get(userId, id);
  if (!file) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "File not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ file });
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const ok = await fileRepository.remove(userId, id);
  if (!ok) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "File not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
