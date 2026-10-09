"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CreditCard, MessageSquare, Sparkles } from "lucide-react";
import { AppBackButton } from "@/components/layout/app-back-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/locale-provider";
import { HttpError, jsonInit, requestJson } from "@/lib/http";
import { cn } from "@/lib/utils";
import type { PlanDefinition, PlanId, SubscriptionRecord } from "@/types/business";

type SubscriptionsResponse = {
  plans?: PlanDefinition[];
  subscription?: SubscriptionRecord | null;
  paymentsConfigured?: boolean;
};

type ConfirmResponse = { subscription?: SubscriptionRecord | null; message?: string };

const fetchSubscriptions = () => requestJson<SubscriptionsResponse>("/api/subscriptions");

function redirectNotice(params: { get(name: string): string | null }, t: (key: string) => string) {
  if (params.get("failed") === "1") return t("billing.notice.failed");
  if (params.get("canceled") === "1") return t("billing.notice.canceled");
  if (params.get("paid") === "1" && (params.get("provider") === "lemon" || !params.get("session_id"))) {
    return t("billing.notice.pending");
  }
  return null;
}

function isStripeConfirm(params: { get(name: string): string | null }) {
  return params.get("paid") === "1" && Boolean(params.get("session_id")) && params.get("provider") !== "lemon";
}

