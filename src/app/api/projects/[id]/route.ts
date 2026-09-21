import { NextResponse } from "next/server";
import { projectRepository } from "@/repositories/project-repository";
import { getRequestUserId } from "@/server/session";
import { projectUpdateSchema } from "@/types/knowledge";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const project = await projectRepository.get(userId, id);
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ project });
}

export async function PATCH(request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = projectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }
  const project = await projectRepository.update(userId, id, parsed.data);
  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ project });
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const ok = await projectRepository.remove(userId, id);
  if (!ok) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
