"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreditCard, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppBackButton } from "@/components/layout/app-back-button";

type AdminPayload = {
  health: {
    status: string;
    timestamp: string;
    paymentsConfigured: boolean;
    aiConfigured: boolean;
    stripeReady: boolean;
  };
  totals: {
    chats: number;
    files: number;
    projects: number;
    agents: number;
    subscriptions: number;
  };
  currentUser: {
    userId: string;
    email: string;
    name: string;
    role: string;
    subscription: { planId: string; status: string };
  };
  note: string;
  error?: { message: string };
};

export function AdminWorkspace() {
  const [data, setData] = useState<AdminPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/admin");
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error?.message ?? "Дастрасӣ рад шуд");
        setData(null);
        return;
      }
      setError(null);
      setData(json);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex items-start gap-2">
        <AppBackButton />
        <div className="min-w-0 flex-1">
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            <Shield className="h-3.5 w-3.5" />
            Admin
          </p>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Панели админ</h1>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            {error ?? data?.note ?? "Боргирӣ…"}
          </p>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-50">
          <p>{error}</p>
          <p className="mt-2 text-xs text-amber-100/80">
            Бо почтаи админ ворид шавед, масалан{" "}
            <strong>negmatovansori8@gmail.com</strong>
          </p>
          <Link href="/login" className="mt-3 inline-block">
            <Button className="rounded-full">Ворид шудан</Button>
          </Link>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--surface)] p-5">
            <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Шумо</p>
            <p className="mt-1 text-xl font-bold text-[var(--fg)]">
              {data.currentUser.name}{" "}
              <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-semibold text-white">
                {data.currentUser.role}
              </span>
            </p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">{data.currentUser.email}</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              План: {data.currentUser.subscription.planId}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Object.entries(data.totals).map(([key, value]) => (
              <div
                key={key}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">{key}</p>
                <p className="mt-1 text-2xl font-bold text-[var(--fg)]">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--fg-muted)]">
            <p>
              Health: <strong className="text-[var(--fg)]">{data.health.status}</strong>
            </p>
            <p>AI: {data.health.aiConfigured ? "yes" : "no"}</p>
            <p>Stripe: {data.health.stripeReady ? "yes — пардохт воқеӣ" : "no — калид нест"}</p>
            <p className="mt-2 text-xs text-[var(--fg-subtle)]">{data.health.timestamp}</p>
            {!data.health.stripeReady ? (
              <p className="mt-3 rounded-xl bg-amber-500/15 px-3 py-2 text-amber-100">
                Шумо админ ҳастед, аммо пул ба ҳисоб намеояд то Stripe қайд ва{" "}
                <code className="text-white">STRIPE_SECRET_KEY</code> дар .env гузошта шавад.
              </p>
            ) : null}
            <Link href="/app/billing" className="mt-4 inline-flex">
              <Button variant="secondary" className="rounded-full">
                <CreditCard className="h-4 w-4" />
                Billing / Pro
              </Button>
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
