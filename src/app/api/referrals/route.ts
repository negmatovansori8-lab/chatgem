import { NextResponse } from "next/server";
import { referralRepository } from "@/repositories/business-analytics";
import { getRequestUserId } from "@/server/session";

export async function GET() {
  const userId = await getRequestUserId();
  const referral = await referralRepository.getOrCreate(userId);
  return NextResponse.json({ referral });
}

export async function POST() {
  const userId = await getRequestUserId();
  const referral = await referralRepository.trackInvite(userId);
  return NextResponse.json({ referral });
}
