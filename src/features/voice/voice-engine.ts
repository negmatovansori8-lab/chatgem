"use client";

import { SentenceChunker, toSpeakable } from "@/lib/voice/speech-text";
import { Microphone, createAudioContext, voiceSupport, type UtteranceRecorder } from "@/features/voice/microphone";
import { NORMAL_DETECTOR, STRICT_DETECTOR, SpeechDetector } from "@/features/voice/speech-detector";
import { SpeechPlayer, type PlayerState } from "@/features/voice/speech-player";
import { fetchVoiceStatus, transcribeAudio } from "@/features/voice/transcribe";
import { FATAL_VOICE_ERRORS, VoiceClientError, type VoiceErrorCode } from "@/features/voice/voice-errors";
import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from "@/features/voice/voice-settings";

export type VoicePhase =
  | "idle"
  | "connecting"
  /** Mic open, waiting for the user to talk. */
  | "listening"
  /** The user is talking (recording an utterance). */
  | "hearing"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "paused"
  /** Mic open but not listening (auto-listen off) — tap to talk. */
  | "ready"
  /** Mic released after inactivity / tab hidden — tap to continue. */
  | "standby"
  | "error";

export type VoiceNotice = VoiceErrorCode | "no_speech";

export type VoiceSnapshot = {
  phase: VoicePhase;
  /** Fatal error (conversation stopped). */
  error: VoiceErrorCode | null;
  /** Transient problem; the conversation continues. */
  notice: VoiceNotice | null;
  muted: boolean;
  userText: string;
  aiText: string;
  /** Language of the conversation (detected or chosen). */
  language: string | null;
  /** performance.now() when the current utterance started. */
  since: number | null;
};

export type AskHandlers = {
  /** Full answer text so far (called as it streams). */
  onText: (full: string) => void;
  onError: (message: string) => void;
};

export type VoiceEngineDeps = {
  /** Send the question through the chat; resolves when the answer is complete. */
  ask: (text: string, language: string, handlers: AskHandlers) => Promise<void>;
  /** Abort the answer that is still being generated. */
  stopAnswer: () => void;
  /** Current UI locale (fallback language). */
  locale: () => string;
};

const TICK_MS = 40;
const MAX_UTTERANCE_MS = 60_000;
const RECORDER_ROLL_MS = 20_000;
const IDLE_STANDBY_MS = 60_000;
const MIN_SPEECH_MS = 250;
const MIN_AUDIO_BYTES = 1200;
const LISTEN_DELAY_MS = 300;
const NOTICE_MS = 4500;

const ACTIVE: ReadonlySet<VoicePhase> = new Set([
  "connecting",
  "listening",
  "hearing",
  "transcribing",
  "thinking",
  "speaking",
  "paused",
  "ready",
]);
const REPLYING: ReadonlySet<VoicePhase> = new Set(["thinking", "speaking", "paused"]);

const INITIAL: VoiceSnapshot = {
  phase: "idle",
  error: null,
  notice: null,
  muted: false,
  userText: "",
  aiText: "",
  language: null,
  since: null,
};

/**
 * Continuous voice conversation: listen (VAD) → transcribe → ask the chat →
 * speak the streaming answer sentence by sentence → listen again.
 * Talking over the assistant interrupts it.
 */
export class VoiceEngine {
  private snap: VoiceSnapshot = INITIAL;
  private readonly listeners = new Set<() => void>();
  private settings: VoiceSettings = DEFAULT_VOICE_SETTINGS;
  private ctx: AudioContext | null = null;
  private mic: Microphone | null = null;
  private recorder: UtteranceRecorder | null = null;
  private readonly detector = new SpeechDetector();
  private readonly player: SpeechPlayer;
  private loop: ReturnType<typeof setInterval> | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private listenTimer: ReturnType<typeof setTimeout> | null = null;
  private sttAbort: AbortController | null = null;
  private listenStartedAt = 0;
  private turn = 0;
  private silencedTurn = -1;
  private answerDone = true;
  private lastAnswer = "";
  private answerLanguage = "en";
  private chunker = new SentenceChunker();
  private deps: VoiceEngineDeps = {
    ask: () => Promise.reject(new Error("not connected")),
    stopAnswer: () => undefined,
    locale: () => "en",
  };

