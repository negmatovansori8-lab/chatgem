"use client";

import { voiceLanguage } from "@/lib/voice/languages";
import { apiErrorCode, timeoutSignal, type VoiceErrorCode } from "@/features/voice/voice-errors";

/** Shortest valid WAV — played inside the user's tap to unlock audio on iOS. */
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
const PREFETCH = 2;

type Item = {
  text: string;
  language: string;
  url?: string;
  loading?: Promise<void>;
  abort?: AbortController;
  /** Server TTS failed for this chunk → read it with the device voice. */
  device?: boolean;
};

export type PlayerState = "idle" | "loading" | "speaking" | "paused";

export type SpeechPlayerEvents = {
  onState?: (state: PlayerState) => void;
  /** Everything queued so far has been spoken. */
  onDrained?: () => void;
  /** A chunk could not be spoken at all (no server TTS and no device voice). */
  onError?: (code: VoiceErrorCode) => void;
};

function voiceGender(voice: SpeechSynthesisVoice): "woman" | "man" | "" {
  const n = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  if (/female|woman|\bf\b|irina|zira|susan|samantha|victoria|anna|natasha|milena|helena/.test(n)) return "woman";
  if (/male|\bm\b|dmitry|david|pavel|daniel|george|yuri|mark|guy/.test(n)) return "man";
  return "";
}

function pickDeviceVoice(language: string, speaker: "" | "woman" | "man"): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const lang = voiceLanguage(language);
  const tags = [lang?.bcp47, lang?.browserFallback].filter(Boolean) as string[];
  const pool: SpeechSynthesisVoice[] = [];
  for (const tag of tags) {
    const base = tag.split("-")[0]!;
    pool.push(
      ...voices.filter(
        (v) => v.lang.toLowerCase() === tag.toLowerCase() || v.lang.toLowerCase().startsWith(base),
      ),
    );
  }
  if (speaker) {
    const match = pool.find((v) => voiceGender(v) === speaker);
    if (match) return match;
  }
  return pool[0];
}

/**
 * Speaks answer chunks in order. Server TTS audio for the next chunks is
 * fetched while the current one plays, so speech flows without gaps.
 */
export class SpeechPlayer {
  private readonly audio: HTMLAudioElement | null;
  private queue: Item[] = [];
  private current: Item | null = null;
  private state: PlayerState = "idle";
  private rate = 1;
  private volume = 1;
  private speaker: "" | "woman" | "man" = "";
  private deviceOnly = false;
  private destroyed = false;
  private generation = 0;

  constructor(private readonly events: SpeechPlayerEvents = {}) {
    this.audio = typeof Audio !== "undefined" ? new Audio() : null;
    if (this.audio) {
      this.audio.preload = "auto";
      this.audio.setAttribute("playsinline", "");
      this.audio.onended = () => {
        if (this.current && !this.current.device && this.audio?.src === this.current.url) this.advance();
      };
      this.audio.onerror = () => {
        // Undecodable audio: read this chunk with the device voice instead.
        if (this.current && !this.current.device && this.audio?.src.startsWith("blob:")) {
          this.current.device = true;
          this.playCurrent();
        }
      };
    }
  }

  /** Call synchronously from the user's tap (iOS / Safari autoplay rules). */
  unlock() {
    if (this.audio) {
      this.audio.src = SILENT_WAV;
      this.audio.volume = 0.01;
      void this.audio.play().catch(() => undefined);
    }
    try {
      const synth = window.speechSynthesis;
      if (synth) {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        synth.speak(u);
      }
    } catch {
      // device voices unavailable
    }
  }

  /** Server has no TTS configured → use the device's voices only. */
  useDeviceVoices(on: boolean) {
    this.deviceOnly = on;
  }

