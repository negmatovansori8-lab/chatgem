"use client";

import { useSyncExternalStore } from "react";

export const VOICE_SPEEDS = [0.75, 1, 1.25, 1.5] as const;
export type VoiceSpeed = (typeof VOICE_SPEEDS)[number];

/** Device-level voice preferences (speed/volume differ per phone vs. laptop). */
export type VoiceSettings = {
  /** Speak AI answers aloud. Off = Voice Mode listens and shows text only. */
  spokenReplies: boolean;
  /** Start listening again right after the AI finishes speaking. */
  autoListen: boolean;
  /** Talking over the AI stops it and records the new question. */
  interrupt: boolean;
  speed: VoiceSpeed;
  /** 0..1 */
  volume: number;
  /** "auto" or an ISO-639-1 code. */
  language: string;
  /** How the assistant speaks: matches the person who is talking. */
  speaker: "" | "woman" | "man";
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  spokenReplies: true,
  autoListen: true,
  interrupt: true,
  speed: 1,
  volume: 1,
  language: "auto",
  speaker: "",
};

const KEY = "chatgem:voice-settings";
const listeners = new Set<() => void>();
let cache: VoiceSettings | null = null;

function sanitize(raw: unknown): VoiceSettings {
  const v = (raw && typeof raw === "object" ? raw : {}) as Partial<VoiceSettings>;
  const speed = VOICE_SPEEDS.includes(v.speed as VoiceSpeed) ? (v.speed as VoiceSpeed) : 1;
  const volume = typeof v.volume === "number" && Number.isFinite(v.volume) ? Math.min(1, Math.max(0, v.volume)) : 1;
  const language = typeof v.language === "string" && /^(auto|[a-z]{2,3})$/.test(v.language) ? v.language : "auto";
  const speaker = v.speaker === "woman" || v.speaker === "man" ? v.speaker : "";
  return {
    spokenReplies: typeof v.spokenReplies === "boolean" ? v.spokenReplies : true,
    autoListen: typeof v.autoListen === "boolean" ? v.autoListen : true,
    interrupt: typeof v.interrupt === "boolean" ? v.interrupt : true,
    speed,
    volume,
    language,
    speaker,
  };
}

export function getVoiceSettings(): VoiceSettings {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_VOICE_SETTINGS;
  try {
    cache = sanitize(JSON.parse(window.localStorage.getItem(KEY) || "null"));
  } catch {
    cache = DEFAULT_VOICE_SETTINGS;
  }
  return cache;
}

export function updateVoiceSettings(patch: Partial<VoiceSettings>) {
  cache = sanitize({ ...getVoiceSettings(), ...patch });
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // private mode — keep in memory
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useVoiceSettings(): VoiceSettings {
  return useSyncExternalStore(subscribe, getVoiceSettings, () => DEFAULT_VOICE_SETTINGS);
}
