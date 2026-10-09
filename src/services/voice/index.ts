import { isProviderDown } from "@/lib/provider-health";
import { detectSpokenLanguage, isNoiseTranscript, normalizeLanguage } from "@/lib/voice/languages";
import { whisperLanguage, whisperPrompt } from "@/lib/voice-locale";
import { OpenAICompatibleSpeechToText, OpenAITextToSpeech } from "@/services/voice/openai";
import { VoiceError, type SpeechToTextProvider, type VoiceStack } from "@/services/voice/types";

export { VoiceError, VOICE_HTTP_STATUS } from "@/services/voice/types";

const OPENAI_STT = "https://api.openai.com/v1/audio/transcriptions";
const GROQ_STT = "https://api.groq.com/openai/v1/audio/transcriptions";

function env(name: string): string {
  return process.env[name]?.trim() || "";
}

function list(value: string, fallback: string[]): string[] {
  const items = value.split(",").map((s) => s.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

/**
 * Voice providers from server env (never exposed to the browser):
 * - OPENAI_API_KEY → OpenAI STT + natural TTS
 * - GROQ_API_KEY   → fast Whisper STT (free tier)
 * - VOICE_STT_PROVIDER = auto | openai | groq   (order to try; auto = OpenAI first)
 * - VOICE_TTS_PROVIDER = auto | openai | browser (browser = device voices only)
 */
export function getVoiceStack(): VoiceStack {
  const openaiKey = isProviderDown("openai") ? "" : env("OPENAI_API_KEY");
  const groqKey = isProviderDown("groq") ? "" : env("GROQ_API_KEY");
  const sttPref = env("VOICE_STT_PROVIDER").toLowerCase() || "auto";
  const ttsPref = env("VOICE_TTS_PROVIDER").toLowerCase() || "auto";

  const openaiStt = openaiKey
    ? new OpenAICompatibleSpeechToText(
        "openai",
        openaiKey,
        OPENAI_STT,
        list(env("OPENAI_STT_MODELS"), ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper-1"]),
      )
    : null;
  const groqStt = groqKey
    ? new OpenAICompatibleSpeechToText(
        "groq",
        groqKey,
        GROQ_STT,
        list(env("GROQ_STT_MODELS"), ["whisper-large-v3-turbo", "whisper-large-v3"]),
      )
    : null;

  const order = sttPref === "groq" ? [groqStt, openaiStt] : sttPref === "openai" ? [openaiStt] : [openaiStt, groqStt];
  const stt = order.filter((p): p is OpenAICompatibleSpeechToText => Boolean(p));

  const tts =
    openaiKey && ttsPref !== "browser"
      ? new OpenAITextToSpeech(
          openaiKey,
          list(env("OPENAI_TTS_MODELS"), ["gpt-4o-mini-tts", "tts-1"]),
          env("OPENAI_TTS_VOICE") || undefined,
        )
      : null;

  return { stt, tts };
}

export function voiceStatus() {
  const { stt, tts } = getVoiceStack();
  return {
    stt: { available: stt.length > 0, provider: stt[0]?.id ?? null },
    tts: { available: Boolean(tts), provider: tts?.id ?? "browser", streaming: Boolean(tts) },
    maxAudioBytes: MAX_AUDIO_BYTES,
    maxSpeechChars: MAX_SPEECH_CHARS,
  };
}

export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
export const MAX_SPEECH_CHARS = 1200;

/** Auto-detect prompt: shows the recognizer all three scripts, Tajik letters included. */
const AUTO_PROMPT = "Салом, чӣ хел? Привет, как дела? Hello, how are you?";

export type SpeechTranscript = {
  text: string;
  /** Detected (auto) or requested language, ISO-639-1. */
  language: string;
  provider: string;
  /** True when the audio held no real speech (silence, noise, STT hallucination). */
  empty: boolean;
};

async function firstUsable(
  providers: SpeechToTextProvider[],
  run: (p: SpeechToTextProvider) => Promise<{ text: string; language?: string; model: string }>,
) {
  let last: unknown = new VoiceError("not_configured");
  for (const p of providers) {
    try {
      const r = await run(p);
      return { ...r, provider: `${p.id}/${r.model}` };
    } catch (err) {
      last = err;
      if (err instanceof VoiceError && err.code === "timeout" && err.message === "aborted") throw err;
    }
  }
  throw last;
}

/** Arabic-script output for someone who speaks Tajik = the model picked Persian script. */
function looksLikeMisreadTajik(text: string, providerLang: string | undefined, hints: (string | undefined)[]): boolean {
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const cyrillic = (text.match(/[\u0400-\u04FF]/g) || []).length;
  if (arabic <= cyrillic) return false;
  const lang = normalizeLanguage(providerLang);
  return lang === "tg" || hints.some((h) => normalizeLanguage(h) === "tg");
}

/**
 * Speech → text with language detection.
 * `language: "auto"` lets the model detect it; Tajik gets a second pass in
 * Cyrillic when the first pass comes back in Persian script.
 */
export async function transcribeSpeech(input: {
  audio: Blob;
  filename: string;
  language?: string;
  /** Previous turn's language / UI language — tie-breakers only. */
  hint?: string;
  uiLocale?: string;
  signal?: AbortSignal;
}): Promise<SpeechTranscript> {
  const { stt } = getVoiceStack();
  if (!stt.length) throw new VoiceError("not_configured");
  if (input.audio.size > MAX_AUDIO_BYTES) throw new VoiceError("too_large");

  const manual = input.language && input.language !== "auto" ? whisperLanguage(input.language) : undefined;
  const prompt = manual ? whisperPrompt(manual) : AUTO_PROMPT;

  let result = await firstUsable(stt, (p) =>
    p.transcribe({ audio: input.audio, filename: input.filename, language: manual, prompt, signal: input.signal }),
  );

  if (!manual && looksLikeMisreadTajik(result.text, result.language, [input.hint, input.uiLocale])) {
    try {
      result = await firstUsable(stt, (p) =>
        p.transcribe({
          audio: input.audio,
          filename: input.filename,
          language: "tg",
          prompt: whisperPrompt("tg"),
          signal: input.signal,
        }),
      );
    } catch {
      // keep the first pass
    }
  }

  const text = result.text.replace(/\s+/g, " ").trim();
  const empty = isNoiseTranscript(text, prompt);
  const language = manual
    ? manual
    : detectSpokenLanguage(text, { provider: result.language, fallback: input.hint || input.uiLocale });
  return { text: empty ? "" : text, language, provider: result.provider, empty };
}
