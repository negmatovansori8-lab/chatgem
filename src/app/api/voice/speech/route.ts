import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeLanguage } from "@/lib/voice/languages";
import { toSpeakable } from "@/lib/voice/speech-text";
import { createRateLimiter } from "@/server/rate-limit";
import { buildDownloadName, contentDisposition } from "@/lib/downloads/filename";
import { MAX_SPEECH_CHARS, VOICE_HTTP_STATUS, VoiceError, getVoiceStack } from "@/services/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

const limited = createRateLimiter(120);

const bodySchema = z.object({
  text: z.string().min(1).max(8000),
  language: z.string().max(16).optional(),
  voice: z.string().max(24).optional(),
  speaker: z.enum(["woman", "man"]).optional(),
  /** Save as a file: adds `Content-Disposition: attachment` with this name. */
  downloadName: z.string().max(160).optional(),
});

function voiceError(err: unknown) {
  const e = err instanceof VoiceError ? err : new VoiceError("upstream");
  return NextResponse.json({ error: { code: e.code } }, { status: VOICE_HTTP_STATUS[e.code] });
}

/**
 * Text → speech. The provider's MP3 stream is piped straight to the browser,
 * so playback can begin before synthesis finishes.
 */
export async function POST(request: Request) {
  if (limited(request, "tts")) return voiceError(new VoiceError("rate_limit"));

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return voiceError(new VoiceError("bad_request"));

  const text = toSpeakable(parsed.data.text).slice(0, MAX_SPEECH_CHARS);
  if (!text) return voiceError(new VoiceError("bad_request"));

  const { tts } = getVoiceStack();
  if (!tts) return voiceError(new VoiceError("not_configured"));

  try {
    const audio = await tts.synthesize({
      text,
      language: normalizeLanguage(parsed.data.language) || "en",
      voice: parsed.data.voice,
      speaker: parsed.data.speaker,
      signal: request.signal,
    });
    const headers = new Headers({
      "Content-Type": audio.mimeType,
      "Cache-Control": "no-store",
      "X-Voice-Model": audio.model,
    });
    if (parsed.data.downloadName !== undefined) {
      const name = buildDownloadName({ title: parsed.data.downloadName, mimeType: audio.mimeType });
      headers.set("Content-Disposition", contentDisposition(name));
    }
    return new Response(audio.body, { headers });
  } catch (err) {
    return voiceError(err);
  }
}
