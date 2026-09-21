import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { subscriptionRepository } from "@/repositories/subscription-repository";

export const runtime = "nodejs";

/**
 * Stripe webhook — activate plan ONLY after real successful payment.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else if (process.env.NODE_ENV !== "production") {
      // Local dev without CLI webhook secret — parse carefully (not for production).
      event = JSON.parse(rawBody) as Stripe.Event;
    } else {
      return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid" && session.status !== "complete") {
      return NextResponse.json({ received: true, skipped: true });
    }

    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;
    if (!userId || (planId !== "pro" && planId !== "business")) {
      return NextResponse.json({ received: true, skipped: "missing metadata" });
    }

    let last4: string | null = null;
    if (typeof session.payment_intent === "string") {
      try {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
          expand: ["payment_method"],
        });
        const pm = pi.payment_method;
        if (pm && typeof pm !== "string" && pm.card?.last4) {
          last4 = pm.card.last4;
        }
      } catch {
        // last4 optional
      }
    }

    await subscriptionRepository.activatePaidMonth(userId, planId, last4 ?? "****");
  }

  return NextResponse.json({ received: true });
}
