"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/locale-provider";
import { useToast } from "@/components/ui/toast";
import { isAccentId, storeAccent } from "@/lib/accent";
import { DEFAULT_PREFS, type UserPrefs } from "@/lib/prefs-types";
import type { ProfileUser } from "@/features/profile/profile-workspace";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type SettingsData = {
  loading: boolean;
  user: ProfileUser | null;
  prefs: UserPrefs;
  memoryOn: boolean;
  memoryCount: number;
  messagesUsed: number;
  status: SaveStatus;
  savingKeys: ReadonlySet<keyof UserPrefs>;
  savePrefs: (patch: Partial<UserPrefs>) => Promise<boolean>;
  setMemory: (on: boolean) => Promise<void>;
  memoryBusy: boolean;
  logout: () => Promise<void>;
};

const Ctx = createContext<SettingsData | null>(null);

export function useSettingsData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettingsData must be used within SettingsDataProvider");
  return ctx;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function SettingsDataProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);
  const [memoryOn, setMemoryOn] = useState(true);
  const [memoryCount, setMemoryCount] = useState(0);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [messagesUsed, setMessagesUsed] = useState(0);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savingKeys, setSavingKeys] = useState<ReadonlySet<keyof UserPrefs>>(new Set());
  const prefsRef = useRef(prefs);
  const statusTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [me, pref, mem, usage] = await Promise.all([
        getJson<{ user: ProfileUser | null }>("/api/auth/me"),
        getJson<{ prefs?: Partial<UserPrefs> }>("/api/settings/prefs"),
        getJson<{ enabled?: boolean; memories?: unknown[] }>("/api/memory"),
        getJson<{ usage?: Array<{ metric: string; amount: number }> }>("/api/usage"),
      ]);
      if (cancelled) return;
      setUser(me?.user ?? null);
      if (pref?.prefs) {
        setPrefs({ ...DEFAULT_PREFS, ...pref.prefs });
        if (isAccentId(pref.prefs.accent)) storeAccent(pref.prefs.accent);
      }
      setMemoryOn(mem?.enabled !== false);
      setMemoryCount(Array.isArray(mem?.memories) ? mem.memories.length : 0);
      setMessagesUsed(usage?.usage?.find((u) => u.metric === "messages")?.amount ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(statusTimer.current);
    };
  }, []);

  const flash = useCallback((next: SaveStatus) => {
    setStatus(next);
    window.clearTimeout(statusTimer.current);
    if (next === "saved" || next === "error") {
      statusTimer.current = window.setTimeout(() => setStatus("idle"), 2200);
    }
  }, []);

  const savePrefs = useCallback(
    async (patch: Partial<UserPrefs>) => {
      const keys = Object.keys(patch) as (keyof UserPrefs)[];
      const previous = prefsRef.current;
      setPrefs((p) => ({ ...p, ...patch }));
      setSavingKeys((s) => new Set([...s, ...keys]));
      flash("saving");
      try {
        const res = await fetch("/api/settings/prefs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { prefs?: Partial<UserPrefs> };
        if (data.prefs) setPrefs({ ...DEFAULT_PREFS, ...data.prefs });
        flash("saved");
        return true;
      } catch {
        setPrefs((p) => {
          const reverted = { ...p };
          for (const k of keys) Object.assign(reverted, { [k]: previous[k] });
          return reverted;
        });
        flash("error");
        toast.error(navigator.onLine ? t("settings.saveFailed") : t("common.offline"));
        return false;
      } finally {
        setSavingKeys((s) => {
          const next = new Set(s);
          for (const k of keys) next.delete(k);
          return next;
        });
      }
    },
    [flash, toast, t],
  );

  const setMemory = useCallback(
    async (on: boolean) => {
      const previous = memoryOn;
      setMemoryOn(on);
      setMemoryBusy(true);
      flash("saving");
      try {
        const res = await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: on }),
        });
        if (!res.ok) throw new Error(String(res.status));
        flash("saved");
      } catch {
        setMemoryOn(previous);
        flash("error");
        toast.error(t("settings.saveFailed"));
      } finally {
        setMemoryBusy(false);
      }
    },
    [flash, memoryOn, toast, t],
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/me", { method: "DELETE" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }, [router]);

  const value = useMemo<SettingsData>(
    () => ({
      loading,
      user,
      prefs,
      memoryOn,
      memoryCount,
      messagesUsed,
      status,
      savingKeys,
      savePrefs,
      setMemory,
      memoryBusy,
      logout,
    }),
    [loading, user, prefs, memoryOn, memoryCount, messagesUsed, status, savingKeys, savePrefs, setMemory, memoryBusy, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
