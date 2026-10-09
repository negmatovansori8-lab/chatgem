"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/locale-provider";
import { proNudgeDue } from "@/lib/pro-nudge";

const HIDE_KEY = "nj_pro_nudge_hide";

type MeUser = {
  planId?: string;
  createdAt?: string;
  role?: string;
};

export function ProMonthNotice() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { user?: MeUser | null }) => {
        const user = data.user;
        if (!user?.createdAt) return;
        if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return;
        if (user.planId === "pro" || user.planId === "business") return;
        if (!proNudgeDue(user.createdAt)) return;
        if (sessionStorage.getItem(HIDE_KEY) === "1") return;
        if (!cancelled) setShow(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!show || pathname.startsWith("/app/billing")) return null;

  return (
    <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-lg items-center gap-3">
        <p className="min-w-0 flex-1 text-[14px] leading-snug text-[var(--fg)]">
          {t("billing.proAfterMonth")}
        </p>
        <Link
          href="/app/billing"
          className="shrink-0 rounded-full bg-[var(--fg)] px-3 py-2 text-[13px] font-semibold text-[var(--bg)]"
        >
          {t("billing.proGet")}
        </Link>
        <button
          type="button"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--fg-subtle)]"
          aria-label={t("billing.proDismiss")}
          onClick={() => {
            sessionStorage.setItem(HIDE_KEY, "1");
            setShow(false);
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
