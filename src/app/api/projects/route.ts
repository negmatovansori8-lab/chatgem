import { NextResponse } from "next/server";
import { projectRepository } from "@/repositories/project-repository";
import { getRequestUserId } from "@/server/session";
import { projectCreateSchema } from "@/types/knowledge";

export async function GET() {
  const userId = await getRequestUserId();
  const projects = await projectRepository.list(userId);
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const userId = await getRequestUserId();
  const body = await request.json().catch(() => ({}));
  const parsed = projectCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }
  const project = await projectRepository.create(userId, parsed.data);
  return NextResponse.json({ project }, { status: 201 });
}
