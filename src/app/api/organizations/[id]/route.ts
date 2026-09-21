import { NextResponse } from "next/server";
import { organizationRepository } from "@/repositories/organization-repository";
import { getRequestUserId } from "@/server/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await getRequestUserId();
  const { id } = await params;
  const bundle = await organizationRepository.get(userId, id);
  if (!bundle) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Organization not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json(bundle);
}
