import { NextResponse } from "next/server";
import { PLANS } from "@/types/business";
import { subscriptionRepository } from "@/repositories/subscription-repository";
import { getRequestUserId } from "@/server/session";
import { subscribeSchema } from "@/types/business";
import { featureFlags } from "@/config/site";

export async function GET() {
  const userId = await getRequestUserId();
  const subscription = await subscriptionRepository.get(userId);
  return NextResponse.json({
    plans: PLANS,
    subscription,
    paymentsConfigured: featureFlags.paymentsConfigured,
  });
}

export async function POST(request: Request) {
  const userId = await getRequestUserId();
  const body = await request.json().catch(() => ({}));
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }

  // Never fake payment confirmation.
  if (parsed.data.planId !== "free" && !featureFlags.paymentsConfigured) {
    const subscription = await subscriptionRepository.get(userId);
    return NextResponse.json(
      {
        error: {
          code: "PAYMENTS_NOT_CONFIGURED",
          message:
            "Payments are not configured. Plan preview only — no charge and no fake payment confirmation.",
        },
        subscription,
        plans: PLANS,
      },
      { status: 503 },
    );
  }

  const subscription = await subscriptionRepository.setPlan(userId, parsed.data.planId);
  return NextResponse.json({ subscription, plans: PLANS });
}
