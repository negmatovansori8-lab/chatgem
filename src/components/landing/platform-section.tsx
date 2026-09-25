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

export function PlatformSection() {
  const { t } = useI18n();

  return (
    <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.6rem,3.5vw,2.35rem)] font-bold tracking-tight text-[var(--landing-ink,#070b12)]">
          {t("landing.features.title")}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--landing-muted,#5b6577)]">
          {t("landing.features.subtitle")}
        </p>
      </div>

      <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div key={mod.titleKey}>
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
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[var(--landing-ink,#070b12)]/5 text-[var(--landing-accent,#0f766e)] transition group-hover:bg-[var(--landing-accent,#0f766e)]/15">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-[var(--landing-ink,#070b12)]">
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
