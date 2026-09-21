"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/config/site";
import { useI18n } from "@/components/i18n/locale-provider";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-white/8 bg-[#050505]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-12 text-center sm:px-6">
        <Logo />
        <p className="max-w-sm text-sm leading-relaxed text-white/40">
          {t("landing.footer.tagline")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-white/45">
          <Link href="/login" className="transition hover:text-white">
            {t("nav.signin")}
          </Link>
          <Link href="/register" className="transition hover:text-white">
            {t("auth.register.cta")}
          </Link>
          <Link href="/app/chat" className="transition hover:text-white">
            {t("nav.start")}
          </Link>
        </div>
        <p className="text-xs text-white/25">
          © {new Date().getFullYear()} {brand.name}
        </p>
      </div>
    </footer>
  );
}
