"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { plans } from "@/config/site";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function PricingSection() {
  const { t } = useI18n();

  return (
    <section id="pricing" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-2xl text-center"
      >
        <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {t("landing.pricing.title")}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/50 sm:text-base">
          {t("landing.pricing.subtitle")}
        </p>
      </motion.div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3 lg:gap-5">
        {plans.map((plan, index) => {
          const href =
            plan.id === "free" ? "/login" : plan.id === "pro" ? "/app/billing" : "/register";
          const cta =
            plan.id === "free"
              ? t("nav.signin")
              : plan.id === "pro"
                ? t("billing.proCta")
                : t("auth.register.cta");

          return (
            <motion.article
              key={plan.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className={cn(
                "relative flex flex-col rounded-3xl border p-6 sm:p-7",
                plan.highlighted
                  ? "border-[#3b82f6]/50 bg-gradient-to-b from-[#3b82f6]/15 to-transparent"
                  : "border-white/8 bg-white/[0.03]",
              )}
            >
              {plan.highlighted ? (
                <span className="absolute -top-3 start-6 rounded-full bg-[#3b82f6] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  {t("landing.pricing.popular")}
                </span>
              ) : null}
              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <p className="mt-2 text-sm text-white/45">{plan.description}</p>
              <p className="mt-6 flex items-end gap-1">
                <span className="font-display text-4xl font-bold text-white">
                  ${plan.price}
                </span>
                <span className="pb-1 text-sm text-white/35">/{plan.period}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-white/55">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#60a5fa]" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={href}
                className={cn(
                  "mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition",
                  plan.highlighted
                    ? "bg-white text-black hover:bg-white/90"
                    : "border border-white/12 bg-white/5 text-white hover:bg-white/10",
                )}
              >
                {cta}
              </Link>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
