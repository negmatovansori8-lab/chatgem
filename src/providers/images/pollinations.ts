import { createHash } from "node:crypto";
import { aspectToSize, type ImageProvider } from "@/providers/images/types";

async function toDataUrl(bytes: ArrayBuffer, mime = "image/jpeg"): Promise<string> {
  const b64 = Buffer.from(bytes).toString("base64");
  return `data:${mime};base64,${b64}`;
}

/** Keep Flux prompts short — long English essays confuse the model. */
const LOGO_LEAD = "minimalist flat vector logo, ";

export function fluxFriendlyPrompt(prompt: string): string {
  if (prompt.startsWith(LOGO_LEAD)) return prompt;
  const cleaned = prompt
    .replace(/\bAvoid:[^.]+/gi, "")
    .replace(/\bno watermark[^.]*\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  // Prefer leading subject clause (before first long guidance)
  const head = cleaned
    .split(/,\s*(?:photorealistic|cinematic|high quality|clean modern|flat vector|logo\b)/i)[0]
    ?.trim();
  const core = (head && head.length >= 3 ? head : cleaned).slice(0, 180);
  // Logos must stay flat graphics — "photorealistic" turns them into photos of people,
  // and Flux scribbles fake lettering unless told the mark is wordless.
  if (/\blogo\b|emblem/i.test(cleaned)) {
    return `${LOGO_LEAD}${core.slice(0, 150)}, simple bold geometric shapes, symmetrical, few solid colors, centered on plain white background, wordless, no text, no letters`;
  }
  return `${core}, photorealistic, sharp detail, correct subject only`.slice(0, 280);
}

/** Server-only secret key (`sk_…`) from enter.pollinations.ai — anonymous generation is rate-limited or refused. */
function apiKey(): string {
  return process.env.POLLINATIONS_API_KEY?.trim() || "";
}

/** With a key, POLLINATIONS_IMAGE_MODEL can pick a stronger model (see gen.pollinations.ai/image/models). */
function model(): string {
  return (apiKey() && process.env.POLLINATIONS_IMAGE_MODEL?.trim()) || "flux";
}

function buildGetUrl(prompt: string, width: number, height: number, seed: number): string {
  const short = encodeURIComponent(prompt);
  const query = `width=${width}&height=${height}&nologo=true&model=${encodeURIComponent(model())}&seed=${seed}`;
  return apiKey()
    ? `https://gen.pollinations.ai/image/${short}?${query}`
    : `https://image.pollinations.ai/prompt/${short}?${query}`;
}

/**
 * When out of quota the service can answer 200 with a stock picture. The same bytes for a
 * different prompt is that placeholder, never the requested image.
 */
const seenImages = new Map<string, string>();

function isPlaceholder(bytes: ArrayBuffer, prompt: string): boolean {
  const hash = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  const previous = seenImages.get(hash);
  if (previous !== undefined && previous !== prompt) return true;
  if (seenImages.size > 500) seenImages.clear();
  seenImages.set(hash, prompt);
  return false;
}

export const POLLINATIONS_KEY_HINT =
  "Pollinations needs a free API key: create one at enter.pollinations.ai/keys and set POLLINATIONS_API_KEY in .env";

async function fetchImage(
  url: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<{ ok: true; url: string } | { ok: false; detail: string; status?: number }> {
  const timeout = AbortSignal.timeout(60_000);
  const key = apiKey();
  const res = await fetch(url, {
    headers: {
      Accept: "image/*",
      "User-Agent": "ChatGem/1.0",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    redirect: "follow",
  });
  if (res.status === 401 || res.status === 402) {
    await res.body?.cancel();
    return {
      ok: false,
      detail: key
        ? `Pollinations HTTP ${res.status}: the API key is invalid or its pollen budget is used up`
        : POLLINATIONS_KEY_HINT,
      status: res.status,
    };
  }
  if (!res.ok) {
    await res.body?.cancel();
    return { ok: false, detail: `Pollinations HTTP ${res.status}`, status: res.status };
  }
  const ctype = res.headers.get("content-type") || "";
  if (!/^image\//i.test(ctype)) {
    await res.body?.cancel();
    return { ok: false, detail: `Pollinations bad content-type: ${ctype}` };
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 2500) return { ok: false, detail: "Pollinations returned empty/tiny payload" };
  if (isPlaceholder(buf, prompt)) {
    return { ok: false, detail: key ? "Pollinations returned a placeholder image" : POLLINATIONS_KEY_HINT, status: 402 };
  }
  return { ok: true, url: await toDataUrl(buf, ctype.split(";")[0]!) };
}

/** Dropped connections and busy queues usually clear within seconds; a slow render (timeout) is not retried. */
const RETRY_DELAYS_MS = [1500, 4000];
const RETRY_BUDGET_MS = 45_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503]);

export const pollinationsImageProvider: ImageProvider = {
  id: "pollinations",
  available: () => true,
  async generate({ prompt, kind, aspect, signal, seed, exact }) {
    const dims = aspectToSize(aspect);
    const scale = Math.min(1, 1024 / Math.max(dims.width, dims.height));
    const width = Math.max(768, Math.round(dims.width * scale));
    const height = Math.max(768, Math.round(dims.height * scale));
    const useSeed = seed ?? (Date.now() % 900_000) + 1;
    const finalPrompt = exact ? prompt.slice(0, 600) : fluxFriendlyPrompt(prompt);
    const url = buildGetUrl(finalPrompt, width, height, useSeed);
    const started = Date.now();

    let last: { ok: false; detail: string; status: number } = { ok: false, detail: "Pollinations fetch failed", status: 502 };
    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
      if (attempt > 0) {
        if (Date.now() - started > RETRY_BUDGET_MS || signal?.aborted) break;
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
      }
      try {
        const got = await fetchImage(url, finalPrompt, signal);
        if (got.ok) {
          return {
            ok: true,
            provider: `pollinations-flux${kind === "logo" ? "-logo" : ""}`,
            url: got.url,
            width,
            height,
          };
        }
        last = { ok: false, detail: got.detail, status: got.status ?? 502 };
        if (!RETRYABLE_STATUS.has(last.status)) return last;
      } catch (error) {
        if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
          if (signal?.aborted) return { ok: false, detail: "Cancelled", status: 499 };
          return { ok: false, detail: "Pollinations timed out", status: 504 };
        }
        last = { ok: false, detail: error instanceof Error ? error.message : "Pollinations fetch failed", status: 502 };
      }
    }
    return last;
  },
};
