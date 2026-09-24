"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function MarketingNavbar() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--landing-line)] bg-[#eef1f4]/85 backdrop-blur-xl">
      <div className="relative mx-auto flex h-14 max-w-6xl items-center px-4 sm:h-16 sm:px-6">
        <Logo showWordmark />

        {/* Center: Sign in only */}
        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <Link
            href="/login"
            className="pointer-events-auto inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--landing-ink,#070b12)] px-5 text-sm font-semibold text-white transition hover:bg-[#141c2c]"
          >
            {t("nav.signin")}
          </Link>
        </div>

        <nav className="ms-auto hidden items-center gap-1 md:flex" aria-label="Primary">
          <LanguageSwitcher />
        </nav>
        <div className="ms-auto flex items-center gap-1 md:hidden">
          <LanguageSwitcher compact />
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl text-[var(--landing-fg,#0b1220)] transition hover:bg-black/5"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <div
        className={cn(
          "border-t border-[var(--landing-line,rgba(11,18,32,0.08))] md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3">
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--landing-ink,#070b12)] text-sm font-semibold text-white"
          >
            {t("nav.signin")}
          </Link>
        </div>
      </div>
    </header>
  );
}
