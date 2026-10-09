import { NextResponse } from "next/server";
import { voiceLanguage } from "@/lib/voice/languages";
import { createRateLimiter } from "@/server/rate-limit";
import { MAX_AUDIO_BYTES, VOICE_HTTP_STATUS, VoiceError, transcribeSpeech } from "@/services/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

const limited = createRateLimiter(40);

function voiceError(err: unknown) {
  const e = err instanceof VoiceError ? err : new VoiceError("upstream");
  return NextResponse.json({ error: { code: e.code } }, { status: VOICE_HTTP_STATUS[e.code] });
}

function filenameFor(type: string) {
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "speech.m4a";
  if (type.includes("ogg")) return "speech.ogg";
  if (type.includes("wav")) return "speech.wav";
  if (type.includes("mpeg") || type.includes("mp3")) return "speech.mp3";
  return "speech.webm";
}

function code(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return /^(auto|[a-z]{2,3})(-[a-z]{2,4})?$/.test(s) ? s : undefined;
}

/**
 * Browser audio → text (+ detected language). Audio is proxied to the STT
 * provider and never stored.
 */
export async function POST(request: Request) {
  if (limited(request, "stt")) return voiceError(new VoiceError("rate_limit"));

  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_AUDIO_BYTES + 64_000) return voiceError(new VoiceError("too_large"));

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return voiceError(new VoiceError("bad_request"));
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size < 800) return voiceError(new VoiceError("bad_request"));

  try {
    const result = await transcribeSpeech({
      audio,
      filename: filenameFor(audio.type || ""),
      language: code(form.get("language")) ?? "auto",
      hint: code(form.get("hint")),
      uiLocale: code(form.get("locale")),
      signal: request.signal,
    });
    return NextResponse.json({
      text: result.text,
      empty: result.empty,
      language: result.language,
      languageName: voiceLanguage(result.language)?.native ?? result.language,
      provider: result.provider,
    });
  } catch (err) {
    return voiceError(err);
  }
}
