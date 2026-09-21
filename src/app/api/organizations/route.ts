import { NextResponse } from "next/server";
import { organizationRepository } from "@/repositories/organization-repository";
import { getRequestUserId } from "@/server/session";
import { orgCreateSchema, orgMemberSchema } from "@/types/business";

export async function GET() {
  const userId = await getRequestUserId();
  const organizations = await organizationRepository.listForUser(userId);
  return NextResponse.json({ organizations });
}

export async function POST(request: Request) {
  const userId = await getRequestUserId();
  const body = await request.json().catch(() => ({}));

  if (body?.organizationId && body?.email) {
    const parsed = orgMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 },
      );
    }
    const member = await organizationRepository.addMember(
      userId,
      String(body.organizationId),
      parsed.data.email,
      parsed.data.role,
    );
    if (!member) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Cannot invite to this organization" } },
        { status: 403 },
      );
    }
    return NextResponse.json({ member }, { status: 201 });
  }

  const parsed = orgCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }
  const organization = await organizationRepository.create(userId, parsed.data.name);
  return NextResponse.json({ organization }, { status: 201 });
}
