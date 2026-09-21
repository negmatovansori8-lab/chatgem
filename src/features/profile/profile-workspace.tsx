"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Briefcase,
  Bug,
  Check,
  ChevronRight,
  Database,
  HardDrive,
  Heart,
  Info,
  LayoutGrid,
  LogOut,
  Mail,
  Megaphone,
  MonitorSmartphone,
  Pencil,
  Settings,
  Shield,
  ShieldCheck,
  Smile,
  Sparkles,
  BookOpen,
  AudioLines,
  Paintbrush,
  Sun,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { DEFAULT_PREFS, type UserPrefs } from "@/lib/prefs-types";

type ProfileUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  provider: string;
  planId: string;
  role?: string;
};

type PanelId =
  | "personalization"
  | "appearance"
  | "memory"
  | "plugins"
  | "workspace"
  | "plan"
  | "usage"
  | "parental"
  | "email"
  | "age"
  | "general"
  | "notifications"
  | "voice"
  | "safety"
  | "security"
  | "remote"
  | "storage"
  | "data"
  | "ads"
  | "bug"
  | "info";

const ACCENT_KEY = "nj_accent";

const ACCENTS = [
  { id: "blue", labelKey: "settings.accentBlue", color: "#3b82f6" },
  { id: "violet", labelKey: "settings.accentViolet", color: "#8b5cf6" },
  { id: "emerald", labelKey: "settings.accentEmerald", color: "#10b981" },
  { id: "rose", labelKey: "settings.accentRose", color: "#f43f5e" },
  { id: "amber", labelKey: "settings.accentAmber", color: "#f59e0b" },
] as const;

const THEMES = [
  { id: "system", labelKey: "settings.themeSystem" },
  { id: "dark", labelKey: "settings.themeDark" },
  { id: "light", labelKey: "settings.themeLight" },
] as const;

function applyAccent(color: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--accent", color);
  document.documentElement.style.setProperty("--accent-2", color);
  document.documentElement.style.setProperty(
    "--accent-glow",
    `color-mix(in oklab, ${color} 50%, transparent)`,
  );
  document.documentElement.style.setProperty("--ring", color);
}

function initialsFrom(name?: string | null, email?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2)
    return parts[0].slice(0, 2).toUpperCase();
  return (email || "CG").trim().slice(0, 2).toUpperCase();
}

function Avatar({
  user,
  size = "lg",
}: {
  user: ProfileUser | null;
  size?: "sm" | "lg" | "xl";
}) {
  const dim =
    size === "xl"
      ? "h-24 w-24 text-[2rem]"
      : size === "lg"
        ? "h-14 w-14 text-xl"
        : "h-9 w-9 text-sm";
  if (user?.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt={user.name}
        className={cn("rounded-full object-cover", dim)}
      />
    );
  }
  return (
    <div
      className={cn(
        "grid place-items-center rounded-full bg-[#7c3aed] font-semibold text-white",
        dim,
      )}
    >
      {initialsFrom(user?.name, user?.email)}
    </div>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition",
        on ? "bg-[var(--accent)]" : "bg-[var(--surface-3)]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition",
          on ? "start-[1.35rem]" : "start-0.5",
        )}
      />
    </button>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  subtitle,
  onClick,
  accent,
  last,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  subtitle?: string;
  onClick?: () => void;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 px-4 py-3.5 text-start transition active:bg-[var(--surface-2)]"
    >
      <Icon
        className={cn(
          "h-[22px] w-[22px] shrink-0",
          accent ? "text-[var(--accent)]" : "text-[var(--fg)]",
        )}
        strokeWidth={1.75}
      />
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2",
          !last && "border-b border-[var(--border)] pb-3.5",
        )}
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[16px] leading-snug",
              accent
                ? "font-medium text-[var(--accent)]"
                : "font-normal text-[var(--fg)]",
            )}
          >
            {label}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-[13px] text-[var(--fg-subtle)]">
              {subtitle}
            </span>
          ) : null}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
      </span>
    </button>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      {title ? (
        <p className="mb-2 px-1 text-[13px] text-[var(--fg-subtle)]">{title}</p>
      ) : null}
      <div className="overflow-hidden rounded-[1.15rem] bg-[var(--surface)]">
        {children}
      </div>
    </section>
  );
}

