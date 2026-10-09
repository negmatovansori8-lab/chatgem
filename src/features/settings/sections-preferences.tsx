"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Languages, Laptop, Monitor, Palette, Search, Smartphone, Tablet, X } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { useToast } from "@/components/ui/toast";
import { ACCENTS, DEFAULT_ACCENT, isAccentId, storeAccent } from "@/lib/accent";
import { useDeviceProfile, type DeviceKind } from "@/lib/device-profile";
import { t as translate } from "@/lib/i18n";
import { useMounted } from "@/lib/use-client-state";
import { cn } from "@/lib/utils";
import { Avatar } from "@/features/profile/profile-workspace";
import { useSettingsData } from "@/features/settings/settings-data";
import type { SectionId } from "@/features/settings/settings-nav";
import {
  ActionButton,
  Badge,
  LinkRow,
  SettingRow,
  SettingsCard,
  SettingsStack,
  Switch,
} from "@/features/settings/controls";

export type SectionProps = { go: (id: SectionId) => void };

const DEVICE_ICONS: Record<DeviceKind, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  desktop: Monitor,
};

const THEME_OPTIONS = [
  { id: "light", labelKey: "settings.themeLight" },
  { id: "dark", labelKey: "settings.themeDark" },
  { id: "system", labelKey: "settings.themeSystem" },
] as const;

const POPULAR = ["tg", "ru", "en", "uz", "fa", "tr", "ar", "zh", "de", "fr", "es", "kk", "ky", "hi"];

export function useThemeLabel() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const mounted = useMounted();
  const active = mounted ? theme || "system" : "system";
  const found = THEME_OPTIONS.find((o) => o.id === active) ?? THEME_OPTIONS[2];
  return t(found.labelKey);
}

export function ProfileSummary({ onManage }: { onManage: () => void }) {
  const { t } = useI18n();
  const { user, prefs } = useSettingsData();
  const name =
    prefs.nickname.trim() || user?.name?.trim() || (user?.email ? user.email.split("@")[0] : t("profile.guest"));
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <Avatar user={user} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold text-[var(--fg)]">{name}</p>
          <p className="truncate text-[13px] text-[var(--fg-subtle)]">{user?.email || t("profile.emailGuest")}</p>
          <div className="mt-1.5">
            <Badge tone="success">{user?.planId && user.planId !== "free" ? user.planId : "Free"}</Badge>
          </div>
        </div>
      </div>
      {user ? (
        <ActionButton variant="secondary" onClick={onManage} className="w-full sm:w-auto">
          {t("settingsUi.manageAccount")}
        </ActionButton>
      ) : (
        <ActionButton href="/login" className="w-full sm:w-auto">
          {t("nav.signin")}
        </ActionButton>
      )}
    </div>
  );
}

export function GeneralSection({ go }: SectionProps) {
  const { t, locale, languages } = useI18n();
  const device = useDeviceProfile();
  const themeLabel = useThemeLabel();
  const DeviceIcon = DEVICE_ICONS[device.kind];
  const language = languages.find((l) => l.code === locale);

  return (
    <SettingsStack>
      <ProfileSummary onManage={() => go("account")} />

      <SettingsCard title={t("settingsUi.device.title")} description={t("settingsUi.device.hint")}>
        <SettingRow
          icon={DeviceIcon}
          title={t(`settingsUi.device.${device.kind}`)}
          description={`${device.width} × ${device.height} · ${
            device.touch ? t("settingsUi.device.touch") : t("settingsUi.device.mouse")
          }`}
        >
          <Badge tone="success">{t("settingsUi.device.auto")}</Badge>
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={t("settingsUi.general.quick")}>
        <LinkRow
          icon={Palette}
          title={t("settings.appearance")}
          description={t("settingsUi.desc.appearance")}
          value={themeLabel}
          onClick={() => go("appearance")}
        />
        <LinkRow
          icon={Languages}
          title={t("nav.language")}
          description={t("settingsUi.desc.language")}
          value={language?.native}
          onClick={() => go("language")}
        />
      </SettingsCard>
    </SettingsStack>
  );
}

