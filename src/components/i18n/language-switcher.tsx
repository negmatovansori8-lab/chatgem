"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Languages, Search, X } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

const PINNED = ["tg", "ru", "uz", "en", "fa", "ar", "zh", "tr", "hi", "ky", "kk", "de", "fr", "es"];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, languages, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 72, left: 16 });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function check() {
      setIsMobile(window.matchMedia("(max-width: 767px)").matches);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    function place() {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(340, window.innerWidth - 24);
      let left = r.right - width;
      if (left < 12) left = 12;
      if (left + width > window.innerWidth - 12) {
        left = window.innerWidth - width - 12;
      }
      let top = r.bottom + 8;
      const maxH = Math.min(420, window.innerHeight - 24);
      if (top + maxH > window.innerHeight - 12) {
        top = Math.max(12, r.top - maxH - 8);
      }
      setPos({ top, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const prev = document.body.style.overflow;
    if (isMobile) document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  const ordered = useMemo(() => {
    const pin = PINNED.map((c) => languages.find((l) => l.code === c)).filter(
      Boolean,
    ) as typeof languages;
    const pinSet = new Set(PINNED);
    const rest = languages.filter((l) => !pinSet.has(l.code));
    return [...pin, ...rest];
  }, [languages]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (l) =>
        l.code.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        l.native.toLowerCase().includes(q),
    );
  }, [ordered, query]);

  const current = languages.find((l) => l.code === locale);

  const panel =
    open && mounted
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[80] bg-black/55"
              aria-label="Close"
              onClick={() => setOpen(false)}
            />
            <div
              className={cn(
                "fixed z-[90] flex flex-col overflow-hidden border-white/10 bg-[#1a1a1a] shadow-2xl",
                isMobile
                  ? "inset-x-0 bottom-0 max-h-[min(78dvh,560px)] rounded-t-3xl border-t pb-[env(safe-area-inset-bottom)]"
                  : "max-h-[min(420px,calc(100vh-24px))] w-[min(92vw,340px)] rounded-2xl border",
              )}
              style={isMobile ? undefined : { top: pos.top, left: pos.left }}
              role="dialog"
              aria-label={t("lang.title")}
            >
              {isMobile ? (
                <div className="flex justify-center pb-1 pt-2">
                  <div className="h-1 w-10 rounded-full bg-white/25" />
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">{t("lang.title")}</p>
                  <p className="text-[11px] text-white/45">{t("lang.hint")}</p>
                </div>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-full text-white/50 hover:bg-white/10"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="border-b border-white/10 px-3 py-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("lang.search")}
                    className="w-full rounded-xl bg-white/5 py-3 ps-9 pe-3 text-base text-white outline-none placeholder:text-white/35 md:py-2.5 md:text-sm"
                    autoFocus={!isMobile}
                  />
                </div>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2" role="listbox">
                {!query.trim() ? (
                  <li className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-white/35">
                    {t("lang.popular")}
                  </li>
                ) : null}
                {filtered.map((lang, i) => {
                  const active = lang.code === locale;
                  const showDivider =
                    !query.trim() && i === PINNED.length - 1 && filtered.length > PINNED.length;
                  return (
                    <li key={lang.code}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={cn(
                          "flex min-h-12 w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-[15px] text-white/85 hover:bg-white/8 active:bg-white/10",
                          active && "bg-blue-500/15 text-blue-300",
                        )}
                        onClick={() => {
                          setLocale(lang.code);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{lang.native}</span>
                          <span className="block truncate text-[11px] text-white/40">
                            {lang.name} · {lang.code}
                          </span>
                        </span>
                        {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                      </button>
                      {showDivider ? (
                        <div className="my-2 border-t border-white/10" />
                      ) : null}
                    </li>
                  );
                })}
                {filtered.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-white/40">—</li>
                ) : null}
              </ul>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-label={t("nav.language")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full text-white/90 transition hover:bg-white/10",
          compact ? "h-9 px-2.5" : "h-10 px-3",
        )}
      >
        <Languages className="h-4 w-4 shrink-0 opacity-80" />
        <span className="max-w-[110px] truncate text-[13px] font-medium">
          {current?.native ?? locale}
        </span>
      </button>
      {panel}
    </div>
  );
}
