"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: string;
  title: string;
  kind: ToastKind;
};

type ToastCtx = {
  push: (title: string, kind?: ToastKind) => void;
  success: (title: string) => void;
  error: (title: string) => void;
  info: (title: string) => void;
};

const ToastContext = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      push: () => undefined,
      success: () => undefined,
      error: () => undefined,
      info: () => undefined,
    } satisfies ToastCtx;
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((title: string, kind: ToastKind = "info") => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev.slice(-4), { id, title, kind }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  const value = useMemo<ToastCtx>(
    () => ({
      push,
      success: (title) => push(title, "success"),
      error: (title) => push(title, "error"),
      info: (title) => push(title, "info"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[200] flex flex-col items-center gap-2 px-3"
        aria-live="polite"
      >
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className={cn(
                "pointer-events-auto flex max-w-sm items-start gap-2 rounded-2xl border px-3.5 py-2.5 text-sm shadow-xl backdrop-blur-xl",
                item.kind === "success" &&
                  "border-emerald-500/30 bg-[color-mix(in_oklab,var(--surface)_92%,#10b981)] text-[var(--fg)]",
                item.kind === "error" &&
                  "border-red-500/35 bg-[color-mix(in_oklab,var(--surface)_92%,#ef4444)] text-[var(--fg)]",
                item.kind === "info" &&
                  "border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] text-[var(--fg)]",
              )}
            >
              {item.kind === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : item.kind === "error" ? (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
              )}
              <p className="min-w-0 flex-1 leading-snug">{item.title}</p>
              <button
                type="button"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--fg-subtle)] hover:bg-[var(--surface-3)]"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
