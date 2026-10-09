"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-mark";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/locale-provider";

const KEY = "nj_welcome_seen_v2";

export function WelcomeGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!onHome) {
      setShow(false);
      setReady(true);
      return;
    }
    const seen = window.localStorage.getItem(KEY);
    setShow(!seen);
    setReady(true);
  }, [onHome]);

  function enter() {
    window.localStorage.setItem(KEY, "1");
    setShow(false);
  }

  if (!onHome) return <>{children}</>;

  // Never block the UI with a blank flash — show welcome or children immediately.
  if (!ready) {
    return <>{children}</>;
  }

  if (!show) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#f4f4f2] text-[#0c0c0e]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 20% 10%, rgba(15,118,110,0.16), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 0%, rgba(13,148,136,0.1), transparent 50%)",
          }}
        />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-10 pt-16 text-center">
        <BrandMark tile="light" animate="intro" className="h-20 w-20 sm:h-24 sm:w-24" />
        <h1 className="mt-6 text-[clamp(2.6rem,9vw,4rem)] [--fg:#09090b]">
          <BrandWordmark />
        </h1>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#52525b] sm:text-base">
          {t("welcome.subtitle")}
        </p>

        <div className="mt-8">
          <LanguageSwitcher />
        </div>

        <button
          type="button"
          onClick={enter}
          className="mt-10 inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-[var(--radius-md)] bg-[#09090b] px-8 text-[15px] font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          {t("welcome.enter")}
        </button>

        <Link
          href="/login"
          onClick={enter}
          className="mt-4 text-sm font-medium text-[#52525b] transition hover:text-[#0c0c0e]"
        >
          {t("nav.signin")} →
        </Link>
      </div>
    </div>
  );
}
