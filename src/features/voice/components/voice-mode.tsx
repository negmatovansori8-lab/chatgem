"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Square,
  X,
} from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { voiceLanguage } from "@/lib/voice/languages";
import { cn } from "@/lib/utils";
import { VoiceOrb } from "@/features/voice/components/voice-orb";
import { VoiceSettingsPanel } from "@/features/voice/components/voice-settings-panel";
import { updateVoiceSettings } from "@/features/voice/voice-settings";
import type { useVoiceConversation } from "@/features/voice/use-voice-conversation";
import type { VoicePhase } from "@/features/voice/voice-engine";
import { VOICE_ERROR_KEYS } from "@/features/voice/voice-errors";

type Conversation = ReturnType<typeof useVoiceConversation>;

const STATUS_KEYS: Record<VoicePhase, string> = {
  idle: "voiceMode.tapToStart",
  connecting: "voiceMode.connecting",
  listening: "voiceMode.listening",
  hearing: "voiceMode.hearing",
  transcribing: "voiceMode.transcribing",
  thinking: "voiceMode.thinking",
  speaking: "voiceMode.speaking",
  paused: "voiceMode.paused",
  ready: "voiceMode.ready",
  standby: "voiceMode.standby",
  error: "voiceMode.error",
};

function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  return <span className="tabular-nums">{formatElapsed(now - since)}</span>;
}

function RoundButton({
  label,
  onClick,
  children,
  tone = "muted",
  size = "md",
  disabled,
  pressed,
  autoFocus,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "muted" | "primary" | "danger" | "active";
  size?: "md" | "lg" | "sm";
  disabled?: boolean;
  pressed?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      autoFocus={autoFocus}
      onClick={onClick}
      className={cn(
        "grid shrink-0 place-items-center rounded-full transition active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
        size === "lg" ? "h-[4.5rem] w-[4.5rem]" : size === "sm" ? "h-10 w-10" : "h-14 w-14",
        tone === "primary" && "bg-[var(--pill)] text-[var(--pill-fg)] shadow-lg hover:opacity-90",
        tone === "danger" && "bg-[var(--danger)] text-white hover:opacity-90",
        tone === "active" && "bg-[var(--fg)] text-[var(--surface)]",
        tone === "muted" && "bg-[var(--surface-2)] text-[var(--fg)] hover:bg-[var(--surface-3)]",
      )}
    >
      {children}
    </button>
  );
}

function PillButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-4 text-[13px] font-medium text-[var(--fg)] transition hover:bg-[var(--surface-3)] active:scale-95"
    >
      {children}
    </button>
  );
}

