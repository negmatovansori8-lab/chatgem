"use client";

import { ChatPreviewSection } from "@/components/landing/chat-preview";
import { useI18n } from "@/components/i18n/locale-provider";

export function ProductShowcase() {
  const { t } = useI18n();

  return (
    <section className="relative border-t border-white/8 bg-[#070b14] py-20 sm:py-28">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 70% 20%, rgba(13,148,136,0.12), transparent 55%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 max-w-xl sm:mb-12">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,4vw,2.6rem)] font-bold tracking-tight text-white">
            {t("landing.platform.title")}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/50 sm:text-base">
            {t("landing.platform.subtitle")}
          </p>
        </div>
        <ChatPreviewSection embedded />
      </div>
    </section>
  );
}
