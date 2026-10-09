/**
 * Providers that answered "no credit" or "bad key" are skipped for a while,
 * so every chat message and image does not first wait for a request that cannot succeed.
 */

const COOLDOWN_MS = 10 * 60_000;

type Store = Map<string, { until: number; reason: string }>;

/** Shared across route bundles in one server process. */
const store: Store = ((globalThis as { __chatgemProviderHealth?: Store }).__chatgemProviderHealth ??= new Map());

/** True for errors that will not go away by retrying: no credit, quota exhausted, invalid key. */
export function isAccountError(status: number, body: string): boolean {
  if (status === 401 || status === 402 || status === 403) return true;
  return /insufficient_quota|credit_balance|billing_hard_limit|billing|invalid_api_key|incorrect api key/i.test(body);
}

export function markProviderDown(provider: string, reason: string): void {
  store.set(provider, { until: Date.now() + COOLDOWN_MS, reason: reason.slice(0, 160) });
  console.warn(`[provider-health] ${provider} paused for ${COOLDOWN_MS / 60_000} min: ${reason.slice(0, 80)}`);
}

export function providerDownReason(provider: string): string | null {
  const entry = store.get(provider);
  if (!entry) return null;
  if (Date.now() > entry.until) {
    store.delete(provider);
    return null;
  }
  return entry.reason;
}

export function isProviderDown(provider: string): boolean {
  return providerDownReason(provider) !== null;
}

/** "openai/gpt-4o" → "openai", "groq/openai/gpt-oss-120b" → "groq". */
export function providerOfModel(modelId: string): string {
  return modelId.split("/")[0] ?? modelId;
}
