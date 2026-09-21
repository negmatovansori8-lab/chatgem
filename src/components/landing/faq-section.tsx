"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

const FAQ_KEYS = [1, 2, 3, 4, 5, 6] as const;

export function FaqSection() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-10 text-center"
      >
        <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {t("landing.faq.title")}
        </h2>
        <p className="mt-3 text-[15px] text-white/50">{t("landing.faq.subtitle")}</p>
      </motion.div>

      <div className="space-y-2">
        {FAQ_KEYS.map((n, index) => {
          const isOpen = open === index;
          return (
            <div
              key={n}
              className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03]"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : index)}
              >
                <span className="text-sm font-semibold text-white sm:text-[15px]">
                  {t(`landing.faq.q${n}`)}
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-white/35 transition",
                    isOpen && "rotate-180 text-white/70",
                  )}
                  aria-hidden
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p className="border-t border-white/8 px-5 py-4 text-sm leading-relaxed text-white/50">
                      {t(`landing.faq.a${n}`)}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