function PanelShell({
  title,
  onBack,
  right,
  children,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-full max-w-lg bg-[var(--bg)] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] text-[var(--fg)]">
      <header className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--surface-2)]"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <h1 className="flex-1 truncate text-center text-[17px] font-semibold">
          {title}
        </h1>
        <div className="flex h-10 w-10 items-center justify-center">{right}</div>
      </header>
      {children}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mb-4 overflow-hidden rounded-[1.15rem] bg-[var(--surface)] px-4 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[13px] text-[var(--fg-subtle)]">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder={placeholder}
          className="w-full resize-none rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-[15px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-[15px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
        />
      )}
    </label>
  );
}

export function ProfileWorkspace() {
  const router = useRouter();
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);
  const [msgUsed, setMsgUsed] = useState(0);
  const [memoryOn, setMemoryOn] = useState(true);
  const [memoryCount, setMemoryCount] = useState(0);
  const [familyName, setFamilyName] = useState("");
  const [bugText, setBugText] = useState("");
  const [bugSent, setBugSent] = useState(false);
  const [storageBytes, setStorageBytes] = useState(0);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => setMounted(true), []);

  const savePrefs = useCallback(async (patch: Partial<UserPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
    const res = await fetch("/api/settings/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.prefs) setPrefs(data.prefs);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1200);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [meRes, prefRes, memRes, usageRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/settings/prefs"),
        fetch("/api/memory"),
        fetch("/api/usage"),
      ]);
      const me = await meRes.json();
      const prefData = await prefRes.json().catch(() => ({}));
      const mem = await memRes.json().catch(() => ({}));
      const usage = await usageRes.json().catch(() => ({}));
      if (cancelled) return;
      setUser(me.user);
      if (prefData.prefs) setPrefs({ ...DEFAULT_PREFS, ...prefData.prefs });
      setMemoryOn(mem.enabled !== false);
      setMemoryCount(Array.isArray(mem.memories) ? mem.memories.length : 0);
      const messages = (
        usage.usage as Array<{ metric: string; amount: number }> | undefined
      )?.find((u) => u.metric === "messages");
      setMsgUsed(messages?.amount ?? 0);

      let bytes = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) bytes += (localStorage.getItem(k) || "").length * 2;
        }
      } catch {
        /* ignore */
      }
      setStorageBytes(bytes);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = prefs.accentId || "blue";
    const found = ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
    window.localStorage.setItem(ACCENT_KEY, found.id);
    applyAccent(found.color);
  }, [prefs.accentId]);

  async function logout() {
    await fetch("/api/auth/me", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  async function toggleMemory(next: boolean) {
    setMemoryOn(next);
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
  }

  function clearLocalData() {
    const keep = ["nj_locale", "theme", ACCENT_KEY];
    const saved: Record<string, string> = {};
    for (const k of keep) {
      const v = localStorage.getItem(k);
      if (v) saved[k] = v;
    }
    localStorage.clear();
    for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v);
    setStorageBytes(0);
    setSavedFlash(true);
  }

  const displayName = useMemo(() => {
    if (prefs.nickname.trim()) return prefs.nickname.trim();
    if (user?.name?.trim()) return user.name.trim();
    if (user?.email) return user.email.split("@")[0];
    return t("profile.guest");
  }, [prefs.nickname, user, t]);

  const planLabel =
    user?.planId === "pro" || user?.planId === "business"
      ? user.planId
      : t("profile.workspacePersonal");

  const activeTheme = mounted ? theme || "system" : "system";
  const accentLabel =
    t(
      ACCENTS.find((a) => a.id === prefs.accentId)?.labelKey ||
        "settings.accentBlue",
    );

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-muted)]">
        …
      </div>
    );
  }

  const saveMark = savedFlash ? (
    <Check className="h-5 w-5 text-[var(--accent)]" />
  ) : null;

  /* ---------- PANELS ---------- */

  if (panel === "appearance" || panel === "personalization") {
    return (
      <PanelShell
        title={
          panel === "appearance"
            ? t("settings.appearance")
            : t("profile.personalization")
        }
        onBack={() => setPanel(null)}
        right={saveMark}
      >
        <Card>
          <div className="mb-3 flex items-center gap-2 text-[14px] font-medium">
            <Sun className="h-4 w-4" />
            {t("settings.colorScheme")}
          </div>
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[var(--surface-2)] p-1">
            {THEMES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                className={cn(
                  "rounded-lg px-2 py-2 text-[13px] font-medium",
                  activeTheme === item.id
                    ? "bg-[var(--bg)] shadow-sm"
                    : "text-[var(--fg-muted)]",
                )}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2 text-[14px] font-medium">
            <Paintbrush className="h-4 w-4" />
            {t("settings.accentColor")}
            <span className="ms-auto text-[13px] text-[var(--fg-subtle)]">
              {accentLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => void savePrefs({ accentId: a.id })}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full",
                  prefs.accentId === a.id && "ring-2 ring-[var(--fg)]",
                )}
                style={{ background: a.color }}
              >
                {prefs.accentId === a.id ? (
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                ) : null}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[14px] font-medium">{t("nav.language")}</p>
            <LanguageSwitcher compact />
          </div>
        </Card>
        {panel === "personalization" ? (
          <Card>
            <Field
              label={t("profile.customStyle")}
              value={prefs.customStyle}
              onChange={(v) => setPrefs((p) => ({ ...p, customStyle: v }))}
              placeholder={t("profile.customStylePlaceholder")}
              multiline
            />
            <button
              type="button"
              onClick={() => void savePrefs({ customStyle: prefs.customStyle })}
              className="w-full rounded-xl bg-[var(--accent)] py-3 text-[15px] font-semibold text-[var(--accent-fg)]"
            >
              {t("common.save")}
            </button>
          </Card>
        ) : null}
      </PanelShell>
    );
  }

  if (panel === "memory") {
    return (
      <PanelShell
        title={t("sidebar.memory")}
        onBack={() => setPanel(null)}
        right={
          <div className="flex items-center gap-2">
            <Toggle on={memoryOn} onChange={(v) => void toggleMemory(v)} />
            {saveMark}
          </div>
        }
      >
        <p className="mb-3 px-1 text-[13px] leading-relaxed text-[var(--fg-subtle)]">
          {t("profile.memoryChatGptHint")}
        </p>
        <Card>
          <Link
            href="/app/memory"
            className="flex items-center justify-between text-[15px] font-medium"
          >
            {t("profile.memorySummary")}
            <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)]" />
          </Link>
          <p className="mt-2 text-[12px] text-[var(--fg-subtle)]">
            {memoryCount} {t("profile.memoryItems")}
          </p>
        </Card>
        <Card>
          <Field
            label={t("profile.nickname")}
            value={prefs.nickname}
            onChange={(v) => setPrefs((p) => ({ ...p, nickname: v }))}
            placeholder={t("profile.nicknamePh")}
          />
          <Field
            label={t("profile.profession")}
            value={prefs.profession}
            onChange={(v) => setPrefs((p) => ({ ...p, profession: v }))}
            placeholder={t("profile.professionPh")}
          />
          <Field
            label={t("profile.aboutYou")}
            value={prefs.aboutYou}
            onChange={(v) => setPrefs((p) => ({ ...p, aboutYou: v }))}
            placeholder={t("profile.aboutYouPh")}
            multiline
          />
          <button
            type="button"
            onClick={() =>
              void savePrefs({
                nickname: prefs.nickname,
                profession: prefs.profession,
                aboutYou: prefs.aboutYou,
              })
            }
            className="w-full rounded-xl bg-[var(--accent)] py-3 text-[15px] font-semibold text-[var(--accent-fg)]"
          >
            {t("common.save")}
          </button>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "plugins") {
    return (
      <PanelShell title={t("sidebar.plugins")} onBack={() => setPanel(null)}>
        <p className="mb-2 px-1 text-[13px] text-[var(--fg-subtle)]">
          {t("settings.params")}
        </p>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-medium">{t("settings.permissions")}</p>
              <p className="mt-0.5 text-[12px] text-[var(--fg-subtle)]">
                {t("settings.permissionsHint")}
              </p>
            </div>
            <Toggle
              on={prefs.pluginLowRisk}
              onChange={(v) => void savePrefs({ pluginLowRisk: v })}
            />
          </div>
        </Card>
        <p className="mb-2 px-1 text-[13px] text-[var(--fg-subtle)]">
          {t("plugins.installed")}
        </p>
        <Card>
          <Link
            href="/app/tools"
            className="flex items-center gap-3 text-[15px] font-medium"
          >
            <LayoutGrid className="h-5 w-5 text-[var(--accent)]" />
            {t("profile.openPlugins")}
            <ChevronRight className="ms-auto h-4 w-4 text-[var(--fg-subtle)]" />
          </Link>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "parental") {
    return (
      <PanelShell title={t("profile.parental")} onBack={() => setPanel(null)}>
        <p className="mb-3 px-1 text-[13px] leading-relaxed text-[var(--fg-subtle)]">
          {t("profile.parentalLong")}
        </p>
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[15px] font-medium">{t("profile.parentalToggle")}</p>
            <Toggle
              on={prefs.parentalOn}
              onChange={(v) => void savePrefs({ parentalOn: v })}
            />
          </div>
          <div className="flex gap-2">
            <input
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder={t("profile.familyNamePh")}
              className="min-w-0 flex-1 rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-[14px] outline-none"
            />
            <button
              type="button"
              className="shrink-0 rounded-xl bg-[var(--accent)] px-4 text-[14px] font-semibold text-[var(--accent-fg)]"
              onClick={() => {
                const name = familyName.trim();
                if (!name) return;
                const next = [...prefs.familyMembers, name];
                setFamilyName("");
                void savePrefs({ familyMembers: next, parentalOn: true });
              }}
            >
              {t("profile.addFamily")}
            </button>
          </div>
          {prefs.familyMembers.length ? (
            <ul className="mt-3 space-y-2">
              {prefs.familyMembers.map((m) => (
                <li
                  key={m}
                  className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[14px]"
                >
                  {m}
                  <button
                    type="button"
                    className="text-[var(--danger)]"
                    onClick={() =>
                      void savePrefs({
                        familyMembers: prefs.familyMembers.filter((x) => x !== m),
                      })
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </PanelShell>
    );
  }

  if (panel === "general") {
    return (
      <PanelShell title={t("settings.general")} onBack={() => setPanel(null)}>
        <Card>
          <button
            type="button"
            className="mb-3 flex w-full items-center justify-between"
            onClick={() => setPanel("appearance")}
          >
            <span className="text-[15px]">{t("settings.appearance")}</span>
            <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)]" />
          </button>
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
            <span className="text-[15px]">{t("nav.language")}</span>
            <LanguageSwitcher compact />
          </div>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "notifications") {
    return (
      <PanelShell title={t("settings.notifications")} onBack={() => setPanel(null)}>
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[15px]">{t("settings.notifications")}</p>
            <Toggle
              on={prefs.notificationsOn}
              onChange={(v) => void savePrefs({ notificationsOn: v })}
            />
          </div>
          <div className="mb-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
            <p className="text-[15px]">{t("profile.email")}</p>
            <Toggle
              on={prefs.notifyEmail}
              onChange={(v) => void savePrefs({ notifyEmail: v })}
            />
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
            <p className="text-[15px]">{t("settings.pushNotify")}</p>
            <Toggle
              on={prefs.notifyPush}
              onChange={(v) => void savePrefs({ notifyPush: v })}
            />
          </div>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "voice") {
    return (
      <PanelShell title={t("settings.voice")} onBack={() => setPanel(null)}>
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[15px] font-medium">{t("settings.voiceShort")}</p>
              <p className="text-[12px] text-[var(--fg-subtle)]">
                {t("settings.voiceHint")}
              </p>
            </div>
            <Toggle
              on={prefs.voicePrefer}
              onChange={(v) => void savePrefs({ voicePrefer: v })}
            />
          </div>
          <Link
            href="/app/voice"
            className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-4 py-3 text-[14px] font-medium"
          >
            {t("sidebar.voice")}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "safety") {
    return (
      <PanelShell title={t("settings.safety")} onBack={() => setPanel(null)}>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-medium">{t("settings.strictSafety")}</p>
              <p className="mt-1 text-[12px] text-[var(--fg-subtle)]">
                {t("settings.strictSafetyHint")}
              </p>
            </div>
            <Toggle
              on={prefs.safetyStrict}
              onChange={(v) => void savePrefs({ safetyStrict: v })}
            />
          </div>
        </Card>
        <Card>
          <button
            type="button"
            className="flex w-full items-center justify-between text-[15px]"
            onClick={() => setPanel("parental")}
          >
            {t("profile.parental")}
            <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)]" />
          </button>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "security") {
    return (
      <PanelShell title={t("settings.security")} onBack={() => setPanel(null)}>
        <Card>
          <p className="text-[13px] text-[var(--fg-subtle)]">{t("profile.email")}</p>
          <p className="mt-1 break-all text-[15px] font-medium">
            {user?.email || t("profile.emailGuest")}
          </p>
          <p className="mt-3 text-[13px] text-[var(--fg-subtle)]">
            {t("settings.loginVia")}: {user?.provider || "guest"}
          </p>
        </Card>
        {user ? (
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full rounded-[1.15rem] bg-[var(--surface)] py-3.5 text-[15px] font-medium text-[var(--danger)]"
          >
            {t("settings.logout")}
          </button>
        ) : (
          <Link
            href="/login"
            className="block w-full rounded-[1.15rem] bg-[var(--accent)] py-3.5 text-center text-[15px] font-semibold text-[var(--accent-fg)]"
          >
            {t("nav.signin")}
          </Link>
        )}
      </PanelShell>
    );
  }

  if (panel === "remote") {
    return (
      <PanelShell title={t("settings.remote")} onBack={() => setPanel(null)}>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-medium">{t("settings.remoteOff")}</p>
              <p className="mt-1 text-[12px] text-[var(--fg-subtle)]">
                {t("settings.remoteHint")}
              </p>
            </div>
            <Toggle
              on={prefs.remoteOff}
              onChange={(v) => void savePrefs({ remoteOff: v })}
            />
          </div>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "storage") {
    return (
      <PanelShell title={t("settings.storage")} onBack={() => setPanel(null)}>
        <Card>
          <p className="text-[15px] font-medium">{t("settings.localStorage")}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {(storageBytes / 1024).toFixed(1)} KB
          </p>
          <p className="mt-1 text-[12px] text-[var(--fg-subtle)]">
            {t("settings.storageHint")}
          </p>
          <Link
            href="/app/files"
            className="mt-4 flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-4 py-3 text-[14px]"
          >
            {t("sidebar.files")}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "data") {
    return (
      <PanelShell title={t("settings.data")} onBack={() => setPanel(null)}>
        <Card>
          <p className="mb-3 text-[13px] leading-relaxed text-[var(--fg-muted)]">
            {t("settings.dataHint")}
          </p>
          <button
            type="button"
            onClick={clearLocalData}
            className="w-full rounded-xl bg-[var(--surface-2)] py-3 text-[15px] font-medium text-[var(--danger)]"
          >
            {t("settings.clearLocal")}
          </button>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "ads") {
    return (
      <PanelShell title={t("settings.ads")} onBack={() => setPanel(null)}>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-medium">{t("settings.adsOff")}</p>
              <p className="mt-1 text-[12px] text-[var(--fg-subtle)]">
                {t("settings.adsHint")}
              </p>
        </div>
            <Toggle
              on={prefs.adsOff}
              onChange={(v) => void savePrefs({ adsOff: v })}
            />
      </div>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "bug") {
    return (
      <PanelShell title={t("settings.report")} onBack={() => setPanel(null)}>
        <Card>
          <textarea
            value={bugText}
            onChange={(e) => setBugText(e.target.value)}
            rows={5}
            placeholder={t("settings.bugPh")}
            className="mb-3 w-full resize-none rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-[15px] outline-none"
          />
          <button
            type="button"
            disabled={!bugText.trim()}
            onClick={() => {
              const list = JSON.parse(
                localStorage.getItem("nj_bug_reports") || "[]",
              ) as string[];
              list.push(`${new Date().toISOString()}: ${bugText.trim()}`);
              localStorage.setItem("nj_bug_reports", JSON.stringify(list));
              setBugText("");
              setBugSent(true);
            }}
            className="w-full rounded-xl bg-[var(--accent)] py-3 text-[15px] font-semibold text-[var(--accent-fg)] disabled:opacity-40"
          >
            {t("settings.sendBug")}
          </button>
          {bugSent ? (
            <p className="mt-2 text-center text-[13px] text-emerald-500">
              {t("settings.bugThanks")}
            </p>
          ) : null}
        </Card>
      </PanelShell>
    );
  }

  if (panel === "info") {
    return (
      <PanelShell title={t("settings.info")} onBack={() => setPanel(null)}>
        <Card>
          <p className="text-[17px] font-semibold">ChatGem</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--fg-muted)]">
            {t("settings.infoBody")}
          </p>
          <p className="mt-3 text-[12px] text-[var(--fg-subtle)]">v0.1.0</p>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "workspace") {
    return (
      <PanelShell title={t("profile.workspace")} onBack={() => setPanel(null)}>
        <Card>
          <p className="text-[15px] font-medium">{planLabel}</p>
          <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
            {t("profile.workspaceHint")}
          </p>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "plan") {
    return (
      <PanelShell title={t("profile.changePlan")} onBack={() => setPanel(null)}>
        <Card>
          <p className="text-[15px]">
            {t("billing.current")}:{" "}
            <span className="capitalize text-[var(--accent)]">
              {user?.planId || "free"}
            </span>
          </p>
          <Link
            href="/app/billing"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 text-[15px] font-semibold text-[var(--accent-fg)]"
          >
            <Sparkles className="h-4 w-4" />
            {t("profile.openBilling")}
          </Link>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "usage") {
    return (
      <PanelShell title={t("profile.usage")} onBack={() => setPanel(null)}>
        <Card>
          <p className="text-[14px]">{t("profile.messagesThisMonth")}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{msgUsed}</p>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "email") {
    return (
      <PanelShell title={t("profile.email")} onBack={() => setPanel(null)}>
        <Card>
          <p className="break-all text-[16px] font-medium">
            {user?.email || t("profile.emailGuest")}
          </p>
          <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
            {t("profile.emailHint")}
          </p>
        </Card>
      </PanelShell>
    );
  }

  if (panel === "age") {
    return (
      <PanelShell title={t("profile.ageVerify")} onBack={() => setPanel(null)}>
        <Card>
          <p className="text-[15px] font-medium">
            {prefs.ageVerified
              ? t("profile.ageVerified")
              : t("profile.ageNotVerified")}
          </p>
          <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
            {t("profile.ageHint")}
          </p>
          {!prefs.ageVerified ? (
            <button
              type="button"
              onClick={() => void savePrefs({ ageVerified: true })}
              className="mt-4 w-full rounded-xl bg-[var(--accent)] py-3 text-[15px] font-semibold text-[var(--accent-fg)]"
            >
              {t("profile.ageConfirm")}
            </button>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-[var(--accent)]">
              <Check className="h-4 w-4" /> {t("profile.ageVerified")}
            </p>
          )}
        </Card>
      </PanelShell>
    );
  }

  /* ---------- MAIN ---------- */

  return (
    <div className="mx-auto min-h-full max-w-lg bg-[var(--bg)] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] text-[var(--fg)]">
      <header className="mb-2 flex items-center">
        <button
          type="button"
          onClick={() => router.back()}
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--surface-2)]"
          aria-label={t("common.back")}
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </header>

      <div className="mb-8 flex flex-col items-center">
        <div className="relative">
          <Avatar user={user} size="xl" />
          <button
            type="button"
            onClick={() => setPanel("personalization")}
            className="absolute -bottom-0.5 -end-0.5 grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] shadow-sm"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
        <h1 className="mt-4 max-w-[90%] truncate text-center text-[22px] font-semibold">
          {displayName}
        </h1>
      </div>

      <SettingsGroup title={t("profile.myApp")}>
        <SettingsRow
          icon={Smile}
          label={t("profile.personalization")}
          onClick={() => setPanel("personalization")}
        />
        <SettingsRow
          icon={BookOpen}
          label={t("sidebar.memory")}
          subtitle={memoryOn ? t("memory.enabled") : t("memory.disabled")}
          onClick={() => setPanel("memory")}
        />
        <SettingsRow
          icon={LayoutGrid}
          label={t("sidebar.plugins")}
          onClick={() => setPanel("plugins")}
          last
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings.account")}>
        <SettingsRow
          icon={Briefcase}
          label={t("profile.workspace")}
          subtitle={planLabel}
          onClick={() => setPanel("workspace")}
        />
        <SettingsRow
          icon={Sparkles}
          label={t("profile.changePlan")}
          onClick={() => setPanel("plan")}
          accent
        />
        <SettingsRow
          icon={BarChart3}
          label={t("profile.usage")}
          subtitle={`${msgUsed}`}
          onClick={() => setPanel("usage")}
        />
        <SettingsRow
          icon={Heart}
          label={t("profile.parental")}
          onClick={() => setPanel("parental")}
        />
        <SettingsRow
          icon={Mail}
          label={t("profile.email")}
          subtitle={user?.email || t("profile.emailGuest")}
          onClick={() => setPanel("email")}
        />
        <SettingsRow
          icon={Shield}
          label={t("profile.ageVerify")}
          onClick={() => setPanel("age")}
          last
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon={Sun}
          label={t("settings.appearance")}
          subtitle={accentLabel}
          onClick={() => setPanel("appearance")}
        />
        <SettingsRow
          icon={Settings}
          label={t("settings.general")}
          onClick={() => setPanel("general")}
        />
        <SettingsRow
          icon={Bell}
          label={t("settings.notifications")}
          subtitle={prefs.notificationsOn ? t("profile.parentalOn") : t("profile.parentalOff")}
          onClick={() => setPanel("notifications")}
        />
        <SettingsRow
          icon={AudioLines}
          label={t("settings.voice")}
          onClick={() => setPanel("voice")}
        />
        <SettingsRow
          icon={ShieldCheck}
          label={t("settings.safety")}
          onClick={() => setPanel("safety")}
        />
        <SettingsRow
          icon={Shield}
          label={t("settings.security")}
          onClick={() => setPanel("security")}
        />
        <SettingsRow
          icon={MonitorSmartphone}
          label={t("settings.remote")}
          onClick={() => setPanel("remote")}
        />
        <SettingsRow
          icon={HardDrive}
          label={t("settings.storage")}
          onClick={() => setPanel("storage")}
        />
        <SettingsRow
          icon={Database}
          label={t("settings.data")}
          onClick={() => setPanel("data")}
        />
        <SettingsRow
          icon={Megaphone}
          label={t("settings.ads")}
          onClick={() => setPanel("ads")}
        />
        <SettingsRow
          icon={Bug}
          label={t("settings.report")}
          onClick={() => setPanel("bug")}
        />
        <SettingsRow
          icon={Info}
          label={t("settings.info")}
          onClick={() => setPanel("info")}
          last
        />
      </SettingsGroup>

      {user ? (
        <button
          type="button"
          onClick={() => void logout()}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-[1.15rem] bg-[var(--surface)] py-3.5 text-[15px] font-medium text-[var(--danger)]"
        >
          <LogOut className="h-4 w-4" />
          {t("settings.logout")}
        </button>
      ) : (
        <Link
          href="/login"
          className="mb-4 flex w-full items-center justify-center rounded-[1.15rem] bg-[var(--accent)] py-3.5 text-[15px] font-semibold text-[var(--accent-fg)]"
        >
          {t("nav.signin")}
        </Link>
      )}
    </div>
  );
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setUser(data.user);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (compact) {
    return (
        <button
          type="button"
        onClick={() => router.push("/app/profile")}
        className="relative z-20 grid h-10 w-10 shrink-0 place-items-center rounded-full"
        aria-label="Profile"
        >
          <Avatar user={user} size="sm" />
        </button>
    );
  }

  return (
      <button
        type="button"
      onClick={() => router.push("/app/profile")}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[var(--surface-2)]"
      >
        <Avatar user={user} size="sm" />
        <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {user?.name || "Guest"}
        </span>
          <span className="block truncate text-[11px] text-[var(--fg-subtle)]">
            {user?.email || "Sign in"}
          </span>
        </span>
      </button>
  );
}
