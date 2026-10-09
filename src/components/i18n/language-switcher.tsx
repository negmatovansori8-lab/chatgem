"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Languages, Search, X } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { useMediaQuery, useMounted } from "@/lib/use-client-state";
import { cn } from "@/lib/utils";

const PINNED = ["tg", "ru", "uz", "en", "fa", "ar", "zh", "tr", "hi", "ky", "kk", "de", "fr", "es"];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, languages, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const mounted = useMounted();
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 72, left: 16 });
  // Phone + small tablet → bottom sheet
  const isMobile = useMediaQuery("(max-width: 1023px)");

  useEffect(() => {
    if (!open || isMobile) return;
    function place() {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(320, window.innerWidth - 24);
      let left = r.right - width;
      if (left < 12) left = 12;
      if (left + width > window.innerWidth - 12) {
        left = window.innerWidth - width - 12;
      }
      let top = r.bottom + 8;
      const maxH = Math.min(400, window.innerHeight - 24);
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
    if (!isMobile) {
      window.setTimeout(() => searchRef.current?.focus(), 50);
    }
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

  const popular = useMemo(
    () =>
      PINNED.map((c) => languages.find((l) => l.code === c)).filter(
        Boolean,
      ) as typeof languages,
    [languages],
  );

  const current = languages.find((l) => l.code === locale);

  function pick(code: string) {
    setLocale(code);
    setOpen(false);
    setQuery("");
  }

  const panel =
    open && mounted
      ? createPortal(
          <>
            <button
              type="button"
              className={cn(
                "fixed inset-0 z-[80] transition-opacity",
                isMobile ? "bg-black/50 backdrop-blur-[2px]" : "bg-black/40",
              )}
              aria-label="Close"
              onClick={() => setOpen(false)}
            />
            <div
              className={cn(
                "fixed z-[90] flex flex-col overflow-hidden bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-lg)]",
                isMobile
                  ? "inset-x-0 bottom-0 max-h-[min(88dvh,640px)] rounded-t-[1.75rem] border-t border-[var(--border)] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                  : "max-h-[min(400px,calc(100vh-24px))] w-[min(92vw,320px)] rounded-2xl border border-[var(--border)]",
              )}
              style={isMobile ? undefined : { top: pos.top, left: pos.left }}
              role="dialog"
              aria-modal
              aria-label={t("lang.title")}
            >
              {isMobile ? (
                <div className="flex shrink-0 justify-center pb-1 pt-2.5">
                  <div className="h-1 w-9 rounded-full bg-[var(--fg-subtle)]/40" />
                </div>
              ) : null}

              <div
                className={cn(
                  "flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)]",
                  isMobile ? "px-5 pb-3 pt-1" : "px-4 py-3",
                )}
              >
                <div className="min-w-0 pt-0.5">
                  <p
                    className={cn(
                      "font-semibold tracking-tight text-[var(--fg)]",
                      isMobile ? "text-[17px]" : "text-sm",
                    )}
                  >
                    {t("lang.title")}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-[var(--fg-muted)]",
                      isMobile ? "text-[13px] leading-snug" : "text-[11px]",
                    )}
                  >
                    {t("lang.hint")}
                  </p>
                </div>
                <button
                  type="button"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--fg-subtle)] transition hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>

              <div className={cn("shrink-0", isMobile ? "px-4 py-3" : "px-3 py-2")}>
                <label className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 transition focus-within:border-[var(--border-strong)] focus-within:ring-2 focus-within:ring-[var(--accent-muted)]">
                  <Search
                    className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]"
                    strokeWidth={1.75}
                  />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("lang.search")}
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)] md:text-sm"
                    enterKeyHint="search"
                  />
                  {query ? (
                    <button
                      type="button"
                      className="grid h-6 w-6 place-items-center rounded-full text-[var(--fg-subtle)] hover:bg-[var(--surface-3)]"
                      onClick={() => setQuery("")}
                      aria-label="Clear"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </label>
              </div>

              {/* Quick popular chips — phone only, when not searching */}
              {isMobile && !query.trim() ? (
                <div className="nj-lang-scroll shrink-0 overflow-x-auto px-4 pb-2">
                  <div className="flex w-max gap-2 pe-2">
                    {popular.slice(0, 8).map((lang) => {
                      const active = lang.code === locale;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => pick(lang.code)}
                          className={cn(
                            "rounded-full px-3.5 py-2 text-[13px] font-medium transition",
                            active
                              ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                              : "bg-[var(--surface-2)] text-[var(--fg-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]",
                          )}
                        >
                          {lang.native}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <ul
                className={cn(
                  "nj-lang-list min-h-0 flex-1 overflow-y-auto overscroll-contain",
                  isMobile ? "px-3 pb-2" : "p-2",
                )}
                role="listbox"
              >
                {!query.trim() ? (
                  <li className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
                    {t("lang.popular")}
                  </li>
                ) : null}
                {filtered.map((lang, i) => {
                  const active = lang.code === locale;
                  const showDivider =
                    !query.trim() &&
                    i === PINNED.length - 1 &&
                    filtered.length > PINNED.length;
                  return (
                    <li key={lang.code}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-2xl text-left transition",
                          isMobile ? "min-h-[3.25rem] px-3.5 py-3" : "min-h-11 px-3 py-2.5",
                          active
                            ? "bg-[var(--accent-muted)] text-[var(--accent-2)]"
                            : "text-[var(--fg)] hover:bg-[var(--surface-2)] active:bg-[var(--surface-3)]",
                        )}
                        onClick={() => pick(lang.code)}
                      >
                        <span className="min-w-0">
                          <span
                            className={cn(
                              "block truncate font-medium",
                              isMobile ? "text-[15px]" : "text-[14px]",
                            )}
                          >
                            {lang.native}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-[var(--fg-subtle)]">
                            {lang.name} · {lang.code}
                          </span>
                        </span>
                        {active ? (
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)]">
                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </span>
                        ) : null}
                      </button>
                      {showDivider ? (
                        <div className="mx-3 my-2 border-t border-[var(--border)]" />
                      ) : null}
                    </li>
                  );
                })}
                {filtered.length === 0 ? (
                  <li className="px-3 py-10 text-center text-sm text-[var(--fg-subtle)]">
                    —
                  </li>
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
          "inline-flex items-center gap-1.5 rounded-full border font-medium transition",
          "border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-sm)] hover:bg-[var(--surface-2)]",
          compact ? "h-9 w-9 justify-center px-0" : "h-10 px-3",
        )}
      >
        <Languages className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
        {!compact ? (
          <span className="max-w-[110px] truncate text-[13px] font-semibold tracking-tight">
            {current?.native ?? locale}
          </span>
        ) : (
          <span className="sr-only">{current?.native ?? locale}</span>
        )}
      </button>
      {panel}
    </div>
  );
}