export function BillingWorkspace() {
  const { t, locale } = useI18n();
  const planFeatures = (plan: PlanDefinition): string[] => {
    const key = `billing.features.${plan.id}`;
    const text = t(key);
    return text && text !== key ? text.split("\n") : plan.features;
  };
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [paymentsConfigured, setPaymentsConfigured] = useState(false);
  const [notice, setNotice] = useState<string | null>(() => redirectNotice(searchParams, t));
  const [busy, setBusy] = useState(() => isStripeConfirm(searchParams));
  const [payPlan, setPayPlan] = useState<"pro" | "business" | null>(null);

  const apply = useCallback((data: SubscriptionsResponse) => {
    setPlans(data.plans ?? []);
    setSubscription(data.subscription ?? null);
    setPaymentsConfigured(Boolean(data.paymentsConfigured));
  }, []);

  const errorText = useCallback(
    (e: unknown, fallback = t("common.requestFailed")) =>
      e instanceof HttpError ? (e.offline ? t("common.offline") : e.message || fallback) : fallback,
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    fetchSubscriptions()
      .then((data) => {
        if (!cancelled) apply(data);
      })
      .catch((e) => {
        if (!cancelled) setNotice(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, [apply, errorText]);

  // After a payment redirect: Stripe sessions are confirmed here, Lemon activates via webhook.
  useEffect(() => {
    if (!isStripeConfirm(searchParams)) {
      if (["paid", "canceled", "failed"].some((key) => searchParams.get(key) === "1")) {
        window.history.replaceState({}, "", "/app/billing");
      }
      return;
    }

    let cancelled = false;
    requestJson<ConfirmResponse>(
      "/api/billing/confirm",
      jsonInit("POST", { sessionId: searchParams.get("session_id") }),
    )
      .then(async (data) => {
        if (cancelled) return;
        setSubscription(data.subscription ?? null);
        setNotice(data.message ?? t("billing.notice.activated"));
        apply(await fetchSubscriptions());
        window.history.replaceState({}, "", "/app/billing");
      })
      .catch((e) => {
        if (!cancelled) setNotice(errorText(e, t("billing.notice.confirmFailed")));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, apply, errorText, t]);

  async function chooseFree() {
    setNotice(null);
    try {
      const data = await requestJson<SubscriptionsResponse>("/api/subscriptions", jsonInit("POST", { planId: "free" }));
      setSubscription(data.subscription ?? null);
      setNotice(t("billing.active"));
    } catch (e) {
      setNotice(errorText(e));
    }
  }

  async function startStripeCheckout(planId: "pro" | "business") {
    setBusy(true);
    setNotice(null);
    let data: { url?: string };
    try {
      data = await requestJson<{ url?: string }>("/api/billing/checkout", jsonInit("POST", { planId }));
    } catch (e) {
      setNotice(errorText(e));
      return;
    } finally {
      setBusy(false);
    }
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    setNotice(t("billing.notice.noUrl"));
  }

  const current = (subscription?.planId ?? "free") as PlanId;
  const periodEnd = subscription?.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString(locale)
    : null;
  const price = payPlan === "business" ? 19 : 9;

  return (
    <div className="mx-auto min-h-full w-full max-w-5xl space-y-5 px-3 pb-[max(6rem,calc(env(safe-area-inset-bottom)+4rem))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center gap-2">
        <AppBackButton />
        <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold text-[var(--fg)]">
          {t("billing.title")}
        </h1>
        <Link
          href="/app/chat"
          className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
        >
          <MessageSquare className="h-4 w-4" />
          <span className="max-[359px]:sr-only">{t("chat.chatBtn")}</span>
        </Link>
      </header>

      <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          <CreditCard className="h-3.5 w-3.5" />
          Pro
        </p>
        <p className="text-sm text-[var(--fg-muted)]">
          {t("billing.current")}: <strong className="text-[var(--fg)]">{current}</strong>
          {periodEnd && current !== "free" ? (
            <>
              {" · "}
              {t("billing.proActive")} {periodEnd}
            </>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">{t("billing.subtitle")}</p>
        <p
          className={cn(
            "mt-3 rounded-[var(--radius-md)] px-3 py-2 text-[13px] leading-relaxed",
            paymentsConfigured
              ? "bg-[var(--accent-muted)] text-[var(--accent-2)]"
              : "bg-[var(--surface-2)] text-[var(--fg-muted)]",
          )}
        >
          {paymentsConfigured ? t("billing.paymentsOn") : t("billing.paymentsOff")}
        </p>
      </section>

      {notice ? (
        <div
          role="alert"
          className="rounded-[var(--radius-lg)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--fg)]"
        >
          {notice}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const active = current === plan.id;
          return (
            <article
              key={plan.id}
              className={`flex flex-col rounded-[1.5rem] bg-[var(--surface)] p-5 ${
                active ? "ring-2 ring-[var(--accent)]" : ""
              }`}
            >
              <h2 className="text-xl font-bold text-[var(--fg)]">{plan.name}</h2>
              <p className="mt-2 text-3xl font-bold text-[var(--fg)]">
                ${plan.priceMonthly}
                <span className="text-sm font-medium text-[var(--fg-subtle)]">
                  {t("billing.month")}
                </span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--fg-muted)]">
                {planFeatures(plan).map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.id === "free" ? (
                <Button
                  type="button"
                  className="mt-5 rounded-full"
                  variant={active ? "secondary" : "primary"}
                  disabled={active}
                  onClick={() => void chooseFree()}
                >
                  {active ? t("billing.active") : t("billing.chooseFree")}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="mt-5 rounded-full"
                  onClick={() => setPayPlan(plan.id as "pro" | "business")}
                >
                  <Sparkles className="h-4 w-4" />
                  {plan.id === "pro" ? t("billing.proCta") : t("billing.buyBusiness")}
                </Button>
              )}
            </article>
          );
        })}
      </div>

      {payPlan ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visa-checkout-title"
          onClick={() => {
            if (!busy) setPayPlan(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] space-y-4 rounded-t-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[var(--fg)] shadow-[var(--shadow-lg)] sm:rounded-[1.75rem] sm:p-6"
          >
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-[#1a1f71] px-2.5 py-1 text-[11px] font-bold tracking-[0.12em] text-white">
                VISA
              </div>
              <h3 id="visa-checkout-title" className="text-[17px] font-semibold leading-snug">
                {payPlan === "pro" ? t("billing.visaTitle") : t("billing.businessTitle")}
              </h3>
            </div>

            <p className="text-[13px] leading-relaxed text-[var(--fg-muted)]">
              {t("billing.checkoutNote").replace("{price}", String(price))}
            </p>

            {!paymentsConfigured ? (
              <p className="rounded-[var(--radius-md)] bg-[var(--surface-2)] px-4 py-3 text-[13px] text-[var(--fg-muted)]">
                {t("billing.checkoutOff")}
              </p>
            ) : null}

            <div className="flex gap-2.5 pt-1">
              <Button
                type="button"
                size="lg"
                className="h-12 flex-1 rounded-full text-[15px]"
                disabled={busy || !paymentsConfigured}
                onClick={() => void startStripeCheckout(payPlan)}
              >
                {busy
                  ? "…"
                  : paymentsConfigured
                    ? t("billing.payAmount").replace("{price}", String(price))
                    : t("billing.unavailable")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="h-12 rounded-full px-5"
                disabled={busy}
                onClick={() => setPayPlan(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
