import { NextResponse } from "next/server";
import { agentRepository } from "@/repositories/agent-repository";
import { getRequestUserId } from "@/server/session";
import { agentRunSchema } from "@/types/agents";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const agent = await agentRepository.get(userId, id);
  if (!agent) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Agent not found" } },
      { status: 404 },
    );
  }
  const runs = await agentRepository.listRuns(userId, id);
  return NextResponse.json({ agent, runs });
}

export async function POST(request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = agentRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }
  const run = await agentRepository.createRun(userId, id, parsed.data.input);
  if (!run) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Agent not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ run }, { status: 201 });
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const ok = await agentRepository.remove(userId, id);
  if (!ok) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Agent not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
