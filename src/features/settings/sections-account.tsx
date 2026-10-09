"use client";

import { useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle2,
  HardDrive,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { useToast } from "@/components/ui/toast";
import { ACCENT_STORAGE_KEY } from "@/lib/accent";
import { Avatar } from "@/features/profile/profile-workspace";
import { useSettingsData } from "@/features/settings/settings-data";
import { LocationCard } from "@/features/settings/sections-assistant";
import type { SectionProps } from "@/features/settings/sections-preferences";
import {
  ActionButton,
  Badge,
  LinkRow,
  SettingRow,
  SettingsCard,
  SettingsStack,
  Switch,
} from "@/features/settings/controls";

const APP_VERSION = "0.1.0";

/**
 * Keys that survive "clear local cache". The `nj_locale_v*` markers must stay, otherwise the
 * locale migration in locale-provider forces Tajik again on the next load.
 */
const KEEP_LOCAL = [
  "nj_locale",
  "nj_locale_v3",
  "nj_locale_v4",
  "nj_welcome_seen_v2",
  "nj_sidebar_open",
  "theme",
  ACCENT_STORAGE_KEY,
  "chatgem:voice-settings",
];

function localBytes() {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) bytes += (k.length + (localStorage.getItem(k) || "").length) * 2;
    }
  } catch {
    // storage unavailable
  }
  return bytes;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function SignOutButton() {
  const { t } = useI18n();
  const { user, logout } = useSettingsData();
  const [busy, setBusy] = useState(false);
  if (!user) {
    return (
      <ActionButton href="/login" icon={LogIn} className="w-full sm:w-auto">
        {t("nav.signin")}
      </ActionButton>
    );
  }
  return (
    <ActionButton
      variant="danger"
      icon={LogOut}
      loading={busy}
      className="w-full sm:w-auto"
      onClick={() => {
        setBusy(true);
        void logout();
      }}
    >
      {t("settings.logout")}
    </ActionButton>
  );
}

export function AccountSection() {
  const { t } = useI18n();
  const { user, prefs, messagesUsed } = useSettingsData();
  const name = user?.name?.trim() || prefs.nickname.trim() || (user?.email ? user.email.split("@")[0] : t("profile.guest"));
  const plan = user?.planId || "free";

  return (
    <SettingsStack>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-center sm:flex-row sm:text-start">
        <Avatar user={user} size="xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[19px] font-semibold text-[var(--fg)]">{name}</p>
          <p className="mt-0.5 break-all text-[14px] text-[var(--fg-muted)]">{user?.email || t("profile.signInForEmail")}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            <Badge tone="success">{plan}</Badge>
            {user?.provider ? <Badge>{user.provider}</Badge> : null}
          </div>
        </div>
      </div>

      <SettingsCard title={t("profile.accountInfo")}>
        <SettingRow icon={Mail} title={t("profile.emailCurrent")} description={user?.email || t("profile.noEmail")} />
        <SettingRow icon={KeyRound} title={t("settings.loginVia")} description={user?.provider || "—"} />
        {user ? (
          <p className="px-4 py-3 text-[12px] leading-snug text-[var(--fg-subtle)] sm:px-5">{t("profile.emailHint")}</p>
        ) : null}
      </SettingsCard>

      <SettingsCard title={t("settingsUi.account.plan")}>
        <SettingRow icon={Sparkles} title={t("profile.planLabel")} description={t("profile.planHint")}>
          <Badge tone="success">{plan}</Badge>
        </SettingRow>
        <SettingRow icon={BarChart3} title={t("profile.messagesThisMonth")} description={t("profile.usageHint")}>
          <span className="text-[17px] font-semibold tabular-nums text-[var(--fg)]">{messagesUsed}</span>
        </SettingRow>
        <SettingRow icon={Briefcase} title={t("profile.workspace")} description={t("profile.workspaceHint")}>
          <Badge>{plan === "free" ? t("profile.workspacePersonal") : plan}</Badge>
        </SettingRow>
        <LinkRow icon={Sparkles} title={t("profile.openBilling")} href="/app/billing" />
      </SettingsCard>

      <div className="flex justify-center sm:justify-start">
        <SignOutButton />
      </div>
    </SettingsStack>
  );
}

