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
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-2 md:flex" aria-label="Primary">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="rounded-full px-3 py-2 text-sm font-medium text-white/70 transition hover:text-white"
          >
            {t("nav.signin")}
          </Link>
          <Link
            href="/app/chat"
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            {t("nav.start")}
          </Link>
        </nav>
        <div className="flex items-center gap-1 md:hidden">
          <LanguageSwitcher compact />
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full text-white/80 transition hover:bg-white/5"
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
          "border-t border-white/5 md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3">
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/5 text-sm font-medium text-white"
          >
            {t("nav.signin")}
          </Link>
          <Link
            href="/app/chat"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-white text-sm font-semibold text-black"
          >
            {t("nav.start")}
          </Link>
        </div>
      </div>
    </header>
  );
}
