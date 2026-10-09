"use client";

import Link from "next/link";
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

/** Feature strip — one job per row, no card chrome. */
export function PlatformSection() {
  const { t } = useI18n();

  return (
    <section className="relative border-t border-white/8 bg-[#05070c] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,4vw,2.6rem)] font-bold tracking-tight text-white">
            {t("landing.features.title")}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/50 sm:text-base">
            {t("landing.features.subtitle")}
          </p>
        </div>

        <ul className="mt-14 divide-y divide-white/8 border-y border-white/8">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <li key={mod.titleKey}>
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
                  className="group flex items-start gap-4 py-6 transition sm:items-center sm:gap-6 sm:py-7"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-400/10 text-teal-300 transition group-hover:bg-teal-400/20">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1 text-start">
                    <span className="block text-lg font-semibold tracking-tight text-white">
                      {t(mod.titleKey)}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-white/45 sm:text-[15px]">
                      {t(mod.bodyKey)}
                    </span>
                  </span>
                  <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-teal-300/80 transition group-hover:translate-x-0.5 group-hover:text-teal-200">
                    {t("landing.platform.open")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
