import { isAccountError, markProviderDown } from "@/lib/provider-health";
import { voiceLanguage } from "@/lib/voice/languages";
import { ttsVoiceForLocale, ttsVoiceForSpeaker } from "@/lib/voice-locale";
import {
  VoiceError,
  type SpeechToTextProvider,
  type SynthesizeInput,
  type SynthesizeResult,
  type TextToSpeechProvider,
  type TranscribeInput,
  type TranscribeResult,
} from "@/services/voice/types";

const STT_TIMEOUT_MS = 30_000;
const TTS_TIMEOUT_MS = 30_000;

function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function fromFetchError(err: unknown): VoiceError {
  if (err instanceof VoiceError) return err;
  const name = (err as { name?: string })?.name;
  if (name === "TimeoutError") return new VoiceError("timeout");
  if (name === "AbortError") return new VoiceError("timeout", "aborted");
  return new VoiceError("network", err instanceof Error ? err.message : undefined);
}

/** No credit / bad key: pause the provider so the next request skips it, and report it as unavailable. */
function fromStatus(status: number, detail: string, provider: string): VoiceError {
  if (isAccountError(status, detail)) {
    markProviderDown(provider, `${status}: ${detail}`);
    return new VoiceError("not_configured", detail);
  }
  if (status === 429) return new VoiceError("rate_limit", detail);
  if (status === 413) return new VoiceError("too_large", detail);
  return new VoiceError("upstream", `${status}: ${detail}`);
}

/**
 * OpenAI-compatible `/audio/transcriptions` (OpenAI, Groq…). Models are tried
 * in order; the first usable transcript wins.
 */
export class OpenAICompatibleSpeechToText implements SpeechToTextProvider {
  constructor(
    readonly id: string,
    private readonly apiKey: string,
    private readonly endpoint: string,
    private readonly models: string[],
  ) {}

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    let last: VoiceError = new VoiceError("upstream");
    for (const model of this.models) {
      try {
        return await this.once(model, input, input.language);
      } catch (err) {
        const e = fromFetchError(err);
        // Some models reject a language code ("tg") — retry that model on auto-detect.
        if (e.code === "upstream" && input.language && /language/i.test(e.message)) {
          try {
            return await this.once(model, input, undefined);
          } catch (retryErr) {
            last = fromFetchError(retryErr);
            continue;
          }
        }
        last = e;
        if (e.code === "not_configured" || input.signal?.aborted) throw e;
      }
    }
    throw last;
  }

  private async once(model: string, input: TranscribeInput, language: string | undefined): Promise<TranscribeResult> {
    // Whisper models report the detected language only in verbose_json.
    const verbose = model.includes("whisper");
    const form = new FormData();
    form.append("file", input.audio, input.filename);
    form.append("model", model);
    form.append("response_format", verbose ? "verbose_json" : "json");
    form.append("temperature", "0");
    if (language) form.append("language", language);
    if (input.prompt) form.append("prompt", input.prompt);

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
      signal: withTimeout(STT_TIMEOUT_MS, input.signal),
    });
    if (!res.ok) {
      throw fromStatus(res.status, (await res.text().catch(() => "")).slice(0, 240), this.id);
    }
    const data = (await res.json()) as { text?: string; language?: string };
    return { text: (data.text || "").trim(), language: data.language || language, model };
  }
}

const GPT_TTS_VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse"]);
const CLASSIC_TTS_VOICES = new Set(["alloy", "ash", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer"]);

function speakingInstructions(language: string, speaker?: "woman" | "man"): string {
  const lang = voiceLanguage(language);
  const name = lang ? `${lang.english} (${lang.native})` : language;
  const who =
    speaker === "woman"
      ? "You are a woman speaking to another woman. Use a natural adult female voice."
      : speaker === "man"
        ? "You are a man speaking to another man. Use a natural adult male voice."
        : "Speak like a warm, friendly person in a live conversation.";
  const base = `${who} Speak in ${name}: natural intonation, clear pronunciation, relaxed moderate pace. You may talk about any topic.`;
  if (language === "tg") {
    return `${base} The text is Tajik written in Cyrillic — pronounce it as a native Tajik speaker, not with a Russian accent (ӣ, ӯ, ҳ, ҷ, қ, ғ as in Tajik).`;
  }
  return base;
}

/** OpenAI `/audio/speech`: streams MP3 back as it is generated. */
export class OpenAITextToSpeech implements TextToSpeechProvider {
  readonly id = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly models: string[],
    private readonly defaultVoice?: string,
  ) {}

  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    let last: VoiceError = new VoiceError("upstream");
    for (const model of this.models) {
      const modern = model.startsWith("gpt-");
      const allowed = modern ? GPT_TTS_VOICES : CLASSIC_TTS_VOICES;
      const wanted = input.speaker
        ? ttsVoiceForSpeaker(input.speaker, input.language)
        : input.voice || this.defaultVoice || ttsVoiceForLocale(input.language);
      const voice = allowed.has(wanted) ? wanted : ttsVoiceForSpeaker(input.speaker, input.language);
      try {
        const res = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            input: input.text,
            voice,
            response_format: "mp3",
            ...(modern ? { instructions: speakingInstructions(input.language, input.speaker) } : {}),
          }),
          signal: withTimeout(TTS_TIMEOUT_MS, input.signal),
        });
        if (!res.ok || !res.body) {
          last = fromStatus(res.status, (await res.text().catch(() => "")).slice(0, 240), this.id);
          if (last.code === "not_configured" || last.code === "rate_limit") throw last;
          continue;
        }
        return { body: res.body, mimeType: res.headers.get("content-type") || "audio/mpeg", model };
      } catch (err) {
        last = fromFetchError(err);
        if (last.code === "not_configured" || last.code === "rate_limit" || input.signal?.aborted) throw last;
      }
    }
    throw last;
  }
}