function ThemePreview({ mode }: { mode: "light" | "dark" | "system" }) {
  const pane = (dark: boolean) => (
    <div className={cn("flex h-full flex-1 flex-col gap-1 p-2", dark ? "bg-[#111113]" : "bg-[#f4f4f2]")}>
      <div className={cn("h-1.5 w-2/3 rounded-full", dark ? "bg-white/25" : "bg-black/15")} />
      <div className={cn("h-1.5 w-1/2 rounded-full", dark ? "bg-white/15" : "bg-black/10")} />
      <div className="mt-auto h-2.5 rounded-md bg-[var(--accent)] opacity-80" />
    </div>
  );
  return (
    <div className="flex h-16 overflow-hidden rounded-lg border border-[var(--border)] sm:h-20">
      {mode === "system" ? (
        <>
          {pane(false)}
          {pane(true)}
        </>
      ) : (
        pane(mode === "dark")
      )}
    </div>
  );
}

export function AppearanceSection() {
  const { t } = useI18n();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const { prefs, savePrefs } = useSettingsData();
  const active = mounted ? theme || "system" : "system";
  const accent = isAccentId(prefs.accent) ? prefs.accent : DEFAULT_ACCENT;
  const accentLabel = t(ACCENTS.find((a) => a.id === accent)?.labelKey ?? "settings.accentTeal");

  async function pickAccent(id: string) {
    const previous = accent;
    storeAccent(id);
    if (!(await savePrefs({ accent: id }))) storeAccent(previous);
  }

  return (
    <SettingsStack>
      <SettingsCard
        title={t("settings.colorScheme")}
        description={
          active === "system" && mounted
            ? t("settingsUi.theme.following").replace(
                "{mode}",
                t(resolvedTheme === "dark" ? "settings.themeDark" : "settings.themeLight"),
              )
            : t("settingsUi.theme.hint")
        }
      >
        <div role="radiogroup" aria-label={t("settings.colorScheme")} className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
          {THEME_OPTIONS.map((opt) => {
            const selected = active === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(opt.id)}
                className={cn(
                  "group min-w-0 rounded-xl border p-1.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:p-2",
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                    : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
                )}
              >
                <ThemePreview mode={opt.id} />
                <span className="mt-2 flex items-center justify-between gap-1 px-0.5">
                  <span className="truncate text-[13px] font-semibold text-[var(--fg)]">{t(opt.labelKey)}</span>
                  <span
                    className={cn(
                      "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                      selected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border-strong)]",
                    )}
                  >
                    {selected ? <Check className="h-2.5 w-2.5 text-[var(--accent-fg)]" strokeWidth={3} /> : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard title={t("settings.accentColor")} description={t("settingsUi.accent.hint")}>
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div role="radiogroup" aria-label={t("settings.accentColor")} className="flex flex-wrap gap-2.5">
            {ACCENTS.map((a) => {
              const selected = accent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={t(a.labelKey)}
                  title={t(a.labelKey)}
                  onClick={() => void pickAccent(a.id)}
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg)] active:scale-95",
                    selected && "ring-2 ring-[var(--fg)]",
                  )}
                  style={{ background: a.color }}
                >
                  {selected ? <Check className="h-4 w-4 text-white" strokeWidth={3} /> : null}
                </button>
              );
            })}
          </div>
          <span className="hidden text-[13px] font-medium text-[var(--fg-muted)] sm:block">{accentLabel}</span>
        </div>
      </SettingsCard>
    </SettingsStack>
  );
}

