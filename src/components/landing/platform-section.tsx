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
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-64 max-w-3xl bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.18),transparent_70%)]" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-3xl text-center"
      >
        <p className="text-sm font-semibold tracking-[0.2em] text-[#60a5fa]">
          {t("landing.platform.eyebrow")}
        </p>
        <h2 className="font-display mt-3 text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight text-white">
          {t("landing.platform.title")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/50 sm:text-base">
          {t("landing.platform.subtitle")}
        </p>
      </motion.div>

      <div className="relative mt-12 grid gap-px overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
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
                className="group flex h-full flex-col bg-[#0a0a0c] p-6 transition hover:bg-[#101014] sm:p-7"
              >
                <Icon
                  className="h-5 w-5 text-[#60a5fa] transition group-hover:scale-110"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <h3 className="mt-4 text-[15px] font-semibold text-white">
                  {t(mod.titleKey)}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-white/45">
                  {t(mod.bodyKey)}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#60a5fa] opacity-80 transition group-hover:opacity-100">
                  {t("landing.platform.open")}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, duration: 0.45 }}
        className="relative mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-white/40"
      >
        {t("landing.platform.note")}
      </motion.p>
    </section>
  );
}
