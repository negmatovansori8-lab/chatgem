"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/config/site";
import { useI18n } from "@/components/i18n/locale-provider";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-[var(--landing-line,rgba(11,18,32,0.08))] bg-[var(--landing-bg,#eef1f4)]">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-12 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-sm">
          <Logo showWordmark />
          <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted,#5b6577)]">
            {t("landing.footer.tagline")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--landing-muted,#5b6577)]">
          <Link
            href="/login"
            className="transition hover:text-[var(--landing-fg,#0b1220)]"
          >
            {t("nav.signin")}
          </Link>
          <Link
            href="/register"
            className="transition hover:text-[var(--landing-fg,#0b1220)]"
          >
            {t("auth.register.cta")}
          </Link>
        </div>
        <p className="text-xs text-[var(--landing-muted,#5b6577)] sm:ms-auto">
          © {new Date().getFullYear()} {brand.name}
        </p>
      </div>
    </footer>
  );
}
