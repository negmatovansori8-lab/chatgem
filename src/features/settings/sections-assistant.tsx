"use client";

import { useEffect, useState } from "react";
import { AudioLines, BookOpen, Cpu, LayoutGrid, LocateFixed, Map as MapIcon } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { VoiceSettingsPanel } from "@/features/voice/components/voice-settings-panel";
import { useSettingsData } from "@/features/settings/settings-data";
import { usePrefsDraft } from "@/features/settings/use-draft";
import {
  Badge,
  LinkRow,
  SaveBar,
  SettingRow,
  SettingsCard,
  SettingsStack,
  Skeleton,
  Switch,
  TextField,
} from "@/features/settings/controls";

type GeoState = PermissionState | "unsupported" | "unknown";

function useGeoPermission(): GeoState {
  const [state, setState] = useState<GeoState>(() =>
    typeof navigator !== "undefined" && "permissions" in navigator ? "unknown" : "unsupported",
  );
  useEffect(() => {
    if (!("permissions" in navigator)) return;
    let status: PermissionStatus | null = null;
    const onChange = () => status && setState(status.state);
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((s) => {
        status = s;
        setState(s.state);
        s.addEventListener("change", onChange);
      })
      .catch(() => setState("unsupported"));
    return () => status?.removeEventListener("change", onChange);
  }, []);
  return state;
}

export function LocationCard() {
  const { t } = useI18n();
  const geo = useGeoPermission();
  const badge =
    geo === "granted" ? (
      <Badge tone="success">{t("settingsUi.location.granted")}</Badge>
    ) : geo === "denied" ? (
      <Badge tone="warn">{t("settingsUi.location.denied")}</Badge>
    ) : geo === "prompt" ? (
      <Badge>{t("settingsUi.location.prompt")}</Badge>
    ) : geo === "unsupported" ? (
      <Badge>{t("settingsUi.location.unknown")}</Badge>
    ) : null;
  return (
    <SettingsCard title={t("settingsUi.location.title")}>
      <SettingRow
        icon={LocateFixed}
        title={t("settingsUi.location.status")}
        description={geo === "denied" ? t("settingsUi.location.deniedHint") : t("settingsUi.location.hint")}
      >
        {badge ?? <Skeleton className="h-6 w-20 rounded-full" />}
      </SettingRow>
    </SettingsCard>
  );
}

export function ChatSection() {
  const { t } = useI18n();
  const { prefs, savePrefs, savingKeys } = useSettingsData();
  const draft = usePrefsDraft(["customStyle"] as const);

  return (
    <SettingsStack>
      <SettingsCard title={t("profile.customStyle")} description={t("profile.customStyleHint")}>
        <TextField
          label={t("settingsUi.chat.instructions")}
          value={draft.value("customStyle")}
          onChange={(v) => draft.set("customStyle", v)}
          placeholder={t("profile.customStylePlaceholder")}
          multiline
          maxLength={1500}
        />
        <SaveBar
          dirty={draft.dirty}
          saving={draft.saving}
          onSave={() => void draft.save()}
          onReset={draft.reset}
          saveLabel={t("common.save")}
          resetLabel={t("common.cancel")}
          hint={draft.dirty ? t("settingsUi.unsaved") : undefined}
        />
      </SettingsCard>

      <SettingsCard title={t("settingsUi.chat.replies")}>
        <SettingRow title={t("settings.voiceShort")} description={t("settingsUi.chat.shortHint")}>
          <Switch
            label={t("settings.voiceShort")}
            checked={prefs.voicePrefer}
            busy={savingKeys.has("voicePrefer")}
            onChange={(v) => void savePrefs({ voicePrefer: v })}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={t("sidebar.plugins")}>
        <SettingRow title={t("settings.permissions")} description={t("settings.permissionsHint")}>
          <Switch
            label={t("settings.permissions")}
            checked={prefs.pluginLowRisk}
            busy={savingKeys.has("pluginLowRisk")}
            onChange={(v) => void savePrefs({ pluginLowRisk: v })}
          />
        </SettingRow>
        <LinkRow icon={LayoutGrid} title={t("profile.openPlugins")} description={t("profile.pluginsHint")} href="/app/tools" />
      </SettingsCard>
    </SettingsStack>
  );
}