  constructor() {
    this.player = new SpeechPlayer({
      onState: (s) => this.onPlayerState(s),
      onDrained: () => this.onPlayerDrained(),
      onError: (code) => this.notify(code),
    });
  }

  // ── external store ──────────────────────────────────────────────
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snap;

  private set(patch: Partial<VoiceSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Smoothed mic loudness 0..1 for the UI. */
  level() {
    return this.mic?.level() ?? 0;
  }

  frequencies(out: Uint8Array<ArrayBuffer>) {
    this.mic?.frequencies(out);
  }

  /** Latest chat callbacks (updated every render by the hook). */
  setDeps(deps: VoiceEngineDeps) {
    this.deps = deps;
  }

  applySettings(settings: VoiceSettings) {
    const turnedOffReplies = this.settings.spokenReplies && !settings.spokenReplies;
    this.settings = settings;
    this.player.setRate(settings.speed);
    this.player.setVolume(settings.volume);
    this.player.setSpeaker(settings.speaker);
    if (turnedOffReplies && this.player.busy) this.stopSpeaking();
  }

  // ── user actions ────────────────────────────────────────────────

  /** Must run inside the user's tap (unlocks audio on iOS / Safari). */
  start = () => {
    if (ACTIVE.has(this.snap.phase)) return;
    const support = voiceSupport();
    if (support !== "ok") return this.fail(support);

    this.ctx ??= createAudioContext();
    if (!this.ctx) return this.fail("unsupported");
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
    this.player.unlock();

    this.set({ phase: "connecting", error: null, notice: null, since: null });
    void this.connect();
  };

  /** The big center button. */
  tap = () => {
    switch (this.snap.phase) {
      case "idle":
      case "standby":
      case "error":
        return this.start();
      case "ready":
        return this.listen();
      case "listening":
        return this.pauseListening();
      case "hearing":
        return void this.finishUtterance(false);
      case "thinking":
      case "speaking":
      case "paused":
        return this.interrupt(false);
      default:
        return;
    }
  };

  /** Discard what is being recorded and stop listening. */
  cancelUtterance = () => {
    if (this.snap.phase !== "hearing" && this.snap.phase !== "listening") return;
    this.pauseListening();
  };

  toggleMute = () => {
    const muted = !this.snap.muted;
    this.mic?.setMuted(muted);
    this.set({ muted });
    if (!muted) this.detector.calibrate();
    if (muted && this.snap.phase === "hearing") this.listen();
  };

  pause = () => this.player.pause();

  resume = () => this.player.resume();

  /** Stop reading the current answer aloud (its text still arrives in the chat). */
  stopSpeaking = () => {
    this.silencedTurn = this.turn;
    this.player.stop();
    if (!REPLYING.has(this.snap.phase)) return;
    if (this.answerDone) this.afterReply();
    else this.set({ phase: "thinking" });
  };

  /** End the conversation and release the microphone. */
  end = () => {
    this.turn += 1;
    this.sttAbort?.abort();
    this.player.stop();
    this.release();
    this.clearNotice();
    this.set({ ...INITIAL, muted: this.snap.muted, userText: this.snap.userText, aiText: this.snap.aiText });
  };

  /** Tab hidden / app backgrounded: don't keep the mic open for nothing. */
  onHidden = () => {
    const p = this.snap.phase;
    if (p === "listening" || p === "ready" || p === "hearing") this.standby();
  };

  // ── pipeline ────────────────────────────────────────────────────

  private async connect() {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const [status, mic] = await Promise.all([fetchVoiceStatus(), Microphone.open(ctx)]);
      if (this.snap.phase !== "connecting") {
        mic.close();
        return;
      }
      if (status && !status.stt.available) {
        mic.close();
        return this.fail("not_configured");
      }
      this.player.useDeviceVoices(Boolean(status && !status.tts.available));
      mic.setMuted(this.snap.muted);
      this.mic = mic;
      this.detector.calibrate();
      this.loop = setInterval(this.onTick, TICK_MS);
      this.listen();
    } catch (err) {
      if (this.snap.phase !== "connecting") return;
      this.fail(err instanceof VoiceClientError ? err.code : "unsupported");
    }
  }