  setRate(rate: number) {
    this.rate = rate;
    if (this.audio) this.audio.playbackRate = rate;
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.audio && this.state !== "idle") this.audio.volume = volume;
  }

  setSpeaker(speaker: "" | "woman" | "man") {
    this.speaker = speaker;
  }

  get busy() {
    return this.state !== "idle" || this.queue.length > 0;
  }

  get paused() {
    return this.state === "paused";
  }

  enqueue(text: string, language: string) {
    if (this.destroyed || !text.trim()) return;
    this.queue.push({ text, language, device: this.deviceOnly });
    this.prefetch();
    if (!this.current) this.advance();
  }

  pause() {
    if (this.state !== "speaking" && this.state !== "loading") return;
    if (this.current?.device) window.speechSynthesis?.pause();
    else this.audio?.pause();
    this.setState("paused");
  }

  resume() {
    if (this.state !== "paused") return;
    const item = this.current;
    if (!item) {
      this.setState("idle");
      return;
    }
    const synth = window.speechSynthesis;
    if (item.device && synth?.paused) {
      synth.resume();
      this.setState("speaking");
    } else if (!item.device && this.audio && item.url && this.audio.src === item.url) {
      this.setState("speaking");
      void this.audio.play().catch(() => this.advance());
    } else {
      this.setState("loading");
      this.playCurrent();
    }
  }

  /** Stop speaking and forget everything queued. */
  stop() {
    this.generation += 1;
    for (const item of [...this.queue, ...(this.current ? [this.current] : [])]) this.release(item);
    this.queue = [];
    this.current = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
    this.setState("idle");
  }

  destroy() {
    this.stop();
    this.destroyed = true;
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
    }
  }

  private setState(state: PlayerState) {
    if (this.state === state) return;
    this.state = state;
    this.events.onState?.(state);
  }

  private release(item: Item) {
    item.abort?.abort();
    if (item.url) URL.revokeObjectURL(item.url);
    item.url = undefined;
  }

  private prefetch() {
    const upcoming = [this.current, ...this.queue].filter(Boolean).slice(0, PREFETCH + 1) as Item[];
    for (const item of upcoming) {
      if (!item.device && !item.url && !item.loading) item.loading = this.load(item);
    }
  }

  private async load(item: Item) {
    const gen = this.generation;
    item.abort = new AbortController();
    const timeout = timeoutSignal(30_000, item.abort.signal);
    try {
      const res = await fetch("/api/voice/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: item.text,
          language: item.language,
          ...(this.speaker ? { speaker: this.speaker } : {}),
        }),
        signal: timeout.signal,
      });
      if (!res.ok || !(res.headers.get("content-type") || "").startsWith("audio/")) {
        const data = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
        const code = apiErrorCode(res.status, data.error?.code);
        if (code === "not_configured") this.deviceOnly = true;
        throw new Error(code);
      }
      const blob = await res.blob();
      if (gen !== this.generation) return;
      item.url = URL.createObjectURL(blob);
    } catch {
      if (gen !== this.generation || item.abort?.signal.aborted) return;
      item.device = true;
    } finally {
      timeout.clear();
      item.loading = undefined;
    }
  }

  private advance() {
    if (this.current) this.release(this.current);
    this.current = this.queue.shift() ?? null;
    if (!this.current) {
      this.setState("idle");
      this.events.onDrained?.();
      return;
    }
    this.prefetch();
    this.playCurrent();
  }

  private playCurrent() {
    const item = this.current;
    if (!item) return;
    const gen = this.generation;

    if (item.device) {
      this.speakWithDevice(item, gen);
      return;
    }
    if (!item.url) {
      this.setState(this.state === "paused" ? "paused" : "loading");
      const pending = item.loading ?? (item.loading = this.load(item));
      void pending.then(() => {
        if (gen === this.generation && this.current === item && this.state !== "paused") this.playCurrent();
      });
      return;
    }
    if (!this.audio) {
      item.device = true;
      this.speakWithDevice(item, gen);
      return;
    }
    if (this.state === "paused") return;
    this.audio.src = item.url;
    this.audio.playbackRate = this.rate;
    this.audio.volume = this.volume;
    this.setState("speaking");
    void this.audio.play().catch(() => {
      if (gen !== this.generation) return;
      item.device = true;
      this.speakWithDevice(item, gen);
    });
  }

  private speakWithDevice(item: Item, gen: number) {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) {
      this.events.onError?.("tts_failed");
      this.advance();
      return;
    }
    if (this.state === "paused") return;
    const u = new SpeechSynthesisUtterance(item.text);
    const voice = pickDeviceVoice(item.language, this.speaker);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? voiceLanguage(item.language)?.bcp47 ?? "en-US";
    u.rate = this.rate;
    u.volume = this.volume;
    u.onend = () => {
      if (gen === this.generation && this.current === item) this.advance();
    };
    u.onerror = (e) => {
      if (gen !== this.generation || this.current !== item) return;
      if (e.error !== "interrupted" && e.error !== "canceled") this.events.onError?.("tts_failed");
      this.advance();
    };
    this.setState("speaking");
    synth.speak(u);
  }
}
