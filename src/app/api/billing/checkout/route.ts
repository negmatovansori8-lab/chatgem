import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUserId } from "@/server/session";
import { appUrl, getStripe, isStripeConfigured, planAmountCents } from "@/lib/stripe";
import { createLemonCheckout, isLemonConfigured } from "@/lib/lemon-squeezy";
import { PLANS } from "@/types/business";

const bodySchema = z.object({
  planId: z.enum(["pro", "business"]),
});

/**
 * Checkout: Lemon Squeezy preferred (works for many countries incl. Tajik creators),
 * else Stripe when STRIPE_SECRET_KEY is set.
 */
export async function POST(request: Request) {
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

  if (isLemonConfigured()) {
    try {
      const checkout = await createLemonCheckout({ planId, userId });
      return NextResponse.json({
        url: checkout.url,
        checkoutId: checkout.checkoutId,
        provider: "lemon",
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: {
            code: "CHECKOUT_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Lemon Squeezy checkout failed.",
          },
        },
        { status: 502 },
      );
    }
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "PAYMENTS_NOT_CONFIGURED",
          message:
            "Пардохт пайваст нашудааст. Lemon Squeezy (барои Тоҷикистон) ё Stripe-ро танзим кунед.",
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

  return NextResponse.json({
    url: session.url,
    sessionId: session.id,
    provider: "stripe",
  });
}
