import { NextResponse } from "next/server";
import { z } from "zod";

function openaiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

function voiceEnabled() {
  // Enable whenever a TTS key exists (flag only forces off if set false WITHOUT a key).
  const key = openaiKey() || process.env.DEEPGRAM_API_KEY?.trim();
  if (!key) return false;
  if (process.env.VOICE_PROVIDERS_CONFIGURED === "false") {
    // Still allow TTS when OpenAI is present — otherwise voice looks "broken".
    return Boolean(openaiKey());
  }
  return true;
}

const ttsSchema = z.object({
  action: z.literal("tts"),
  text: z.string().min(1).max(4000),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional(),
});

/**
 * Voice: OpenAI TTS when OPENAI_API_KEY is set.
 * Browser speech recognition is used on the client for STT (no flag required).
 */
export async function GET() {
  return NextResponse.json({
    configured: voiceEnabled(),
    hasOpenAI: Boolean(openaiKey()),
    stt: "browser",
    tts: openaiKey() ? "openai" : "browser",
  });
}

export async function POST(request: Request) {
  if (!voiceEnabled()) {
    return NextResponse.json({
      configured: false,
      message:
        "Voice TTS needs OPENAI_API_KEY (or set VOICE_PROVIDERS_CONFIGURED=true with a key).",
    });
  }

  const key = openaiKey();
  if (!key) {
    return NextResponse.json({
      configured: false,
      message: "OPENAI_API_KEY required for server TTS.",
    });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON" } },
      { status: 400 },
    );
  }

  const parsed = ttsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.message } },
      { status: 400 },
    );
  }

  const { text, voice } = parsed.data;
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text.slice(0, 4000),
      voice: voice ?? "nova",
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return NextResponse.json(
      {
        error: {
          message: `OpenAI TTS failed (${res.status}): ${errText.slice(0, 200)}`,
        },
      },
      { status: 502 },
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return NextResponse.json({
    configured: true,
    provider: "openai-tts",
    mimeType: "audio/mpeg",
    audioBase64: buf.toString("base64"),
  });
}
