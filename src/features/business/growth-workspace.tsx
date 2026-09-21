"use client";

import { useEffect, useState } from "react";
import { BarChart3, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalyticsSnapshot, ReferralRecord } from "@/types/business";

export function GrowthWorkspace() {
  const [referral, setReferral] = useState<ReferralRecord | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [refRes, anRes] = await Promise.all([
        fetch("/api/referrals"),
        fetch("/api/analytics"),
      ]);
      const refData = await refRes.json();
      const anData = await anRes.json();
      if (cancelled) return;
      setReferral(refData.referral ?? null);
      setAnalytics(anData.analytics ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function trackInvite() {
    const res = await fetch("/api/referrals", { method: "POST" });
    const data = await res.json();
    setReferral(data.referral ?? null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--fg)]">
          Growth
        </h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Referral codes and workspace analytics.
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold">
          <Gift className="h-4 w-4 text-[var(--accent)]" />
          Referral
        </p>
        <p className="text-2xl font-bold tracking-wide text-[var(--fg)]">
          {referral?.code ?? "…"}
        </p>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Invites: {referral?.invites ?? 0} · Conversions: {referral?.conversions ?? 0}
        </p>
        <Button className="mt-4" type="button" onClick={() => void trackInvite()}>
          Record invite share
        </Button>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="mb-4 inline-flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="h-4 w-4 text-[var(--accent)]" />
          Analytics ({analytics?.periodKey ?? "—"})
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Chats", analytics?.chats],
            ["Messages", analytics?.messages],
            ["Projects", analytics?.projects],
            ["Files", analytics?.files],
            ["Agents", analytics?.agents],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-[var(--bg)] p-3">
              <p className="text-xs text-[var(--fg-subtle)]">{label}</p>
              <p className="text-xl font-bold text-[var(--fg)]">{value ?? 0}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
