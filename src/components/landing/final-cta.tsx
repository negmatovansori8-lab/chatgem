"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";

export function FinalCtaSection() {
  const { t } = useI18n();

  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55 }}
        className="relative overflow-hidden rounded-2xl bg-[var(--landing-ink,#070b12)] px-6 py-14 sm:px-12 sm:py-16"
      >
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 70% at 20% 0%, rgba(15,118,110,0.35), transparent 55%), radial-gradient(ellipse 60% 50% at 100% 80%, rgba(14,165,233,0.15), transparent 50%)",
          }}
        />
        <div className="relative max-w-xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t("landing.cta.title")}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/55">
            {t("landing.cta.subtitle")}
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-7 text-[15px] font-semibold text-[var(--landing-ink,#070b12)] transition hover:bg-white/90"
          >
            {t("nav.signin")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
