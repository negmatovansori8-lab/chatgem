"use client";

import { VoiceClientError, micErrorCode } from "@/features/voice/voice-errors";

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * Must be called synchronously inside the user's tap: iOS Safari only lets a
 * context started from a gesture actually run (a suspended one would feed the
 * analyser silence and voice detection would never fire).
 */
export function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

export function voiceSupport(): "ok" | "insecure" | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return "unsupported";
  return "ok";
}

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function recorderMime(): string | undefined {
  return MIME_TYPES.find((m) => MediaRecorder.isTypeSupported?.(m));
}

/** One utterance → one self-contained audio file. */
export class UtteranceRecorder {
  private readonly rec: MediaRecorder;
  private readonly chunks: Blob[] = [];
  private readonly done: Promise<Blob>;
  readonly startedAt = performance.now();

  constructor(stream: MediaStream) {
    const mime = recorderMime();
    this.rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    this.rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.done = new Promise<Blob>((resolve) => {
      this.rec.onstop = () => resolve(new Blob(this.chunks, { type: this.rec.mimeType || mime || "audio/webm" }));
      this.rec.onerror = () => resolve(new Blob([], { type: "audio/webm" }));
    });
    this.rec.start(250);
  }

  get mimeType() {
    return this.rec.mimeType;
  }

  stop(): Promise<Blob> {
    if (this.rec.state !== "inactive") this.rec.stop();
    return this.done;
  }

  cancel() {
    this.rec.ondataavailable = null;
    if (this.rec.state !== "inactive") this.rec.stop();
  }
}

/** Open microphone + analyser for levels, waveform and voice detection. */
export class Microphone {
  private readonly analyser: AnalyserNode;
  private readonly source: MediaStreamAudioSourceNode;
  private readonly timeData: Uint8Array<ArrayBuffer>;
  private smoothed = 0;
  private lastHash = 0;
  private closed = false;

  private constructor(
    readonly stream: MediaStream,
    private readonly ctx: AudioContext,
  ) {
    this.source = ctx.createMediaStreamSource(stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.6;
    this.source.connect(this.analyser);
    this.timeData = new Uint8Array(this.analyser.fftSize);
  }

  static async open(ctx: AudioContext): Promise<Microphone> {
    const support = voiceSupport();
    if (support !== "ok") throw new VoiceClientError(support);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (err) {
      throw new VoiceClientError(micErrorCode(err));
    }
    if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
    return new Microphone(stream, ctx);
  }

  /** Raw RMS of the latest audio frame (0..~0.5). */
  rms(): number {
    if (this.closed) return 0;
    this.analyser.getByteTimeDomainData(this.timeData);
    let sum = 0;
    let hash = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const b = this.timeData[i]!;
      const v = (b - 128) / 128;
      sum += v * v;
      hash = (hash * 31 + b) | 0;
    }
    // A stalled audio graph (device glitch, throttled tab) repeats the last frame
    // forever — count it as silence so an utterance can't stay "open".
    const frozen = hash === this.lastHash;
    this.lastHash = hash;
    const rms = frozen ? 0 : Math.sqrt(sum / this.timeData.length);
    this.smoothed = this.smoothed * 0.7 + Math.min(1, rms * 9) * 0.3;
    return rms;
  }

  /** Smoothed 0..1 loudness for UI (updated by `rms()`). */
  level(): number {
    return this.smoothed;
  }

  /** Frequency magnitudes for the waveform. */
  frequencies(out: Uint8Array<ArrayBuffer>) {
    if (!this.closed) this.analyser.getByteFrequencyData(out);
  }

  get frequencyBinCount() {
    return this.analyser.frequencyBinCount;
  }

  setMuted(muted: boolean) {
    this.stream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  /** The OS / another app took the microphone away. */
  get lost(): boolean {
    return this.stream.getAudioTracks().every((t) => t.readyState === "ended");
  }

  record(): UtteranceRecorder {
    return new UtteranceRecorder(this.stream);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.source.disconnect();
    } catch {
      // already disconnected
    }
    this.stream.getTracks().forEach((t) => t.stop());
  }
}
