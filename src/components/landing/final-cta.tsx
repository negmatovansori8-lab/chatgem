"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";

export function FinalCtaSection() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden border-t border-white/8 bg-[#05070c] px-4 py-24 sm:px-6 sm:py-32">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 100%, rgba(45,212,191,0.18), transparent 55%), radial-gradient(ellipse 40% 40% at 10% 0%, rgba(59,130,246,0.12), transparent 50%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(2rem,5vw,3.25rem)] font-bold tracking-tight text-white">
          {t("landing.cta.title")}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-white/50 sm:text-base">
          {t("landing.cta.subtitle")}
        </p>
        <Link
          href="/login"
          className="mt-10 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-8 text-[15px] font-semibold text-[#05070c] transition hover:bg-teal-50"
        >
          {t("nav.signin")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