export function VoiceMode({
  conversation,
  onClose,
}: {
  conversation: Conversation;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { engine, snapshot: s, settings } = conversation;
  const [minimized, setMinimized] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const captionsRef = useRef<HTMLDivElement>(null);

  const busy = s.phase === "connecting" || s.phase === "transcribing";
  const replying = s.phase === "thinking" || s.phase === "speaking" || s.phase === "paused";

  useEffect(() => {
    const el = captionsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.aiText, s.userText]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (settingsOpen) setSettingsOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, settingsOpen]);

  const languageLabel = s.language
    ? (voiceLanguage(s.language)?.native ?? s.language)
    : settings.language === "auto"
      ? t("voiceMode.langAuto")
      : (voiceLanguage(settings.language)?.native ?? settings.language);

  const mainLabel =
    s.phase === "hearing"
      ? t("voiceMode.send")
      : replying
        ? t("voiceMode.interrupt")
        : s.phase === "listening"
          ? t("voiceMode.pause")
          : t("voiceMode.talk");

  const mainIcon = busy ? (
    <Loader2 className="h-7 w-7 animate-spin" />
  ) : s.phase === "hearing" ? (
    <ArrowUp className="h-7 w-7" strokeWidth={2.5} />
  ) : s.phase === "listening" ? (
    <Pause className="h-7 w-7 fill-current" />
  ) : (
    <Mic className="h-7 w-7" strokeWidth={2} />
  );

  const statusText = s.muted && (s.phase === "listening" || s.phase === "hearing") ? t("voiceMode.muted") : t(STATUS_KEYS[s.phase]);
  const noticeText = s.notice ? t(s.notice === "no_speech" ? "voiceMode.err.noSpeech" : VOICE_ERROR_KEYS[s.notice]) : null;

  const contextual =
    s.phase === "hearing" ? (
      <PillButton onClick={engine.cancelUtterance}>
        <X className="h-4 w-4" />
        {t("voiceMode.cancel")}
      </PillButton>
    ) : s.phase === "speaking" || s.phase === "paused" ? (
      <>
        {s.phase === "paused" ? (
          <PillButton onClick={engine.resume}>
            <Play className="h-4 w-4 fill-current" />
            {t("voiceMode.resume")}
          </PillButton>
        ) : (
          <PillButton onClick={engine.pause}>
            <Pause className="h-4 w-4 fill-current" />
            {t("voiceMode.pause")}
          </PillButton>
        )}
        <PillButton onClick={engine.stopSpeaking}>
          <Square className="h-3.5 w-3.5 fill-current" />
          {t("voiceMode.stopSpeaking")}
        </PillButton>
      </>
    ) : null;

  if (minimized) {
    return (
      <div
        role="region"
        aria-label={t("voiceMode.title")}
        className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-[70] mx-auto flex max-w-lg items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-2 pe-2.5 shadow-2xl backdrop-blur"
      >
        <button type="button" onClick={engine.tap} aria-label={mainLabel} className="shrink-0 rounded-full">
          <VoiceOrb engine={engine} phase={s.phase} muted={s.muted} size="sm" />
        </button>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="truncate text-[13px] font-semibold text-[var(--fg)]">
            {s.phase === "error" && s.error ? t(VOICE_ERROR_KEYS[s.error]) : statusText}
            {s.phase === "hearing" && s.since ? (
              <span className="ms-1.5 font-normal text-[var(--fg-subtle)]">
                <Elapsed since={s.since} />
              </span>
            ) : null}
          </p>
          <p className="truncate text-[12px] text-[var(--fg-subtle)]">{noticeText ?? (s.aiText || s.userText || languageLabel)}</p>
        </div>
        <RoundButton size="sm" label={s.muted ? t("voiceMode.unmute") : t("voiceMode.mute")} pressed={s.muted} tone={s.muted ? "active" : "muted"} onClick={engine.toggleMute}>
          {s.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </RoundButton>
        <RoundButton size="sm" label={t("voiceMode.expand")} onClick={() => setMinimized(false)}>
          <Maximize2 className="h-4 w-4" />
        </RoundButton>
        <RoundButton size="sm" tone="danger" label={t("voiceMode.end")} onClick={onClose}>
          <X className="h-4 w-4" />
        </RoundButton>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("voiceMode.title")}
      className="cg-voice-screen fixed inset-0 z-[70] flex h-[100dvh] flex-col overflow-hidden text-[var(--fg)]"
    >
      <header className="flex items-center justify-between gap-2 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-5">
        <RoundButton size="sm" label={t("voiceMode.minimize")} onClick={() => setMinimized(true)}>
          <ChevronDown className="h-5 w-5" />
        </RoundButton>
        <div className="flex min-w-0 flex-col items-center">
          <p className="text-[15px] font-semibold">{t("voiceMode.title")}</p>
          <p className="truncate text-[12px] text-[var(--fg-subtle)]">{languageLabel}</p>
        </div>
        <RoundButton size="sm" label={t("voiceMode.settings")} onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-5 w-5" />
        </RoundButton>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-5">
        <button
          type="button"
          onClick={engine.tap}
          disabled={busy}
          aria-label={mainLabel}
          className="rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]"
        >
          <VoiceOrb engine={engine} phase={s.phase} muted={s.muted} />
        </button>

        <div className="flex items-center gap-2" role="group" aria-label={t("voiceMode.set.speaker")}>
          {(["woman", "man"] as const).map((who) => (
            <button
              key={who}
              type="button"
              aria-pressed={settings.speaker === who}
              onClick={() => updateVoiceSettings({ speaker: who })}
              className={cn(
                "min-h-10 rounded-full px-4 text-[13px] font-semibold transition active:scale-95",
                settings.speaker === who
                  ? "bg-[var(--pill)] text-[var(--pill-fg)]"
                  : "bg-[var(--surface-2)] text-[var(--fg)] hover:bg-[var(--surface-3)]",
              )}
            >
              {t(who === "woman" ? "voiceMode.speakerWoman" : "voiceMode.speakerMan")}
            </button>
          ))}
        </div>
        {!settings.speaker ? (
          <p className="max-w-sm text-center text-[12.5px] text-[var(--fg-muted)]">{t("voiceMode.set.speakerHint")}</p>
        ) : null}

        <div className="flex min-h-[3.25rem] flex-col items-center gap-1 text-center" aria-live="polite">
          <p className="text-[17px] font-semibold">
            {statusText}
            {s.phase === "hearing" && s.since ? (
              <span className="ms-2 font-normal text-[var(--fg-subtle)]">
                <Elapsed since={s.since} />
              </span>
            ) : null}
          </p>
          <p className="text-[13px] text-[var(--fg-subtle)]">
            {s.phase === "idle"
              ? t("voiceMode.tagline")
              : s.phase === "hearing"
                ? t("voiceMode.hintSend")
                : replying && settings.interrupt
                  ? t("voiceMode.hintInterrupt")
                  : "\u00a0"}
          </p>
        </div>

        {s.phase === "error" && s.error ? (
          <div role="alert" className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-center">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-[var(--danger)]" />
            <p className="text-[14px] font-medium">{t(VOICE_ERROR_KEYS[s.error])}</p>
            {s.error === "mic_denied" ? (
              <p className="mt-1 text-[12px] text-[var(--fg-subtle)]">{t("voiceMode.err.micDeniedHelp")}</p>
            ) : null}
            <button
              type="button"
              onClick={engine.start}
              className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--pill)] px-4 text-[13px] font-semibold text-[var(--pill-fg)]"
            >
              <RotateCcw className="h-4 w-4" />
              {t("voiceMode.retry")}
            </button>
          </div>
        ) : null}

        {s.userText || s.aiText ? (
          <div
            ref={captionsRef}
            className="max-h-[26dvh] w-full max-w-xl space-y-2 overflow-y-auto overscroll-contain text-center [mask-image:linear-gradient(to_bottom,transparent,black_18%)]"
          >
            {s.userText ? (
              <p className="pt-4 text-[14px] text-[var(--fg-subtle)]">
                <span className="font-medium">{t("voiceMode.you")}:</span> {s.userText}
              </p>
            ) : null}
            {s.aiText ? <p className="whitespace-pre-line text-[16px] leading-relaxed sm:text-[17px]">{s.aiText}</p> : null}
          </div>
        ) : null}
      </main>

      <footer className="flex flex-col items-center gap-4 px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3">
        <div className="flex min-h-10 flex-wrap items-center justify-center gap-2">
          {noticeText ? (
            <p role="status" className="rounded-full bg-[var(--surface-2)] px-4 py-2 text-[13px] text-[var(--fg-muted)]">
              {noticeText}
            </p>
          ) : (
            contextual
          )}
        </div>
        <div className="flex items-center justify-center gap-6 sm:gap-8">
          <RoundButton
            label={s.muted ? t("voiceMode.unmute") : t("voiceMode.mute")}
            pressed={s.muted}
            tone={s.muted ? "active" : "muted"}
            onClick={engine.toggleMute}
          >
            {s.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </RoundButton>
          <RoundButton size="lg" tone="primary" label={mainLabel} disabled={busy} onClick={engine.tap} autoFocus>
            {mainIcon}
          </RoundButton>
          <RoundButton tone="danger" label={t("voiceMode.end")} onClick={onClose}>
            <X className="h-6 w-6" />
          </RoundButton>
        </div>
      </footer>

      {settingsOpen ? (
        <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center" role="presentation">
          <button
            type="button"
            aria-label={t("voiceMode.close")}
            className="absolute inset-0 bg-black/45"
            onClick={() => setSettingsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("voiceMode.set.title")}
            className="cg-voice-sheet relative max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-[var(--surface)] pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4 shadow-2xl sm:max-w-md sm:rounded-3xl"
          >
            <div className="mb-1 flex items-center justify-between px-5">
              <p className="text-[17px] font-semibold">{t("voiceMode.set.title")}</p>
              <RoundButton size="sm" label={t("voiceMode.close")} onClick={() => setSettingsOpen(false)}>
                <X className="h-5 w-5" />
              </RoundButton>
            </div>
            <VoiceSettingsPanel />
          </div>
        </div>
      ) : null}
    </div>
  );
}
