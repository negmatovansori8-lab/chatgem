"use client";

import { motion } from "framer-motion";
import { Globe2, ImageIcon, Puzzle, Sparkles } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";

const items = [
  { icon: Sparkles, titleKey: "landing.f1.title", bodyKey: "landing.f1.body" },
  { icon: Globe2, titleKey: "landing.f2.title", bodyKey: "landing.f2.body" },
  { icon: ImageIcon, titleKey: "landing.f3.title", bodyKey: "landing.f3.body" },
  { icon: Puzzle, titleKey: "landing.f4.title", bodyKey: "landing.f4.body" },
] as const;

export function FeaturesSection() {
  const { t } = useI18n();

  return (
    <section id="capabilities" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-2xl text-center"
      >
        <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {t("landing.features.title")}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/50 sm:text-base">
          {t("landing.features.subtitle")}
        </p>
      </motion.div>

      <div className="mt-14 grid gap-10 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-12 lg:grid-cols-4 lg:gap-8">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.article
              key={item.titleKey}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.06, duration: 0.45 }}
              className="text-left"
            >
              <Icon className="h-5 w-5 text-[#60a5fa]" strokeWidth={1.75} aria-hidden />
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-white">
                {t(item.titleKey)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/45">
                {t(item.bodyKey)}
              </p>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