type ModelInfo = { id: string; name: string; providerName?: string; configured: boolean };

function ModelsCard() {
  const { t } = useI18n();
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/models", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { models?: ModelInfo[] }) => {
        if (!cancelled) setModels(data.models ?? []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsCard title={t("settingsUi.ai.models")} description={t("settingsUi.ai.modelsHint")}>
      {failed ? (
        <p className="px-4 py-4 text-[13px] text-[var(--fg-subtle)] sm:px-5">{t("common.requestFailed")}</p>
      ) : !models ? (
        <div className="space-y-3 px-4 py-4 sm:px-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      ) : !models.length ? (
        <p className="px-4 py-4 text-[13px] text-[var(--fg-subtle)] sm:px-5">{t("settingsUi.ai.noModels")}</p>
      ) : (
        models.map((m) => (
          <SettingRow key={m.id} icon={Cpu} title={m.name} description={m.providerName}>
            {m.configured ? (
              <Badge tone="success">{t("settingsUi.ai.ready")}</Badge>
            ) : (
              <Badge>{t("settingsUi.ai.off")}</Badge>
            )}
          </SettingRow>
        ))
      )}
    </SettingsCard>
  );
}

export function AiSection() {
  const { t } = useI18n();
  const { memoryOn, memoryCount, memoryBusy, setMemory } = useSettingsData();
  const draft = usePrefsDraft(["nickname", "profession", "aboutYou"] as const);

  return (
    <SettingsStack>
      <SettingsCard title={t("settingsUi.ai.aboutYou")} description={t("settingsUi.ai.aboutYouHint")}>
        <TextField
          label={t("profile.nickname")}
          value={draft.value("nickname")}
          onChange={(v) => draft.set("nickname", v)}
          placeholder={t("profile.nicknamePh")}
          maxLength={60}
        />
        <TextField
          label={t("profile.profession")}
          value={draft.value("profession")}
          onChange={(v) => draft.set("profession", v)}
          placeholder={t("profile.professionPh")}
          maxLength={80}
        />
        <TextField
          label={t("profile.aboutYou")}
          value={draft.value("aboutYou")}
          onChange={(v) => draft.set("aboutYou", v)}
          placeholder={t("profile.aboutYouPh")}
          multiline
          maxLength={1000}
        />
        <SaveBar
          dirty={draft.dirty}
          saving={draft.saving}
          onSave={() => void draft.save()}
          onReset={draft.reset}
          saveLabel={t("common.save")}
          resetLabel={t("common.cancel")}
          hint={draft.dirty ? t("settingsUi.unsaved") : undefined}
        />
      </SettingsCard>

      <SettingsCard title={t("memory.title")} description={t("profile.memoryHint")}>
        <SettingRow title={t("settingsUi.ai.memoryToggle")} description={t("settingsUi.ai.memoryToggleHint")}>
          <Switch
            label={t("settingsUi.ai.memoryToggle")}
            checked={memoryOn}
            busy={memoryBusy}
            onChange={(v) => void setMemory(v)}
          />
        </SettingRow>
        <LinkRow
          icon={BookOpen}
          title={t("profile.manageMemory")}
          value={`${memoryCount} ${t("profile.memoryItems")}`}
          href="/app/memory"
        />
      </SettingsCard>

      <ModelsCard />
    </SettingsStack>
  );
}

export function VoiceSection() {
  const { t } = useI18n();
  return (
    <SettingsStack>
      <SettingsCard>
        <LinkRow
          icon={AudioLines}
          title={t("voiceMode.set.open")}
          description={t("settings.voiceHint")}
          href="/app/chat?voice=1"
        />
      </SettingsCard>
      <SettingsCard title={t("voiceMode.set.title")}>
        <VoiceSettingsPanel />
      </SettingsCard>
    </SettingsStack>
  );
}

export function MapsSection() {
  const { t } = useI18n();
  return (
    <SettingsStack>
      <SettingsCard>
        <LinkRow icon={MapIcon} title={t("settingsUi.maps.open")} description={t("settingsUi.maps.openHint")} href="/app/maps" />
      </SettingsCard>
      <LocationCard />
    </SettingsStack>
  );
}
