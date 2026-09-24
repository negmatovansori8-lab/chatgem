"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Globe2,
  ImageIcon,
  MessageSquare,
  Puzzle,
  SpellCheck,
} from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";

const DRAFT_KEY = "nj_draft_prompt";

const modules = [
  {
    href: "/app/chat",
    icon: MessageSquare,
    titleKey: "landing.platform.m1",
    bodyKey: "landing.platform.m1body",
  },
  {
    href: "/app/gallery",
    icon: ImageIcon,
    titleKey: "landing.platform.m2",
    bodyKey: "landing.platform.m2body",
  },
  {
    href: "/app/agents",
    icon: Bot,
    titleKey: "landing.platform.m3",
    bodyKey: "landing.platform.m3body",
  },
  {
    href: "/app/tools",
    icon: Puzzle,
    titleKey: "landing.platform.m4",
    bodyKey: "landing.platform.m4body",
  },
  {
    href: "/app/chat",
    icon: SpellCheck,
    titleKey: "landing.platform.m5",
    bodyKey: "landing.platform.m5body",
    draft: true,
  },
  {
    href: "/app/chat",
    icon: Globe2,
    titleKey: "landing.platform.m6",
    bodyKey: "landing.platform.m6body",
  },
] as const;

export function PlatformSection() {
  const { t } = useI18n();

  return (
    <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl"
      >
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.6rem,3.5vw,2.35rem)] font-bold tracking-tight text-[var(--landing-ink,#070b12)]">
          {t("landing.features.title")}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--landing-muted,#5b6577)]">
          {t("landing.features.subtitle")}
        </p>
      </motion.div>

      <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod, i) => {
          const Icon = mod.icon;
          return (
            <motion.div
              key={mod.titleKey}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.04, duration: 0.4 }}
            >
              <Link
                href={mod.href}
                onClick={() => {
                  if ("draft" in mod && mod.draft) {
                    try {
                      sessionStorage.setItem(
                        DRAFT_KEY,
                        t("chat.fixWritingPrompt"),
                      );
                    } catch {
                      // ignore
                    }
                  }
                }}
                className="group block"
              >
                <Icon
                  className="h-5 w-5 text-[var(--landing-accent,#0f766e)] transition group-hover:translate-x-0.5"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <h3 className="mt-4 text-[16px] font-semibold text-[var(--landing-fg,#0b1220)]">
                  {t(mod.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted,#5b6577)]">
                  {t(mod.bodyKey)}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--landing-accent,#0f766e)]">
                  {t("landing.platform.open")}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
