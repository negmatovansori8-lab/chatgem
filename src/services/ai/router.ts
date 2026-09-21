export type RouteIntent =
  | "simple"
  | "reasoning"
  | "coding"
  | "translation"
  | "image"
  | "voice";

export interface RoutingDecision {
  intent: RouteIntent;
  preferredKind: "chat" | "reasoning" | "coding" | "language" | "image" | "speech";
  reason: string;
}

/**
 * Smart Model Router — configurable foundation.
 * Phase 1: intent heuristics only. No fake model calls.
 */
export function detectIntent(prompt: string): RoutingDecision {
  const text = prompt.toLowerCase();

  if (/(image|picture|draw|generate art|расм|тасвир)/i.test(text)) {
    return {
      intent: "image",
      preferredKind: "image",
      reason: "Prompt requests image generation",
    };
  }

  if (/(speak|voice|transcribe|tts|овоз)/i.test(text)) {
    return {
      intent: "voice",
      preferredKind: "speech",
      reason: "Prompt requests speech processing",
    };
  }

  if (/(code|bug|refactor|typescript|python|код|debug)/i.test(text)) {
    return {
      intent: "coding",
      preferredKind: "coding",
      reason: "Prompt looks like a programming task",
    };
  }

  if (/(translate|тарҷума|перевод|ترجمة)/i.test(text)) {
    return {
      intent: "translation",
      preferredKind: "language",
      reason: "Prompt looks like a translation task",
    };
  }

  if (/(why|analyze|reason|compare|strategy|таҳлил)/i.test(text) || text.length > 400) {
    return {
      intent: "reasoning",
      preferredKind: "reasoning",
      reason: "Prompt appears complex or analytical",
    };
  }

  return {
    intent: "simple",
    preferredKind: "chat",
    reason: "Default fast-path chat routing",
  };
}
