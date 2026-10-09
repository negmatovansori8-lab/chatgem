import { NextResponse } from "next/server";
import { z } from "zod";
import { baseLocale } from "@/lib/voice-locale";
import { toSpeakable } from "@/lib/voice/speech-text";
import { createRateLimiter } from "@/server/rate-limit";
import { VoiceError, getVoiceStack, transcribeSpeech, voiceStatus } from "@/services/voice";

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Legacy single-shot voice API (chat dictation + "read aloud"). New code should
 * use /api/voice/transcribe and /api/voice/speech; both share @/services/voice.
 */
const limited = createRateLimiter(60);

const ttsSchema = z.object({
  action: z.literal("tts"),
  text: z.string().min(1).max(8000),
  locale: z.string().optional(),
  voice: z.string().max(24).optional(),
  speaker: z.enum(["woman", "man"]).optional(),
});

function failure(err: unknown, fallback: string) {
  const e = err instanceof VoiceError ? err : null;
  if (e?.code === "not_configured") {
    return NextResponse.json(
      { configured: false, message: "OPENAI_API_KEY or GROQ_API_KEY required for voice." },
      { status: 503 },
    );
  }
  const status = e?.code === "rate_limit" ? 429 : e?.code === "bad_request" ? 400 : 502;
  return NextResponse.json({ error: { message: e ? `${fallback} (${e.code})` : fallback } }, { status });
}

export async function GET() {
  const s = voiceStatus();
  return NextResponse.json({
    configured: s.stt.available || s.tts.available,
    hasOpenAI: s.tts.available,
    stt: s.stt.provider ?? "none",
    tts: s.tts.provider,
    multilingual: s.stt.available,
  });
}

async function handleTts(body: unknown) {
  const parsed = ttsSchema.safeParse(body);
  if (!parsed.success) return failure(new VoiceError("bad_request"), "Invalid TTS request");
  const input = toSpeakable(parsed.data.text).slice(0, 4000);
  if (!input) return failure(new VoiceError("bad_request"), "Empty speech text");

  const { tts } = getVoiceStack();
  if (!tts) return failure(new VoiceError("not_configured"), "TTS unavailable");
  try {
    const audio = await tts.synthesize({
      text: input,
      language: baseLocale(parsed.data.locale),
      voice: parsed.data.voice,
      speaker: parsed.data.speaker,
    });
    const buf = Buffer.from(await new Response(audio.body).arrayBuffer());
    return NextResponse.json({
      configured: true,
      provider: `openai-tts/${audio.model}`,
      mimeType: audio.mimeType,
      audioBase64: buf.toString("base64"),
    });
  } catch (err) {
    return failure(err, "TTS failed");
  }
}

async function handleStt(form: FormData) {
  const file = form.get("audio");
  if (!(file instanceof Blob) || file.size < 200) {
    return failure(new VoiceError("bad_request"), "Audio missing or too short");
  }
  const locale = String(form.get("locale") || "en");
  try {
    const result = await transcribeSpeech({
      audio: file,
      filename: file instanceof File && file.name ? file.name : "audio.webm",
      language: locale,
      uiLocale: locale,
    });
    if (!result.text) return failure(new VoiceError("upstream"), "Speech recognition failed");
    return NextResponse.json({ configured: true, provider: result.provider, text: result.text, language: result.language });
  } catch (err) {
    return failure(err, "Speech recognition failed");
  }
}

export async function POST(request: Request) {
  if (limited(request, "legacy")) return failure(new VoiceError("rate_limit"), "Too many voice requests");

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return failure(new VoiceError("bad_request"), "Invalid form data");
    if (String(form.get("action") || "stt") === "stt") return handleStt(form);
    return failure(new VoiceError("bad_request"), "Unknown multipart action");
  }

  const body: unknown = await request.json().catch(() => null);
  if ((body as { action?: string } | null)?.action === "tts") return handleTts(body);
  return failure(new VoiceError("bad_request"), "Unknown action");
}