  private listen() {
    if (!this.mic) return;
    this.clearListenTimer();
    this.recorder?.cancel();
    try {
      this.recorder = this.mic.record();
    } catch {
      return this.fail("unsupported");
    }
    this.detector.setConfig(NORMAL_DETECTOR);
    this.detector.reset();
    this.listenStartedAt = performance.now();
    this.set({ phase: "listening", since: null });
  }

  private pauseListening() {
    this.recorder?.cancel();
    this.recorder = null;
    this.detector.reset();
    this.listenStartedAt = performance.now();
    this.set({ phase: "ready", since: null });
  }

  private onTick = () => {
    const mic = this.mic;
    if (!mic) return;
    if (mic.lost) return this.fail("mic_busy");

    const rms = mic.rms();
    const phase = this.snap.phase;
    if (phase === "ready" && performance.now() - this.listenStartedAt > IDLE_STANDBY_MS) return this.standby();
    const detecting =
      !this.snap.muted &&
      (phase === "listening" ||
        phase === "hearing" ||
        (this.settings.interrupt && (phase === "thinking" || phase === "speaking")));
    if (!detecting) return;

    const now = performance.now();
    const event = this.detector.push(rms, now);

    if (phase === "listening") {
      if (event === "speech-start") {
        this.set({ phase: "hearing", since: now - this.detector.speechDuration(now) });
        return;
      }
      if (now - this.listenStartedAt > IDLE_STANDBY_MS) return this.standby();
      // Keep silent recordings small: start a fresh file while nobody talks.
      if (this.recorder && now - this.recorder.startedAt > RECORDER_ROLL_MS && rms < this.detector.threshold()) {
        this.recorder.cancel();
        this.recorder = mic.record();
      }
      return;
    }

    if (phase === "hearing") {
      if (event === "speech-end") void this.finishUtterance(true);
      else if (this.detector.speechDuration(now) > MAX_UTTERANCE_MS) void this.finishUtterance(false);
      return;
    }

    if (event === "speech-start") this.interrupt(true);
  };

  private async finishUtterance(endedBySilence: boolean) {
    const rec = this.recorder;
    this.recorder = null;
    if (!rec) return this.listen();

    const since = this.snap.since ?? performance.now();
    const spokenMs = performance.now() - since - (endedBySilence ? NORMAL_DETECTOR.endSilenceMs : 0);
    this.set({ phase: "transcribing", since: null });

    const blob = await rec.stop();
    if (this.snap.phase !== "transcribing") return;
    if (spokenMs < MIN_SPEECH_MS || blob.size < MIN_AUDIO_BYTES) return this.listen();
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.notify("network");
      return this.listen();
    }

