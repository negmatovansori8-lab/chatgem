import { NextResponse } from "next/server";
import { clearSessionUser, getSessionUser } from "@/server/auth/session";
import { subscriptionRepository } from "@/repositories/subscription-repository";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  const subscription = await subscriptionRepository.get(user.id);
  return NextResponse.json({
    user: { ...user, planId: subscription.planId, role: user.role },
  });
}

export async function DELETE() {
  await clearSessionUser();
  return NextResponse.json({ ok: true });
}
