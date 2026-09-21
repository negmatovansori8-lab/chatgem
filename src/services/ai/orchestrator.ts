import { detectIntent } from "@/services/ai/router";
import { featureFlags } from "@/config/site";
import { providerRegistry } from "@/providers/ai/types";

export type OrchestratorStatus =
  | "ready"
  | "providers_not_configured"
  | "permission_denied"
  | "usage_exceeded";

export interface OrchestratorResult {
  status: OrchestratorStatus;
  intent: ReturnType<typeof detectIntent>;
  message: string;
}

/**
 * AI Orchestrator skeleton for Phase 1.
 * Pipeline: Intent → Permission → Usage → Router → Tools → Execution
 * No fake completions are returned.
 */
export async function orchestrateUserRequest(input: {
  prompt: string;
  allowed?: boolean;
  usageOk?: boolean;
}): Promise<OrchestratorResult> {
  const intent = detectIntent(input.prompt);

  if (input.allowed === false) {
    return {
      status: "permission_denied",
      intent,
      message: "You do not have permission for this action.",
    };
  }

  if (input.usageOk === false) {
    return {
      status: "usage_exceeded",
      intent,
      message: "Usage limit reached for the current plan.",
    };
  }

  const configured = featureFlags.aiProvidersConfigured && providerRegistry.configured().length > 0;

  if (!configured) {
    return {
      status: "providers_not_configured",
      intent,
      message:
        "AI providers are not configured. Add server-side API keys to enable real responses.",
    };
  }

  return {
    status: "ready",
    intent,
    message: "Request accepted for model execution.",
  };
}
