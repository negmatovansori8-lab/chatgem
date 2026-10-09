"use client";

import { VoiceClientError, apiErrorCode, fetchErrorCode, timeoutSignal } from "@/features/voice/voice-errors";

export type Transcript = {
  text: string;
  /** Nothing intelligible was said (silence / noise). */
  empty: boolean;
  /** ISO-639-1 code of the spoken language. */
  language: string;
};

export type VoiceServerStatus = {
  stt: { available: boolean; provider: string | null };
  tts: { available: boolean; provider: string; streaming: boolean };
  maxAudioBytes: number;
  maxSpeechChars: number;
};

function extensionFor(mime: string) {
  if (mime.includes("mp4") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

export async function transcribeAudio(
  audio: Blob,
  opts: { language: string; hint?: string; locale: string; signal?: AbortSignal },
): Promise<Transcript> {
  const form = new FormData();
  form.append("audio", audio, `speech.${extensionFor(audio.type)}`);
  form.append("language", opts.language);
  if (opts.hint) form.append("hint", opts.hint);
  form.append("locale", opts.locale);

  const timeout = timeoutSignal(45_000, opts.signal);
  try {
    const res = await fetch("/api/voice/transcribe", { method: "POST", body: form, signal: timeout.signal });
    const data = (await res.json().catch(() => null)) as
      | (Partial<Transcript> & { error?: { code?: string } })
      | null;
    if (!res.ok || !data) {
      const code = apiErrorCode(res.status, data?.error?.code);
      throw new VoiceClientError(code === "server" ? "stt_failed" : code);
    }
    return {
      text: (data.text ?? "").trim(),
      empty: Boolean(data.empty) || !(data.text ?? "").trim(),
      language: data.language || "",
    };
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    throw new VoiceClientError(fetchErrorCode(err));
  } finally {
    timeout.clear();
  }
}

let statusPromise: Promise<VoiceServerStatus | null> | null = null;

export function fetchVoiceStatus(): Promise<VoiceServerStatus | null> {
  statusPromise ??= fetch("/api/voice/status", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<VoiceServerStatus>) : null))
    .catch(() => {
      statusPromise = null;
      return null;
    });
  return statusPromise;
}
