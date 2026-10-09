"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { brand } from "@/config/site";
import { useI18n } from "@/components/i18n/locale-provider";

/** Hero: the ChatGem globe logo (it already carries the name) over a blue glow, then the CTAs. */
export function HeroSection() {
  const { t } = useI18n();

  return (
    <section className="relative isolate min-h-[min(100dvh,900px)] overflow-hidden bg-[#03050a]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 65% 50% at 50% 38%, rgba(37,99,235,0.28), transparent 60%),
              radial-gradient(ellipse 40% 35% at 20% 75%, rgba(29,78,216,0.16), transparent 55%),
              radial-gradient(ellipse 35% 30% at 82% 20%, rgba(56,189,248,0.14), transparent 50%),
              linear-gradient(180deg, #03050a 0%, #070b14 50%, #03050a 100%)
            `,
          }}
        />
        <div
          className="nj-hero-pulse absolute left-1/2 top-[36%] h-[min(85vw,580px)] w-[min(85vw,580px)] -translate-x-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(59,130,246,0.24) 0%, transparent 70%)",
            filter: "blur(36px)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[min(100dvh,900px)] max-w-5xl flex-col items-center justify-center px-4 pb-20 pt-28 text-center sm:px-6 sm:pb-24 sm:pt-32">
        <div className="nj-hero-float relative mx-auto grid aspect-square w-[min(76vw,340px)] place-items-center">
          <div
            className="absolute inset-[-14%] rounded-full opacity-80"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, rgba(59,130,246,0.4), rgba(29,78,216,0.12) 45%, transparent 70%)",
              filter: "blur(24px)",
            }}
            aria-hidden
          />
          <BrandMark animate="intro" priority className="relative h-full w-full shadow-[0_24px_64px_-12px_rgba(37,99,235,0.55)]" />
        </div>

        <h1 className="sr-only">{brand.name}</h1>

        <p className="nj-hero-rise mt-8 max-w-md font-[family-name:var(--font-display)] text-[clamp(1.15rem,3.2vw,1.45rem)] font-semibold tracking-tight text-white/95">
          {t("hero.subtitle")}
        </p>

        <div className="nj-hero-rise-d1 mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-8 text-[15px] font-semibold text-[#03050a] shadow-[0_0_48px_-8px_rgba(59,130,246,0.55)] transition hover:bg-sky-50 active:scale-[0.98]"
          >
            {t("nav.signin")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/app/chat"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/6 px-7 text-[15px] font-medium text-white/95 backdrop-blur-md transition hover:border-white/40 hover:bg-white/12"
          >
            {t("hero.ctaSecondary")}
          </Link>
        </div>
      </div>
    </section>
  );
}
