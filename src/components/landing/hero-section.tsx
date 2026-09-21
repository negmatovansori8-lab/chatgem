"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { ChatPreviewSection } from "@/components/landing/chat-preview";

export function HeroSection() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_50%_-30%,rgba(59,130,246,0.32),transparent_58%)]" />
        <div className="absolute -left-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-[#3b82f6]/15 blur-[120px]" />
        <div className="absolute -right-32 bottom-10 h-[22rem] w-[22rem] rounded-full bg-sky-400/10 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 50% 30%, black 10%, transparent 75%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col px-4 pb-6 pt-8 sm:px-6 sm:pb-8 sm:pt-12 lg:pt-14">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="font-display text-[clamp(2.5rem,9vw,5.25rem)] font-bold leading-[0.95] tracking-[-0.045em] text-white"
          >
            ChatGem
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            className="mt-2.5 text-xs font-semibold uppercase tracking-[0.35em] text-[#60a5fa] sm:text-sm"
          >
            {t("hero.eyebrow")}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.45 }}
            className="mt-5 max-w-2xl text-[clamp(1.2rem,3.6vw,1.85rem)] font-medium leading-snug tracking-tight text-white/90"
          >
            {t("hero.title")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            className="mt-3 max-w-xl text-[14px] leading-relaxed text-white/50 sm:mt-4 sm:text-[15px] sm:text-base"
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.45 }}
            className="mt-7 flex w-full max-w-md flex-col gap-3 sm:mt-8 sm:flex-row sm:justify-center"
          >
            <Link
              href="/app/chat"
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-black transition hover:bg-white/90 active:scale-[0.98] sm:flex-none sm:px-8"
            >
              {t("hero.ctaPrimary")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 text-[15px] font-semibold text-white transition hover:bg-white/10 active:scale-[0.98] sm:flex-none sm:px-8"
            >
              {t("nav.signin")}
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 w-full sm:mt-12"
        >
          <ChatPreviewSection embedded />
        </motion.div>
      </div>
    </section>
  );
}
