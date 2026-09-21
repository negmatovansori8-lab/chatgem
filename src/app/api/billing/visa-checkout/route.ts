import { NextResponse } from "next/server";

/**
 * Legacy card-form endpoint — disabled.
 * Real money requires Stripe Checkout (/api/billing/checkout).
 * Collecting raw PAN and "activating Pro" without a PSP is not a real payment.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: "USE_STRIPE_CHECKOUT",
        message:
          "Пул аз карта танҳо тавассути Stripe гирифта мешавад. Рақами картаро дар сайт нигоҳ намедорем. Аз /app/billing тугмаи Pro-ро пахш кунед — ба Stripe меравед.",
      },
    },
    { status: 410 },
  );
}
