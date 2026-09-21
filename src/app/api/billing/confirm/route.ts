import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUserId } from "@/server/session";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { subscriptionRepository } from "@/repositories/subscription-repository";

const schema = z.object({
  sessionId: z.string().min(1),
});

/**
 * After redirect from Stripe success URL — verify the session was paid,
 * then activate. Safe fallback when webhook is not yet configured locally.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: { code: "PAYMENTS_NOT_CONFIGURED", message: "Stripe не настроен." } },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: { code: "PAYMENTS_NOT_CONFIGURED", message: "Stripe не настроен." } },
      { status: 503 },
    );
  }

  const userId = await getRequestUserId();
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "sessionId обязателен." } },
      { status: 400 },
    );
  }

  const session = await stripe.checkout.sessions.retrieve(parsed.data.sessionId, {
    expand: ["payment_intent.payment_method"],
  });

  if (session.metadata?.userId && session.metadata.userId !== userId) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Сессия принадлежит другому пользователю." } },
      { status: 403 },
    );
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json(
      {
        error: {
          code: "NOT_PAID",
          message:
            "Пардохт тасдиқ нашуд. Агар дар карта маблағ набошад ё банк рад кунад — пул гирифта намешавад ва Pro фаъол намешавад.",
        },
      },
      { status: 402 },
    );
  }

  const planId = session.metadata?.planId;
  if (planId !== "pro" && planId !== "business") {
    return NextResponse.json(
      { error: { code: "INVALID_PLAN", message: "План в сессии неверен." } },
      { status: 400 },
    );
  }

  let last4 = "****";
  const pi = session.payment_intent;
  if (pi && typeof pi !== "string") {
    const pm = pi.payment_method;
    if (pm && typeof pm !== "string" && pm.card?.last4) {
      last4 = pm.card.last4;
    }
  }

  const subscription = await subscriptionRepository.activatePaidMonth(userId, planId, last4);

  return NextResponse.json({
    ok: true,
    subscription,
    message: `${planId === "business" ? "Business" : "Pro"} активирован после реальной оплаты Stripe.`,
  });
}
