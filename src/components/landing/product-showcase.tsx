"use client";

import { motion } from "framer-motion";
import { ChatPreviewSection } from "@/components/landing/chat-preview";
import { useI18n } from "@/components/i18n/locale-provider";

/** Product visual below the hero — one job: show the real workspace. */
export function ProductShowcase() {
  const { t } = useI18n();

  return (
    <section className="relative border-t border-[var(--landing-line)] bg-[#0b1220] py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55 }}
          className="mb-8 max-w-xl sm:mb-10"
        >
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.6rem,3.5vw,2.35rem)] font-bold tracking-tight text-white">
            {t("landing.platform.title")}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/55">
            {t("landing.platform.subtitle")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <ChatPreviewSection embedded />
        </motion.div>
      </div>
    </section>
  );
}