export function PrivacySection({ go }: SectionProps) {
  const { t } = useI18n();
  const toast = useToast();
  const { prefs, savePrefs, savingKeys, memoryOn } = useSettingsData();
  const [bytes, setBytes] = useState(localBytes);
  const [confirming, setConfirming] = useState(false);

  function clearLocal() {
    const saved: Record<string, string> = {};
    for (const k of KEEP_LOCAL) {
      const v = localStorage.getItem(k);
      if (v) saved[k] = v;
    }
    localStorage.clear();
    for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v);
    setBytes(localBytes());
    setConfirming(false);
    toast.success(t("settingsUi.privacy.cleared"));
  }

  return (
    <SettingsStack>
      <SettingsCard title={t("settingsUi.privacy.controls")}>
        <SettingRow title={t("settings.remoteOff")} description={t("settings.remoteHint")}>
          <Switch
            label={t("settings.remoteOff")}
            checked={prefs.remoteOff}
            busy={savingKeys.has("remoteOff")}
            onChange={(v) => void savePrefs({ remoteOff: v })}
          />
        </SettingRow>
        <SettingRow title={t("settings.adsOff")} description={t("settings.adsHint")}>
          <Switch
            label={t("settings.adsOff")}
            checked={prefs.adsOff}
            busy={savingKeys.has("adsOff")}
            onChange={(v) => void savePrefs({ adsOff: v })}
          />
        </SettingRow>
        <LinkRow
          icon={BookOpen}
          title={t("memory.title")}
          description={t("profile.memoryHint")}
          value={memoryOn ? t("profile.parentalOn") : t("profile.parentalOff")}
          onClick={() => go("ai")}
        />
      </SettingsCard>

      <LocationCard />

      <SettingsCard title={t("settings.data")} description={t("settings.dataHint")}>
        <SettingRow icon={HardDrive} title={t("settings.localStorage")} description={t("settingsUi.privacy.storageHint")}>
          <span className="text-[14px] font-semibold tabular-nums text-[var(--fg)]">{formatBytes(bytes)}</span>
        </SettingRow>
        <div className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[13px] text-[var(--fg-subtle)]">
            {confirming ? t("settingsUi.privacy.confirm") : t("settingsUi.privacy.clearHint")}
          </p>
          <div className="flex gap-2">
            {confirming ? (
              <ActionButton variant="secondary" onClick={() => setConfirming(false)} className="flex-1 sm:flex-none">
                {t("common.cancel")}
              </ActionButton>
            ) : null}
            <ActionButton
              variant="danger"
              icon={Trash2}
              onClick={confirming ? clearLocal : () => setConfirming(true)}
              className="flex-1 sm:flex-none"
            >
              {confirming ? t("settingsUi.privacy.confirmBtn") : t("settings.clearLocal")}
            </ActionButton>
          </div>
        </div>
      </SettingsCard>
    </SettingsStack>
  );
}