export function LanguageSection() {
  const { t, locale, setLocale, languages } = useI18n();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const current = languages.find((l) => l.code === locale);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return languages.filter(
        (l) => l.code.toLowerCase().includes(q) || l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q),
      );
    }
    const pinned = POPULAR.map((c) => languages.find((l) => l.code === c)).filter(
      (l): l is (typeof languages)[number] => Boolean(l),
    );
    const pinnedSet = new Set(POPULAR);
    return [...pinned, ...languages.filter((l) => !pinnedSet.has(l.code))];
  }, [languages, query]);

  function pick(code: string) {
    if (code === locale) return;
    setLocale(code);
    toast.success(translate("lang.applied", code));
  }

  return (
    <SettingsStack>
      <SettingsCard title={t("settingsUi.language.current")}>
        <SettingRow
          title={current?.native ?? locale}
          description={`${current?.name ?? locale} · ${t("lang.hint")}`}
        >
          <Badge tone="success">{locale.toUpperCase()}</Badge>
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={t("lang.title")}>
        <div className="p-3 sm:p-4">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 transition-colors focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-muted)]">
            <Search className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" strokeWidth={1.75} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("lang.search")}
              aria-label={t("lang.search")}
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear"
                className="grid h-7 w-7 place-items-center rounded-full text-[var(--fg-subtle)] hover:bg-[var(--surface-3)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
          {!query ? (
            <p className="mt-3 px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-subtle)]">
              {t("lang.popular")}
            </p>
          ) : null}
          <ul
            role="radiogroup"
            aria-label={t("lang.title")}
            className="nj-lang-list mt-2 grid max-h-[min(26rem,55dvh)] grid-cols-1 gap-1 overflow-y-auto overscroll-contain pe-1 sm:grid-cols-2"
          >
            {list.map((lang) => {
              const selected = lang.code === locale;
              return (
                <li key={lang.code}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => pick(lang.code)}
                    className={cn(
                      "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]",
                      selected
                        ? "bg-[var(--accent-muted)]"
                        : "hover:bg-[var(--surface-2)] active:bg-[var(--surface-3)]",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium text-[var(--fg)]">{lang.native}</span>
                      <span className="block truncate text-[12px] text-[var(--fg-subtle)]">{lang.name}</span>
                    </span>
                    {selected ? (
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)]">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {!list.length ? (
              <li className="col-span-full px-3 py-8 text-center text-[13px] text-[var(--fg-subtle)]">
                {t("settingsUi.language.none")}
              </li>
            ) : null}
          </ul>
        </div>
      </SettingsCard>
    </SettingsStack>
  );
}

function readPushPermission(): NotificationPermission | "unsupported" {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

export function NotificationsSection() {
  const { t } = useI18n();
  const toast = useToast();
  const { user, prefs, savePrefs, savingKeys } = useSettingsData();
  const [permission, setPermission] = useState(readPushPermission);
  const master = prefs.notificationsOn;

  async function togglePush(next: boolean) {
    if (next && permission !== "unsupported" && permission !== "granted") {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        toast.error(t("settingsUi.push.denied"));
        return;
      }
    }
    void savePrefs({ notifyPush: next });
  }

  const pushHint =
    permission === "unsupported"
      ? t("settingsUi.push.unsupported")
      : permission === "denied"
        ? t("settingsUi.push.blocked")
        : t("settingsUi.push.hint");

  return (
    <SettingsStack>
      <SettingsCard>
        <SettingRow title={t("settings.notifications")} description={t("settingsUi.notify.masterHint")}>
          <Switch
            label={t("settings.notifications")}
            checked={master}
            busy={savingKeys.has("notificationsOn")}
            onChange={(v) => void savePrefs({ notificationsOn: v })}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={t("settingsUi.notify.channels")}>
        <SettingRow
          title={t("profile.email")}
          description={user?.email ? t("settingsUi.notify.emailHint") : t("profile.emailGuest")}
          disabled={!master || !user?.email}
        >
          <Switch
            label={t("profile.email")}
            checked={master && prefs.notifyEmail}
            disabled={!master || !user?.email}
            busy={savingKeys.has("notifyEmail")}
            onChange={(v) => void savePrefs({ notifyEmail: v })}
          />
        </SettingRow>
        <SettingRow
          title={t("settings.pushNotify")}
          description={pushHint}
          disabled={!master || permission === "unsupported"}
        >
          <Switch
            label={t("settings.pushNotify")}
            checked={master && prefs.notifyPush && permission !== "denied"}
            disabled={!master || permission === "unsupported" || permission === "denied"}
            busy={savingKeys.has("notifyPush")}
            onChange={(v) => void togglePush(v)}
          />
        </SettingRow>
      </SettingsCard>
    </SettingsStack>
  );
}
