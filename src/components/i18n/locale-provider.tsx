"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { defaultLocale, isRtl, t as translate, WORLD_LOCALES } from "@/lib/i18n";

const STORAGE_KEY = "nj_locale";

type LocaleContextValue = {
  locale: string;
  dir: "ltr" | "rtl";
  setLocale: (code: string) => void;
  t: (key: string) => string;
  languages: typeof WORLD_LOCALES;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readLocale() {
  if (typeof window === "undefined") return defaultLocale;
  // Show Тоҷикӣ once if still stuck on old forced Russian default
  if (!window.localStorage.getItem("nj_locale_v4")) {
    window.localStorage.setItem("nj_locale_v4", "1");
    const prev = window.localStorage.getItem(STORAGE_KEY);
    if (!prev || prev === "ru") {
      window.localStorage.setItem(STORAGE_KEY, "tg");
      document.cookie = `nj_locale=${encodeURIComponent("tg")};path=/;max-age=31536000;samesite=lax`;
      return "tg";
    }
  }
  if (!window.localStorage.getItem("nj_locale_v3")) {
    window.localStorage.setItem("nj_locale_v3", "1");
    window.localStorage.setItem(STORAGE_KEY, "tg");
    document.cookie = `nj_locale=${encodeURIComponent("tg")};path=/;max-age=31536000;samesite=lax`;
    return "tg";
  }
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && WORLD_LOCALES.some((l) => l.code === saved)) return saved;
  const browser = navigator.language || defaultLocale;
  const exact = WORLD_LOCALES.find((l) => l.code.toLowerCase() === browser.toLowerCase());
  if (exact) return exact.code;
  const base = browser.split("-")[0];
  const partial = WORLD_LOCALES.find((l) => l.code === base);
  return partial?.code ?? defaultLocale;
}

const listeners = new Set<() => void>();
let currentLocale = defaultLocale;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return currentLocale;
}

function getServerSnapshot() {
  return defaultLocale;
}

function applyDocumentLocale(code: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = code;
  document.documentElement.dir = isRtl(code) ? "rtl" : "ltr";
}

if (typeof window !== "undefined") {
  currentLocale = readLocale();
  applyDocumentLocale(currentLocale);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLocale = useCallback((code: string) => {
    const exists = WORLD_LOCALES.some((l) => l.code === code);
    const next = exists ? code : defaultLocale;
    currentLocale = next;
    window.localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `nj_locale=${encodeURIComponent(next)};path=/;max-age=31536000;samesite=lax`;
    applyDocumentLocale(next);
    emit();
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: isRtl(locale) ? "rtl" : "ltr",
      setLocale,
      t: (key: string) => translate(key, locale),
      languages: WORLD_LOCALES,
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: defaultLocale,
      dir: "ltr" as const,
      setLocale: () => undefined,
      t: (key: string) => translate(key, defaultLocale),
      languages: WORLD_LOCALES,
    };
  }
  return ctx;
}
