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
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55 }}
        className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0a0a0c] px-6 py-14 text-center sm:px-12 sm:py-16"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.22),transparent_65%)]" />
        <div className="relative">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t("landing.cta.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] text-white/50">
            {t("landing.cta.subtitle")}
          </p>
          <Link
            href="/app/chat"
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-8 text-[15px] font-semibold text-black transition hover:bg-white/90"
          >
            {t("hero.ctaPrimary")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
