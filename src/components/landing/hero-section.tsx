"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";

export function HeroSection() {
  const { t } = useI18n();

  return (
    <section className="relative isolate min-h-[min(100dvh,920px)] overflow-hidden">
      {/* Full-bleed atmospheric plane — the hero visual */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 90% 70% at 18% 20%, rgba(15,118,110,0.28), transparent 55%),
              radial-gradient(ellipse 70% 60% at 88% 12%, rgba(14,165,233,0.18), transparent 50%),
              radial-gradient(ellipse 80% 50% at 50% 100%, rgba(11,18,32,0.12), transparent 55%),
              linear-gradient(165deg, #dfe8ee 0%, #eef1f4 42%, #e7ebe8 100%)
            `,
          }}
        />
        <motion.div
          className="absolute -left-[20%] top-[-10%] h-[70vmin] w-[70vmin] rounded-full opacity-50"
          style={{
            background:
              "radial-gradient(circle, rgba(15,118,110,0.35) 0%, transparent 68%)",
            filter: "blur(8px)",
          }}
          animate={{ x: [0, 40, 0], y: [0, 24, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-[15%] bottom-[-5%] h-[55vmin] w-[55vmin] rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.28) 0%, transparent 70%)",
            filter: "blur(10px)",
          }}
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E\")",
            mixBlendMode: "soft-light",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[min(100dvh,920px)] max-w-6xl flex-col justify-center px-4 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
        <div className="mx-auto w-full max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="font-[family-name:var(--font-display)] text-[clamp(3.4rem,14vw,7.5rem)] font-bold leading-[0.88] tracking-[-0.055em] text-[var(--landing-ink)]"
          >
            ChatGem
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-6 max-w-xl text-[clamp(1.25rem,3.2vw,1.85rem)] font-medium leading-[1.25] tracking-tight text-[var(--landing-fg)]"
          >
            {t("hero.title")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
            className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--landing-muted)] sm:text-base"
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.5 }}
            className="mt-9 flex justify-center"
          >
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--landing-ink)] px-8 text-[15px] font-semibold text-white transition hover:bg-[#141c2c] active:scale-[0.98]"
            >
              {t("nav.signin")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
