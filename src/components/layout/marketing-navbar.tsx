"use client";

import { useI18n } from "@/components/i18n/locale-provider";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { cn } from "@/lib/utils";

const QUICK_LANGS = [
  { code: "tg", label: "Тоҷикӣ", short: "ТҶ" },
  { code: "ru", label: "Русский", short: "РУ" },
  { code: "en", label: "English", short: "EN" },
] as const;

/** Landing header — languages only (login lives in the hero CTA). */
export function MarketingNavbar() {
  const { locale, setLocale } = useI18n();

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#05070c]/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
        <div className="min-w-0 shrink">
          <Logo href="/" size="sm" showWordmark />
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-0.5 rounded-full border border-white/12 bg-white/5 p-0.5 backdrop-blur-sm sm:gap-1 sm:p-1">
            {QUICK_LANGS.map((lang) => {
              const active = locale === lang.code || locale.startsWith(`${lang.code}-`);
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLocale(lang.code)}
                  className={cn(
                    "grid h-9 min-w-9 shrink-0 place-items-center rounded-full px-2.5 text-[12px] font-semibold transition sm:px-3.5 sm:text-[13px]",
                    active
                      ? "bg-white text-[#05070c]"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                  aria-pressed={active}
                  aria-label={lang.label}
                >
                  <span className="sm:hidden">{lang.short}</span>
                  <span className="hidden sm:inline">{lang.label}</span>
                </button>
              );
            })}
          </div>
          <LanguageSwitcher compact />
        </div>
      </div>
    </header>
  );
}
