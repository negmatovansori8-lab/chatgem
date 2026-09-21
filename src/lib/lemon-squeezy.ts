import { appUrl } from "@/lib/stripe";
import type { PlanId } from "@/types/business";

export function isLemonConfigured() {
  return Boolean(
    process.env.LEMON_SQUEEZY_API_KEY?.trim() &&
      process.env.LEMON_SQUEEZY_STORE_ID?.trim() &&
      process.env.LEMON_SQUEEZY_VARIANT_PRO?.trim() &&
      process.env.LEMON_SQUEEZY_VARIANT_BUSINESS?.trim(),
  );
}

export function isPaymentsConfigured() {
  return (
    Boolean(process.env.STRIPE_SECRET_KEY?.trim()) || isLemonConfigured()
  );
}

function variantIdFor(planId: Extract<PlanId, "pro" | "business">) {
  if (planId === "business") {
    return process.env.LEMON_SQUEEZY_VARIANT_BUSINESS!.trim();
  }
  return process.env.LEMON_SQUEEZY_VARIANT_PRO!.trim();
}

export async function createLemonCheckout(opts: {
  planId: Extract<PlanId, "pro" | "business">;
  userId: string;
  email?: string;
}): Promise<{ url: string; checkoutId: string }> {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY!.trim();
  const storeId = process.env.LEMON_SQUEEZY_STORE_ID!.trim();
  const variantId = variantIdFor(opts.planId);
  const base = appUrl();

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: opts.email || undefined,
            custom: {
              user_id: opts.userId,
              plan_id: opts.planId,
            },
          },
          product_options: {
            redirect_url: `${base}/app/billing?paid=1&provider=lemon&plan=${opts.planId}`,
          },
          checkout_options: {
            embed: false,
            media: false,
            logo: true,
          },
        },
        relationships: {
          store: {
            data: { type: "stores", id: storeId },
          },
          variant: {
            data: { type: "variants", id: variantId },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lemon Squeezy checkout failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    data?: { id?: string; attributes?: { url?: string } };
  };
  const url = json.data?.attributes?.url;
  const checkoutId = json.data?.id;
  if (!url || !checkoutId) {
    throw new Error("Lemon Squeezy did not return a checkout URL.");
  }
  return { url, checkoutId };
}
