import { NextResponse } from "next/server";
import { knowledgeRepository } from "@/repositories/knowledge-repository";
import { getRequestUserId } from "@/server/session";
import { knowledgeCreateSchema } from "@/types/knowledge";

export async function GET() {
  const userId = await getRequestUserId();
  const bases = await knowledgeRepository.listBases(userId);
  return NextResponse.json({ knowledgeBases: bases });
}

export async function POST(request: Request) {
  const userId = await getRequestUserId();
  const body = await request.json().catch(() => ({}));
  const parsed = knowledgeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }
  const base = await knowledgeRepository.createBase(userId, parsed.data);
  return NextResponse.json({ knowledgeBase: base }, { status: 201 });
}
