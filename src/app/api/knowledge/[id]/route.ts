import { NextResponse } from "next/server";
import { knowledgeRepository } from "@/repositories/knowledge-repository";
import { getRequestUserId } from "@/server/session";
import { knowledgeItemSchema } from "@/types/knowledge";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (q) {
    const items = await knowledgeRepository.search(userId, id, q);
    return NextResponse.json({ items });
  }
  const bundle = await knowledgeRepository.getBase(userId, id);
  if (!bundle) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Knowledge base not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json(bundle);
}

export async function POST(request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = knowledgeItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }
  const item = await knowledgeRepository.addItem(userId, id, parsed.data);
  if (!item) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Knowledge base not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ item }, { status: 201 });
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const ok = await knowledgeRepository.removeBase(userId, id);
  if (!ok) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Knowledge base not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
