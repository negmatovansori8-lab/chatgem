"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Offline banner at the top of every page; a short "back online" note after reconnecting. */
export function NetworkStatus() {
  const { t } = useI18n();
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const [wasOffline, setWasOffline] = useState(false);
  const [showBack, setShowBack] = useState(false);

  if (!online && !wasOffline) setWasOffline(true);
  if (online && wasOffline) {
    setWasOffline(false);
    setShowBack(true);
  }

  useEffect(() => {
    if (!showBack) return;
    const id = window.setTimeout(() => setShowBack(false), 2500);
    return () => window.clearTimeout(id);
  }, [showBack]);

  if (online && !showBack) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[120] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-md items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium shadow-[var(--shadow-lg)]",
          online ? "bg-[var(--success)] text-white" : "bg-[var(--fg)] text-[var(--bg)]",
        )}
      >
        {online ? <Wifi className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
        <span>{online ? t("common.backOnline") : t("common.offline")}</span>
      </div>
    </div>
  );
}
