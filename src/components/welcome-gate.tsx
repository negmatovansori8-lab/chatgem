"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

  if (!ready) {
    return <div className="min-h-dvh bg-[#050505]" aria-hidden />;
  }

  if (!show) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,rgba(59,130,246,0.35),transparent_55%)]" />
        <div className="absolute bottom-0 left-1/2 h-[40vh] w-[80vw] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[100px]" />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-10 pt-16 text-center">
        <div className="nj-rise grid h-[4.5rem] w-[4.5rem] place-items-center rounded-[1.35rem] bg-gradient-to-br from-[#60a5fa] via-[#3b82f6] to-[#1d4ed8] shadow-[0_24px_60px_-20px_rgba(59,130,246,0.85)]">
          <span className="font-display text-3xl font-bold tracking-tight">C</span>
        </div>

        <h1 className="nj-rise nj-rise-delay-1 font-display mt-8 text-[clamp(2.4rem,8vw,3.75rem)] font-bold tracking-[-0.04em]">
          ChatGem
        </h1>
        <p className="nj-rise nj-rise-delay-2 mt-1 text-sm font-medium tracking-[0.28em] text-[#60a5fa]">
          AI
        </p>
        <p className="nj-rise nj-rise-delay-3 mt-5 max-w-md text-[15px] leading-relaxed text-white/55 sm:text-base">
          {t("welcome.subtitle")}
        </p>

        <div className="nj-rise nj-rise-delay-4 mt-8">
          <LanguageSwitcher />
        </div>

        <button
          type="button"
          onClick={enter}
          className="nj-rise nj-rise-delay-5 mt-10 inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-full bg-white px-8 text-[15px] font-semibold text-black transition hover:bg-white/90 active:scale-[0.98]"
        >
          {t("welcome.enter")}
        </button>

        <Link
          href="/login"
          onClick={enter}
          className="nj-rise nj-rise-delay-5 mt-4 text-sm text-white/40 transition hover:text-white/80"
        >
          {t("nav.signin")}
        </Link>
      </div>
    </div>
  );
}
