import { NextResponse } from "next/server";
import { agentRepository } from "@/repositories/agent-repository";
import { getRequestUserId } from "@/server/session";
import { agentCreateSchema } from "@/types/agents";

export async function GET() {
  const userId = await getRequestUserId();
  const agents = await agentRepository.list(userId);
  return NextResponse.json({ agents });
}

export async function POST(request: Request) {
  const userId = await getRequestUserId();
  const body = await request.json().catch(() => ({}));
  const parsed = agentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }
  const agent = await agentRepository.create(userId, parsed.data);
  return NextResponse.json({ agent }, { status: 201 });
}
