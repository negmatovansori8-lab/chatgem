import { NextResponse } from "next/server";

export async function POST() {
  const configured =
    process.env.VOICE_PROVIDERS_CONFIGURED === "true" &&
    Boolean(process.env.OPENAI_API_KEY || process.env.DEEPGRAM_API_KEY);

  if (!configured) {
    return NextResponse.json({
      configured: false,
      message:
        "Voice AI is not configured. Set VOICE_PROVIDERS_CONFIGURED=true and a STT/TTS provider key. Pipeline UI is ready without fake audio.",
    });
  }

  return NextResponse.json({
    configured: true,
    message: "Voice provider flag detected. Connect STT/TTS adapters next.",
  });
}
