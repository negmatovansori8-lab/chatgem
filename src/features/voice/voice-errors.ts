export type VoiceErrorCode =
  | "mic_denied"
  | "no_mic"
  | "mic_busy"
  | "insecure"
  | "unsupported"
  | "network"
  | "timeout"
  | "stt_failed"
  | "ai_failed"
  | "tts_failed"
  | "server"
  | "not_configured"
  | "rate_limit";

/** Errors that end the conversation until the user fixes something. */
export const FATAL_VOICE_ERRORS = new Set<VoiceErrorCode>([
  "mic_denied",
  "no_mic",
  "mic_busy",
  "insecure",
  "unsupported",
  "not_configured",
]);

export class VoiceClientError extends Error {
  constructor(readonly code: VoiceErrorCode) {
    super(code);
    this.name = "VoiceClientError";
  }
}

export function micErrorCode(err: unknown): VoiceErrorCode {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "mic_denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "no_mic";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "mic_busy";
  return "unsupported";
}

/** HTTP status / API error code → client error. */
export function apiErrorCode(status: number, code?: string): VoiceErrorCode {
  if (code === "not_configured" || status === 503) return "not_configured";
  if (code === "rate_limit" || status === 429) return "rate_limit";
  if (code === "timeout" || status === 504) return "timeout";
  if (status >= 500) return "server";
  return "server";
}

export function fetchErrorCode(err: unknown): VoiceErrorCode {
  if (err instanceof VoiceClientError) return err.code;
  const name = (err as { name?: string })?.name;
  if (name === "TimeoutError") return "timeout";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "network";
  return "network";
}

/** Abort after `ms` or when `parent` aborts (AbortSignal.any is missing on older Safari). */
export function timeoutSignal(ms: number, parent?: AbortSignal): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("Timed out", "TimeoutError")), ms);
  const onAbort = () => ctrl.abort(parent?.reason);
  if (parent?.aborted) onAbort();
  else parent?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: ctrl.signal,
    clear: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onAbort);
    },
  };
}

export const VOICE_ERROR_KEYS: Record<VoiceErrorCode, string> = {
  mic_denied: "voiceMode.err.micDenied",
  no_mic: "voiceMode.err.noMic",
  mic_busy: "voiceMode.err.micBusy",
  insecure: "voiceMode.err.insecure",
  unsupported: "voiceMode.err.unsupported",
  network: "voiceMode.err.network",
  timeout: "voiceMode.err.timeout",
  stt_failed: "voiceMode.err.stt",
  ai_failed: "voiceMode.err.ai",
  tts_failed: "voiceMode.err.tts",
  server: "voiceMode.err.server",
  not_configured: "voiceMode.err.notConfigured",
  rate_limit: "voiceMode.err.rateLimit",
};