    const abort = new AbortController();
    this.sttAbort = abort;
    try {
      const result = await transcribeAudio(blob, {
        language: this.settings.language,
        hint: this.snap.language ?? undefined,
        locale: this.deps.locale(),
        signal: abort.signal,
      });
      if (abort.signal.aborted || this.snap.phase !== "transcribing") return;
      if (result.empty) {
        this.notify("no_speech");
        return this.listen();
      }
      const language =
        this.settings.language !== "auto"
          ? this.settings.language
          : result.language || this.snap.language || this.deps.locale();
      this.askAI(result.text, language);
    } catch (err) {
      if (abort.signal.aborted) return;
      const code = err instanceof VoiceClientError ? err.code : "stt_failed";
      if (FATAL_VOICE_ERRORS.has(code)) return this.fail(code);
      this.notify(code);
      this.listen();
    } finally {
      if (this.sttAbort === abort) this.sttAbort = null;
    }
  }

  private askAI(text: string, language: string) {
    const turn = ++this.turn;
    this.chunker = new SentenceChunker();
    this.answerDone = false;
    this.lastAnswer = "";
    this.answerLanguage = language;
    this.detector.setConfig(NORMAL_DETECTOR);
    this.detector.reset();
    this.set({ phase: "thinking", userText: text, aiText: "", language });

    const handlers: AskHandlers = {
      onText: (full) => {
        if (turn === this.turn) this.onAnswerText(full, false);
      },
      onError: () => {
        if (turn === this.turn) this.notify("ai_failed");
      },
    };

    this.deps
      .ask(text, language, handlers)
      .catch(() => {
        if (turn === this.turn) this.notify("ai_failed");
      })
      .finally(() => {
        if (turn !== this.turn) return;
        this.answerDone = true;
        this.onAnswerText(this.lastAnswer, true);
        if (!this.player.busy && REPLYING.has(this.snap.phase)) this.afterReply();
      });
  }

  private onAnswerText(full: string, final: boolean) {
    this.lastAnswer = full;
    const caption = toSpeakable(full);
    if (caption !== this.snap.aiText) this.set({ aiText: caption });
    if (!this.settings.spokenReplies || this.silencedTurn === this.turn) return;

    const { chunks, reset } = this.chunker.update(full, final);
    if (reset) this.player.stop();
    for (const chunk of chunks) this.player.enqueue(chunk, this.answerLanguage);
  }

  private onPlayerState(state: PlayerState) {
    if (!REPLYING.has(this.snap.phase)) return;
    if (state === "speaking") {
      this.detector.setConfig(STRICT_DETECTOR);
      this.detector.reset();
      if (this.snap.phase !== "speaking") this.set({ phase: "speaking" });
    } else if (state === "paused") {
      this.set({ phase: "paused" });
    } else if (state === "loading" && this.snap.phase === "paused") {
      this.set({ phase: "speaking" });
    }
  }

  private onPlayerDrained() {
    if (!REPLYING.has(this.snap.phase)) return;
    this.detector.setConfig(NORMAL_DETECTOR);
    this.detector.reset();
    if (this.answerDone) this.afterReply();
    else this.set({ phase: "thinking" });
  }

  private afterReply() {
    if (!this.mic) return;
    if (!this.settings.autoListen) {
      this.pauseListening();
      return;
    }
    // Let the speaker's echo die down before listening again.
    const turn = this.turn;
    this.clearListenTimer();
    this.listenTimer = setTimeout(() => {
      if (turn === this.turn && REPLYING.has(this.snap.phase)) this.listen();
    }, LISTEN_DELAY_MS);
  }

  /** Stop the assistant (voice + generation) and listen to the user. */
  private interrupt(byVoice: boolean) {
    this.turn += 1;
    this.player.stop();
    if (!this.answerDone) this.deps.stopAnswer();
    this.answerDone = true;
    this.clearListenTimer();
    if (!byVoice || !this.mic) return this.listen();

    // The user is already talking — record right away, keep the detector's state.
    this.recorder?.cancel();
    try {
      this.recorder = this.mic.record();
    } catch {
      return this.fail("unsupported");
    }
    this.detector.setConfig(NORMAL_DETECTOR);
    this.set({ phase: "hearing", since: performance.now() });
  }

  private standby() {
    this.sttAbort?.abort();
    this.release();
    this.set({ phase: "standby", since: null });
  }

  private fail(code: VoiceErrorCode) {
    if (!FATAL_VOICE_ERRORS.has(code) && this.mic) {
      this.notify(code);
      return;
    }
    this.turn += 1;
    this.sttAbort?.abort();
    this.player.stop();
    this.release();
    this.set({ phase: "error", error: code, since: null });
  }

  private notify(code: VoiceNotice) {
    this.clearNotice();
    this.set({ notice: code });
    this.noticeTimer = setTimeout(() => this.set({ notice: null }), NOTICE_MS);
  }

  private clearNotice() {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = null;
  }

  private clearListenTimer() {
    if (this.listenTimer) clearTimeout(this.listenTimer);
    this.listenTimer = null;
  }

  /** Stop recording, close the mic (browser indicator goes off) and audio graph. */
  private release() {
    this.clearListenTimer();
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    this.recorder?.cancel();
    this.recorder = null;
    this.mic?.close();
    this.mic = null;
    this.detector.reset();
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
  }
}
