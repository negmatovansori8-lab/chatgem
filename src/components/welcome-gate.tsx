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
    return <div className="min-h-dvh bg-[#eef1f4]" aria-hidden />;
  }

  if (!show) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#eef1f4] text-[#0b1220]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 20% 10%, rgba(15,118,110,0.22), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 0%, rgba(14,165,233,0.14), transparent 50%)",
          }}
        />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-10 pt-16 text-center">
        <h1 className="nj-rise font-[family-name:var(--font-display)] text-[clamp(2.8rem,10vw,4.5rem)] font-bold tracking-[-0.05em] text-[#070b12]">
          ChatGem
        </h1>
        <p className="nj-rise nj-rise-delay-2 mt-5 max-w-md text-[15px] leading-relaxed text-[#5b6577] sm:text-base">
          {t("welcome.subtitle")}
        </p>

        <div className="nj-rise nj-rise-delay-3 mt-8">
          <LanguageSwitcher />
        </div>

        <button
          type="button"
          onClick={enter}
          className="nj-rise nj-rise-delay-4 mt-10 inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-xl bg-[#070b12] px-8 text-[15px] font-semibold text-white transition hover:bg-[#141c2c] active:scale-[0.98]"
        >
          {t("nav.signin")}
        </button>

        <Link
          href="/login"
          onClick={enter}
          className="nj-rise nj-rise-delay-4 mt-4 text-sm text-[#5b6577] transition hover:text-[#0b1220]"
        >
          {t("welcome.enter")}
        </Link>
      </div>
    </div>
  );
}
