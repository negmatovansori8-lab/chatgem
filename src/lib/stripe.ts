import Stripe from "stripe";
import { PLANS, type PlanId } from "@/types/business";

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key, {
    apiVersion: "2026-08-26.dahlia",
    typescript: true,
  });
}

export function planAmountCents(planId: Extract<PlanId, "pro" | "business">) {
  const plan = PLANS.find((p) => p.id === planId);
  return Math.round((plan?.priceMonthly ?? 0) * 100);
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
