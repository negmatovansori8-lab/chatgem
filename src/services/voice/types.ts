/**
 * Provider-agnostic voice interfaces. Keys live only in server env vars;
 * swapping OpenAI for another vendor = one new class + a line in ./index.ts.
 */

export type VoiceErrorCode =
  | "not_configured"
  | "bad_request"
  | "too_large"
  | "rate_limit"
  | "timeout"
  | "upstream"
  | "network";

export class VoiceError extends Error {
  constructor(
    readonly code: VoiceErrorCode,
    message?: string,
  ) {
    super(message || code);
    this.name = "VoiceError";
  }
}

export const VOICE_HTTP_STATUS: Record<VoiceErrorCode, number> = {
  not_configured: 503,
  bad_request: 400,
  too_large: 413,
  rate_limit: 429,
  timeout: 504,
  upstream: 502,
  network: 502,
};

export type TranscribeInput = {
  audio: Blob;
  filename: string;
  /** ISO-639-1; omitted = let the model detect the language. */
  language?: string;
  /** Vocabulary / style hint for the recognizer. */
  prompt?: string;
  signal?: AbortSignal;
};

export type TranscribeResult = {
  text: string;
  /** Provider's own language guess, when it reports one. */
  language?: string;
  model: string;
};

export interface SpeechToTextProvider {
  readonly id: string;
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}

export type SynthesizeInput = {
  text: string;
  /** ISO-639-1 of the text — drives voice choice and pronunciation. */
  language: string;
  voice?: string;
  /** Match the listener: a woman hears a woman, a man hears a man. */
  speaker?: "woman" | "man";
  signal?: AbortSignal;
};

export type SynthesizeResult = {
  /** Audio bytes as they arrive from the provider (streamed to the browser). */
  body: ReadableStream<Uint8Array>;
  mimeType: string;
  model: string;
};

export interface TextToSpeechProvider {
  readonly id: string;
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
}

export type VoiceStack = {
  stt: SpeechToTextProvider[];
  tts: TextToSpeechProvider | null;
};
