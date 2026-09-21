import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { subscriptionRepository } from "@/repositories/subscription-repository";

export const runtime = "nodejs";

function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Lemon Squeezy webhook — activate plan only after real paid events.
 * Configure URL: https://YOUR_DOMAIN/api/billing/lemon-webhook
 * Events: order_created, subscription_created, subscription_payment_success
 */
export async function POST(request: Request) {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "LEMON_SQUEEZY_WEBHOOK_SECRET missing" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");
  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: {
    meta?: {
      event_name?: string;
      custom_data?: Record<string, string | number | undefined>;
    };
    data?: {
      attributes?: {
        status?: string;
        card_last_four?: string | null;
      };
    };
  };

  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload.meta?.event_name ?? "";
  const paidEvents = new Set([
    "order_created",
    "subscription_created",
    "subscription_payment_success",
  ]);

  if (!paidEvents.has(event)) {
    return NextResponse.json({ received: true, skipped: event });
  }

  const custom = payload.meta?.custom_data ?? {};
  const userId = String(custom.user_id ?? custom.userId ?? "").trim();
  const planRaw = String(custom.plan_id ?? custom.planId ?? "").trim();
  const planId = planRaw === "business" ? "business" : planRaw === "pro" ? "pro" : null;

  if (!userId || !planId) {
    return NextResponse.json({
      received: true,
      skipped: "missing custom_data user_id/plan_id",
    });
  }

  const last4 = payload.data?.attributes?.card_last_four ?? "****";
  await subscriptionRepository.activatePaidMonth(userId, planId, last4);

  return NextResponse.json({ received: true, activated: planId });
}