export function SecuritySection() {
  const { t } = useI18n();
  const { user, prefs, savePrefs, savingKeys } = useSettingsData();
  const [member, setMember] = useState("");

  function addMember() {
    const name = member.trim();
    if (!name || prefs.familyMembers.includes(name)) return;
    setMember("");
    void savePrefs({ familyMembers: [...prefs.familyMembers, name], parentalOn: true });
  }

  return (
    <SettingsStack>
      <SettingsCard title={t("settingsUi.security.signIn")}>
        <SettingRow icon={Mail} title={t("profile.email")} description={user?.email || t("profile.emailGuest")} />
        <SettingRow icon={KeyRound} title={t("settings.loginVia")} description={user?.provider || "guest"} />
        <div className="px-4 py-3.5 sm:px-5">
          <SignOutButton />
        </div>
      </SettingsCard>

      <SettingsCard title={t("settings.safety")}>
        <SettingRow title={t("settings.strictSafety")} description={t("settings.strictSafetyHint")}>
          <Switch
            label={t("settings.strictSafety")}
            checked={prefs.safetyStrict}
            busy={savingKeys.has("safetyStrict")}
            onChange={(v) => void savePrefs({ safetyStrict: v })}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={t("profile.parental")} description={t("profile.parentalLong")}>
        <SettingRow title={t("profile.parentalToggle")} description={t("profile.parentalBody")}>
          <Switch
            label={t("profile.parentalToggle")}
            checked={prefs.parentalOn}
            busy={savingKeys.has("parentalOn")}
            onChange={(v) => void savePrefs({ parentalOn: v })}
          />
        </SettingRow>
        <div className="px-4 py-3.5 sm:px-5">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addMember();
            }}
          >
            <input
              value={member}
              onChange={(e) => setMember(e.target.value)}
              placeholder={t("profile.familyNamePh")}
              aria-label={t("profile.familyNamePh")}
              maxLength={40}
              className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 text-[15px] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted)]"
            />
            <ActionButton type="submit" icon={Plus} disabled={!member.trim()} loading={savingKeys.has("familyMembers")}>
              <span className="max-[359px]:sr-only">{t("profile.addFamily")}</span>
            </ActionButton>
          </form>
          {prefs.familyMembers.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {prefs.familyMembers.map((m) => (
                <li
                  key={m}
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] ps-3.5 pe-1 text-[14px] text-[var(--fg)]"
                >
                  <span className="max-w-[12rem] truncate">{m}</span>
                  <button
                    type="button"
                    aria-label={`${t("common.delete")} ${m}`}
                    onClick={() => void savePrefs({ familyMembers: prefs.familyMembers.filter((x) => x !== m) })}
                    className="grid h-7 w-7 place-items-center rounded-full text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--danger)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard title={t("profile.ageVerify")}>
        <SettingRow
          icon={CheckCircle2}
          title={prefs.ageVerified ? t("profile.ageVerified") : t("profile.ageNotVerified")}
          description={t("profile.ageHint")}
          stacked={!prefs.ageVerified}
        >
          {prefs.ageVerified ? (
            <Badge tone="success">18+</Badge>
          ) : (
            <ActionButton
              variant="secondary"
              loading={savingKeys.has("ageVerified")}
              onClick={() => void savePrefs({ ageVerified: true })}
              className="w-full sm:w-auto"
            >
              {t("profile.ageConfirm")}
            </ActionButton>
          )}
        </SettingRow>
      </SettingsCard>
    </SettingsStack>
  );
}

export function AboutSection() {
  const { t } = useI18n();
  const toast = useToast();
  const [bug, setBug] = useState("");

  function sendBug() {
    const text = bug.trim();
    if (!text) return;
    try {
      const list = JSON.parse(localStorage.getItem("nj_bug_reports") || "[]") as string[];
      list.push(`${new Date().toISOString()}: ${text}`);
      localStorage.setItem("nj_bug_reports", JSON.stringify(list));
      setBug("");
      toast.success(t("settings.bugThanks"));
    } catch {
      toast.error(t("common.requestFailed"));
    }
  }

  return (
    <SettingsStack>
      <div className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <BrandMark size="lg" tile />
        <div className="min-w-0">
          <p className="font-display text-[18px] font-semibold text-[var(--fg)]">ChatGem</p>
          <p className="mt-0.5 text-[13px] leading-snug text-[var(--fg-muted)]">{t("settings.infoBody")}</p>
          <p className="mt-1 text-[12px] tabular-nums text-[var(--fg-subtle)]">
            {t("settingsUi.about.version")} {APP_VERSION}
          </p>
        </div>
      </div>

      <SettingsCard title={t("settings.report")} description={t("settingsUi.about.bugHint")}>
        <div className="px-4 py-3.5 sm:px-5">
          <textarea
            value={bug}
            onChange={(e) => setBug(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={t("settings.bugPh")}
            aria-label={t("settings.report")}
            className="min-h-[7rem] w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] leading-relaxed text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted)]"
          />
          <div className="mt-3 flex justify-end">
            <ActionButton onClick={sendBug} disabled={!bug.trim()} className="w-full sm:w-auto">
              {t("settings.sendBug")}
            </ActionButton>
          </div>
        </div>
      </SettingsCard>
    </SettingsStack>
  );
}
