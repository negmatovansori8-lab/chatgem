import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUserId } from "@/server/session";
import { appUrl, getStripe, isStripeConfigured, planAmountCents } from "@/lib/stripe";
import { PLANS } from "@/types/business";

const bodySchema = z.object({
  planId: z.enum(["pro", "business"]),
});

/**
 * Creates a real Stripe Checkout Session.
 * Money is charged only by Stripe and settles to the connected Stripe account / bank.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "PAYMENTS_NOT_CONFIGURED",
          message:
            "Пардохт пайваст нашудааст. STRIPE_SECRET_KEY дар .env гузоред. Бе Stripe пул аз карта гирифта намешавад.",
        },
      },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: { code: "PAYMENTS_NOT_CONFIGURED", message: "Stripe недоступен." } },
      { status: 503 },
    );
  }

  const userId = await getRequestUserId();
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Выберите план Pro или Business." } },
      { status: 400 },
    );
  }

  const { planId } = parsed.data;
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) {
    return NextResponse.json(
      { error: { code: "UNKNOWN_PLAN", message: "Неизвестный план." } },
      { status: 400 },
    );
  }

  const amount = planAmountCents(planId);
  const base = appUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amount,
          product_data: {
            name: `ChatGem — ${plan.name}`,
            description: `${plan.name} на 1 месяц`,
          },
        },
      },
    ],
    success_url: `${base}/app/billing?paid=1&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/app/billing?canceled=1`,
    metadata: {
      userId,
      planId,
    },
    payment_intent_data: {
      metadata: {
        userId,
        planId,
      },
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: { code: "CHECKOUT_ERROR", message: "Не удалось создать сессию оплаты." } },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
