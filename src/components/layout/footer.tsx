"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/config/site";
import { useI18n } from "@/components/i18n/locale-provider";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-white/8 bg-[#03050a]">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="max-w-sm">
          <Logo showWordmark />
          <p className="mt-3 text-sm leading-relaxed text-white/40">
            {t("landing.footer.tagline")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/45">
          <Link href="/login" className="transition hover:text-white">
            {t("nav.signin")}
          </Link>
          <Link href="/app/chat" className="transition hover:text-white">
            {t("hero.ctaSecondary")}
          </Link>
        </div>
        <p className="text-xs text-white/30 sm:ms-auto">
          © {new Date().getFullYear()} {brand.shortName}
        </p>
      </div>
    </footer>
  );
}
