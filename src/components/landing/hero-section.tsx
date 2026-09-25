"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";

/**
 * Hero must stay visible even when Framer Motion / IntersectionObserver
 * fails inside Cursor Mobile Preview (opacity:0 would look like a blank white screen).
 */
export function HeroSection() {
  const { t } = useI18n();

  return (
    <section className="relative isolate min-h-[min(88dvh,820px)] overflow-hidden">
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
        <div
          className="absolute -left-[20%] top-[-10%] h-[70vmin] w-[70vmin] rounded-full opacity-50"
          style={{
            background:
              "radial-gradient(circle, rgba(15,118,110,0.35) 0%, transparent 68%)",
            filter: "blur(8px)",
          }}
        />
        <div
          className="absolute -right-[15%] bottom-[-5%] h-[55vmin] w-[55vmin] rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.28) 0%, transparent 70%)",
            filter: "blur(10px)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[min(88dvh,820px)] max-w-6xl flex-col justify-center px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-14">
        <div className="mx-auto w-full max-w-3xl text-center">
          <p className="nj-rise font-[family-name:var(--font-display)] text-[clamp(2.75rem,12vw,7.5rem)] font-bold leading-[0.9] tracking-[-0.055em] text-[var(--landing-ink)]">
            ChatGem
          </p>

          <h1 className="nj-rise nj-rise-delay-1 mx-auto mt-5 max-w-xl text-[clamp(1.2rem,3.2vw,1.85rem)] font-medium leading-[1.3] tracking-tight text-[var(--landing-fg)] sm:mt-6">
            {t("hero.title")}
          </h1>

          <p className="nj-rise nj-rise-delay-2 mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--landing-muted)] sm:text-base">
            {t("hero.subtitle")}
          </p>

          <div className="nj-rise nj-rise-delay-3 mt-8 flex justify-center sm:mt-9">
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--landing-ink)] px-8 text-[15px] font-semibold text-white transition hover:bg-[#141c2c] active:scale-[0.98]"
            >
              {t("nav.signin")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
