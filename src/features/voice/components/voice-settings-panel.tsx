"use client";

import { useSyncExternalStore } from "react";
import { useI18n } from "@/components/i18n/locale-provider";
import { VOICE_LANGUAGES } from "@/lib/voice/languages";
import { cn } from "@/lib/utils";
import { VOICE_SPEEDS, updateVoiceSettings, useVoiceSettings } from "@/features/voice/voice-settings";
import { Segmented, SelectField, SettingRow, Switch } from "@/features/settings/controls";

const noopSubscribe = () => () => undefined;

/** iOS ignores `audio.volume` — only the hardware buttons change loudness. */
function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function VoiceSettingsPanel({ className }: { className?: string }) {
  const { t } = useI18n();
  const s = useVoiceSettings();
  const appleMobile = useSyncExternalStore(noopSubscribe, isAppleMobile, () => false);

  return (
    <div className={cn("divide-y divide-[var(--border)]", className)}>
      <SettingRow title={t("voiceMode.set.replies")} description={t("voiceMode.set.repliesHint")}>
        <Switch
          label={t("voiceMode.set.replies")}
          checked={s.spokenReplies}
          onChange={(v) => updateVoiceSettings({ spokenReplies: v })}
        />
      </SettingRow>
      <SettingRow title={t("voiceMode.set.autoListen")} description={t("voiceMode.set.autoListenHint")}>
        <Switch
          label={t("voiceMode.set.autoListen")}
          checked={s.autoListen}
          onChange={(v) => updateVoiceSettings({ autoListen: v })}
        />
      </SettingRow>
      <SettingRow title={t("voiceMode.set.interrupt")} description={t("voiceMode.set.interruptHint")}>
        <Switch
          label={t("voiceMode.set.interrupt")}
          checked={s.interrupt}
          onChange={(v) => updateVoiceSettings({ interrupt: v })}
        />
      </SettingRow>

      <SettingRow title={t("voiceMode.set.speaker")} description={t("voiceMode.set.speakerHint")} stacked>
        <Segmented
          label={t("voiceMode.set.speaker")}
          value={s.speaker || "unset"}
          options={[
            { value: "woman", label: t("voiceMode.speakerWoman") },
            { value: "man", label: t("voiceMode.speakerMan") },
          ]}
          onChange={(v) => updateVoiceSettings({ speaker: v === "woman" || v === "man" ? v : "" })}
        />
      </SettingRow>

      <SettingRow title={t("voiceMode.set.speed")} stacked>
        <Segmented
          label={t("voiceMode.set.speed")}
          value={String(s.speed)}
          options={VOICE_SPEEDS.map((speed) => ({ value: String(speed), label: `${speed}×` }))}
          onChange={(v) => updateVoiceSettings({ speed: Number(v) as (typeof VOICE_SPEEDS)[number] })}
        />
      </SettingRow>

      <SettingRow
        title={t("voiceMode.set.volume")}
        description={appleMobile ? t("voiceMode.set.volumeIos") : undefined}
        htmlFor="voice-volume"
        stacked
        disabled={appleMobile}
      >
        <div className="flex items-center gap-3">
          <input
            id="voice-volume"
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(s.volume * 100)}
            disabled={appleMobile}
            onChange={(e) => updateVoiceSettings({ volume: Number(e.target.value) / 100 })}
            className="h-2 min-w-0 flex-1 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed"
          />
          <span className="w-10 text-end text-[13px] tabular-nums text-[var(--fg-muted)]">
            {Math.round(s.volume * 100)}%
          </span>
        </div>
      </SettingRow>

      <SettingRow
        title={t("voiceMode.set.language")}
        description={t("voiceMode.set.languageHint")}
        htmlFor="voice-language"
        stacked
      >
        <SelectField id="voice-language" value={s.language} onChange={(v) => updateVoiceSettings({ language: v })}>
          <option value="auto">{t("voiceMode.langAuto")}</option>
          {VOICE_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
              {l.native !== l.english ? ` — ${l.english}` : ""}
            </option>
          ))}
        </SelectField>
      </SettingRow>
    </div>
  );
}
