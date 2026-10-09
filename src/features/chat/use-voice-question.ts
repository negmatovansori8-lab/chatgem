"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceQuestionState = "idle" | "listening" | "transcribing";

export type VoiceQuestionError = "unsupported" | "insecure" | "denied" | "no_mic" | "no_speech" | "stt_failed";

/** Safety cap only. A finished question ends on silence, not on this timer. */
const MAX_LISTEN_MS = 60_000;
/** After the person stops talking, start the work. */
const SILENCE_AFTER_SPEECH_MS = 700;
/** If nobody speaks at all, don't sit on the mic. */
const NO_SPEECH_MS = 8_000;
const MIN_RECORD_MS = 350;
/** RMS level treated as speech (0..1, after the noise floor). */
const SPEECH_RMS = 0.02;

/**
 * Tap once → listen until the person stops talking → server STT → text.
 * Audio is sent only to our /api/voice proxy; nothing is stored.
 */
export function useVoiceQuestion(locale: string) {
  const [state, setState] = useState<VoiceQuestionState>("idle");
  const [level, setLevel] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cancelRef.current?.(), []);

  const stop = useCallback(() => stopRef.current?.(), []);

  const start = useCallback(
    async (onText: (text: string) => void, onError: (e: VoiceQuestionError, detail?: string) => void) => {
      if (stopRef.current) return;
      if (typeof window !== "undefined" && !window.isSecureContext) return onError("insecure");
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        return onError("unsupported");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
          return onError("denied");
        }
        if (name === "NotFoundError" || name === "OverconstrainedError") return onError("no_mic");
        return onError("unsupported");
      }

      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const AudioCtx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = AudioCtx ? new AudioCtx() : null;
      void ctx?.resume().catch(() => undefined);
      const analyser = ctx?.createAnalyser();
      if (ctx && analyser) {
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
      }
      const samples = new Float32Array(analyser?.fftSize ?? 0);

      const startedAt = performance.now();
      let heardSpeech = false;
      let lastLoud = startedAt;
      let noiseFloor = 0;
      let raf = 0;
      let cancelled = false;

      const cleanup = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((tr) => tr.stop());
        void ctx?.close().catch(() => undefined);
        stopRef.current = null;
        cancelRef.current = null;
        setLevel(0);
      };

      const finish = () => {
        if (rec.state === "recording") rec.stop();
        else cleanup();
      };

      const tick = () => {
        const now = performance.now();
        const elapsed = now - startedAt;
        if (analyser) {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const s of samples) sum += s * s;
          const rms = Math.sqrt(sum / samples.length);
          if (elapsed < 300) noiseFloor = Math.max(noiseFloor, rms);
          const loud = rms > Math.max(SPEECH_RMS, noiseFloor * 2.5);
          if (loud) {
            heardSpeech = true;
            lastLoud = now;
          }
          // Quantised so the chat re-renders a few times per second, not every frame.
          setLevel(Math.round(Math.min(1, rms * 12) * 5) / 5);
        }
        const quietLongEnough = heardSpeech && now - lastLoud > SILENCE_AFTER_SPEECH_MS && elapsed > MIN_RECORD_MS;
        const nobodySpoke = !heardSpeech && elapsed > NO_SPEECH_MS;
        if (quietLongEnough || nobodySpoke || elapsed >= MAX_LISTEN_MS) {
          finish();
          return;
        }
        raf = requestAnimationFrame(tick);
      };

      rec.onstop = () => {
        const hadSpeech = heardSpeech || !analyser;
        cleanup();
        if (cancelled) {
          setState("idle");
          return;
        }
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (!hadSpeech || blob.size < 1_500) {
          setState("idle");
          onError("no_speech");
          return;
        }
        setState("transcribing");
        void (async () => {
          try {
            const form = new FormData();
            form.append("action", "stt");
            form.append("locale", locale || "tg");
            form.append("audio", blob, (rec.mimeType || "").includes("mp4") ? "speech.m4a" : "speech.webm");
            const res = await fetch("/api/voice", { method: "POST", body: form });
            const data = (await res.json().catch(() => ({}))) as {
              text?: string;
              error?: { message?: string };
              message?: string;
            };
            if (!res.ok) return onError("stt_failed", data.error?.message || data.message);
            const text = (data.text || "").trim();
            if (!text) return onError("no_speech");
            onText(text);
          } catch {
            onError("stt_failed");
          } finally {
            setState("idle");
          }
        })();
      };

      stopRef.current = finish;
      cancelRef.current = () => {
        cancelled = true;
        finish();
      };
      rec.start(250);
      setState("listening");
      raf = requestAnimationFrame(tick);
    },
    [locale],
  );

  return { state, level, start, stop };
}
