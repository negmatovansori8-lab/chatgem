"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CreditCard, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/locale-provider";
import type { PlanDefinition, PlanId, SubscriptionRecord } from "@/types/business";

export function BillingWorkspace() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [paymentsConfigured, setPaymentsConfigured] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payPlan, setPayPlan] = useState<"pro" | "business" | null>(null);

  async function refresh() {
    const res = await fetch("/api/subscriptions");
    const data = await res.json();
    setPlans(data.plans ?? []);
    setSubscription(data.subscription ?? null);
    setPaymentsConfigured(Boolean(data.paymentsConfigured));
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/subscriptions");
      const data = await res.json();
      if (cancelled) return;
      setPlans(data.plans ?? []);
      setSubscription(data.subscription ?? null);
      setPaymentsConfigured(Boolean(data.paymentsConfigured));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // After Stripe redirect — confirm paid session with Stripe (real money only).
  useEffect(() => {
    const paid = searchParams.get("paid");
    const sessionId = searchParams.get("session_id");
    if (paid !== "1" || !sessionId) return;

    let cancelled = false;
    void (async () => {
      setBusy(true);
      const res = await fetch("/api/billing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (cancelled) return;
      setBusy(false);
      if (!res.ok) {
        setNotice(
          data.error?.message ??
            "Пардохт тасдиқ нашуд. Агар дар карта маблағ набошад — пул гирифта намешавад ва Pro фаъол намешавад.",
        );
        return;
      }
      setSubscription(data.subscription ?? null);
      setNotice(data.message ?? "План активирован после реальной оплаты.");
      await refresh();
      window.history.replaceState({}, "", "/app/billing");
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("canceled") === "1") {
      setNotice(
        "Пардохт нагузашт. Агар дар карта маблағ набошад ё пардохт рад шавад — пул гирифта намешавад ва Pro фаъол намешавад. Лутфан картаи дигарро санҷед ё ба ҳисоб пул гузоред.",
      );
      window.history.replaceState({}, "", "/app/billing");
    }
    if (searchParams.get("failed") === "1") {
      setNotice(
        "Хатогии пардохт: карта рад шуд (маблағи нокифоя ё маҳдудият). Ҳеҷ маблағе аз ҳисоби шумо гирифта нашуд. Pro фаъол нест.",
      );
      window.history.replaceState({}, "", "/app/billing");
    }
  }, [searchParams]);

  async function chooseFree() {
    setNotice(null);
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "free" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNotice(data.error?.message ?? "Ошибка");
      return;
    }
    setSubscription(data.subscription ?? null);
    setNotice("Бесплатный план активен.");
  }

  async function startStripeCheckout(planId: "pro" | "business") {
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error?.message ?? "Не удалось начать оплату.");
      return;
    }
    if (data.url) {
      window.location.href = data.url as string;
      return;
    }
    setNotice("Stripe не вернул ссылку оплаты.");
  }

  const current = (subscription?.planId ?? "free") as PlanId;
  const periodEnd = subscription?.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString("ru-RU")
    : null;
  const price = payPlan === "business" ? 19 : 9;

  return (
    <div className="mx-auto min-h-full max-w-5xl space-y-6 px-4 py-6 pb-24 sm:px-6">
      <header className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--fg)] transition hover:bg-[var(--surface-2)]"
          aria-label={t("common.back")}
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            <CreditCard className="h-3.5 w-3.5" />
            Pro
          </p>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">
            {t("billing.title")}
          </h1>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            {t("billing.current")}: <strong className="text-[var(--fg)]">{current}</strong>
            {periodEnd && current !== "free" ? (
              <>
                {" · "}
                {t("billing.proActive")} {periodEnd}
              </>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t("billing.subtitle")}</p>
          {!paymentsConfigured ? (
            <p className="mt-2 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-200">
              Пардохти воқеӣ ҳоло хомӯш аст. Бе{" "}
              <strong className="text-white">STRIPE_SECRET_KEY</strong> пул аз карта гирифта
              намешавад ва ба ҳисоби шумо намеояд.
            </p>
          ) : (
            <p className="mt-2 text-sm text-emerald-400/90">
              Stripe пайваст аст — пардохт воқеӣ ($ ба ҳисоби Stripe / бонк).
            </p>
          )}
        </div>
        <Link href="/app/chat">
          <Button className="rounded-full">
            <MessageSquare className="h-4 w-4" />
            {t("chat.chatBtn")}
          </Button>
        </Link>
      </header>

      {notice ? (
        <div
          role="alert"
          className="rounded-[1.25rem] border border-amber-500/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-50"
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
                {plan.features.map((feature) => (
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visa-checkout-title"
          onClick={() => {
            if (!busy) setPayPlan(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] space-y-4 rounded-[1.75rem] bg-[#1a1a1a] p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-[#2563eb] px-2.5 py-1 text-[11px] font-bold tracking-[0.12em] text-white">
                VISA
              </div>
              <h3
                id="visa-checkout-title"
                className="text-[17px] font-semibold leading-snug text-white"
              >
                {payPlan === "pro"
                  ? t("billing.visaTitle")
                  : "Оплата Visa — Business на 1 месяц"}
              </h3>
            </div>

            <p className="text-[13px] leading-relaxed text-[#a3a3a3]">
              ${price} · 1 месяц. Оплата идёт через{" "}
              <strong className="text-white">Stripe</strong> (Visa / Mastercard). Номер карты в
              ChatGem не сохраняется — деньги списывает Stripe и зачисляет на ваш Stripe-счёт /
              банк.
            </p>

            {!paymentsConfigured ? (
              <p className="rounded-2xl bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100">
                Ҳоло кор намекунад, чунки Stripe калид нест. Дар{" "}
                <code className="text-white">.env</code> гузоред:{" "}
                <code className="text-white">STRIPE_SECRET_KEY=sk_live_...</code> ва серверро аз нав
                оғоз кунед. Сипас пул аз харидор ба ҳисоби Stripe-и шумо меояд.
              </p>
            ) : null}

            <div className="flex gap-2.5 pt-1">
              <Button
                type="button"
                className="h-12 flex-1 rounded-full bg-[#3b82f6] text-[15px] shadow-none hover:bg-[#2563eb]"
                disabled={busy || !paymentsConfigured}
                onClick={() => void startStripeCheckout(payPlan)}
              >
                {busy
                  ? "…"
                  : paymentsConfigured
                    ? t("billing.payAmount").replace("{price}", String(price))
                    : t("billing.stripeFirst")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-12 rounded-full border-0 bg-[#2f2f2f] px-5 text-white hover:bg-[#3a3a3a]"
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
