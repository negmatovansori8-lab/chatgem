import { isProviderDown, markProviderDown } from "@/lib/provider-health";
import {
  aspectToSize,
  type ImageAspect,
  type ImageKind,
  type ImageProvider,
  type ImageQuality,
} from "@/providers/images/types";

async function toDataUrl(bytes: ArrayBuffer, mime = "image/png"): Promise<string> {
  const b64 = Buffer.from(bytes).toString("base64");
  return `data:${mime};base64,${b64}`;
}

function key() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

type Attempt = { label: string; body: Record<string, unknown>; timeoutMs: number };

/** Logo marks go to GPT Image first (crisp vectors and real lettering). Photos stay on DALL·E 3. */
function attempts(
  prompt: string,
  kind: ImageKind,
  aspect: ImageAspect,
  quality: ImageQuality,
): Attempt[] {
  const logo = kind === "logo";
  const subjectLock = logo
    ? "World-class brand identity. One flat vector logo mark, centered, crisp edges, two to four solid colours, generous negative space, optional wordmark spelled once and correctly. Plain or transparent field. No photo, no mockup, no 3D object, no watermark, no extra letters."
    : "Show ONLY the requested subject. No tablet, no phone screen, no random object, no watermark text.";
  const p = `${prompt.slice(0, 2800)}. ${subjectLock}`.slice(0, 3900);
  const { openai: size } = aspectToSize(aspect);
  const list: Attempt[] = [];
  const dalleQuality = logo || quality === "hd" ? "hd" : "standard";
  const gptQuality = logo || quality === "hd" ? "high" : "medium";

  const dalleSize =
    aspect === "16:9" || aspect === "3:2" || aspect === "4:3"
      ? "1792x1024"
      : aspect === "9:16" || aspect === "2:3" || aspect === "3:4"
        ? "1024x1792"
        : "1024x1024";

  const dalle: Attempt = {
    label: "dall-e-3",
    timeoutMs: 90_000,
    body: {
      model: "dall-e-3",
      prompt: p,
      n: 1,
      size: dalleSize,
      quality: dalleQuality,
    },
  };

  const gpt: Attempt = {
    label: "gpt-image-1",
    timeoutMs: 90_000,
    body: {
      model: "gpt-image-1",
      prompt: p,
      n: 1,
      size,
      quality: gptQuality,
      ...(logo ? { background: "transparent", output_format: "png" } : {}),
    },
  };

  return logo ? [gpt, dalle] : [dalle, gpt];
}

function openAiErrorCode(raw: string): string {
  try {
    const err = (JSON.parse(raw) as { error?: { code?: string | null; type?: string } }).error;
    return err?.code || err?.type || "";
  } catch {
    return "";
  }
}

function friendlyOpenAiError(raw: string, status: number, label: string): string {
  const lower = raw.toLowerCase();
  if (/insufficient_quota|billing|credit/.test(lower)) {
    const code = openAiErrorCode(raw);
    return `OpenAI billing or quota limit${code ? ` (${code})` : ""} — check platform.openai.com → Billing.`;
  }
  if (status === 401 || /invalid.?api|incorrect.?api/.test(lower)) {
    return "OpenAI API key is invalid.";
  }
  if (status === 429 || /rate.?limit/.test(lower)) {
    return "OpenAI rate limit — wait a moment and retry.";
  }
  if (/content.?policy|safety|moderation/.test(lower)) {
    return "Prompt was rejected by content policy — try rephrasing.";
  }
  if (/unknown.?parameter|invalid/.test(lower)) {
    return `${label} rejected the request — try another aspect or quality.`;
  }
  return `${label} could not generate this image (${status || "err"}).`;
}

export const openaiImageProvider: ImageProvider = {
  id: "openai",
  available: () => Boolean(key()) && !isProviderDown("openai"),
  async generate({ prompt, kind, aspect, signal, quality = "standard" }) {
    const apiKey = key();
    if (!apiKey) {
      return { ok: false, detail: "OPENAI_API_KEY missing on server" };
    }

    const dims = aspectToSize(aspect);
    let lastDetail = "OpenAI images failed";
    let lastStatus = 0;

    for (const attempt of attempts(prompt, kind, aspect, quality)) {
      if (signal?.aborted) {
        return { ok: false, detail: "Cancelled", status: 499 };
      }
      const timeout = AbortSignal.timeout(attempt.timeoutMs);
      const linked =
        signal != null ? AbortSignal.any([signal, timeout]) : timeout;
      try {
        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(attempt.body),
          signal: linked,
        });
        const raw = await res.text().catch(() => "");
        if (!res.ok) {
          lastStatus = res.status;
          lastDetail = friendlyOpenAiError(raw, res.status, attempt.label);
          if (
            /insufficient_quota|billing|invalid.?api|incorrect.?api/i.test(raw) ||
            res.status === 401
          ) {
            // Don't burn time on other models if key/billing is dead
            if (/insufficient_quota|billing|invalid.?api|incorrect.?api/i.test(raw)) {
              // still try next model for model-not-found; stop on auth/quota
              if (res.status === 401 || /insufficient_quota|billing/i.test(raw)) {
                markProviderDown("openai", lastDetail);
                return { ok: false, detail: lastDetail, status: lastStatus };
              }
            }
          }
          continue;
        }
        try {
          const data = JSON.parse(raw) as {
            data?: Array<{ url?: string; b64_json?: string }>;
          };
          const first = data.data?.[0];
          if (first?.b64_json) {
            return {
              ok: true,
              provider: attempt.label,
              url: `data:image/png;base64,${first.b64_json}`,
              width: dims.width,
              height: dims.height,
            };
          }
          if (first?.url) {
            const img = await fetch(first.url, { signal: linked });
            if (img.ok) {
              const buf = await img.arrayBuffer();
              return {
                ok: true,
                provider: attempt.label,
                url: await toDataUrl(
                  buf,
                  img.headers.get("content-type") || "image/png",
                ),
                width: dims.width,
                height: dims.height,
              };
            }
            return {
              ok: true,
              provider: attempt.label,
              url: first.url,
              width: dims.width,
              height: dims.height,
            };
          }
          lastDetail = `${attempt.label}: empty image payload`;
        } catch {
          lastDetail = `${attempt.label}: invalid response`;
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          if (signal?.aborted) {
            return { ok: false, detail: "Cancelled", status: 499 };
          }
          lastDetail = `${attempt.label}: timed out`;
          continue;
        }
        lastDetail =
          error instanceof Error ? error.message : `${attempt.label} failed`;
      }
    }

    return { ok: false, detail: lastDetail, status: lastStatus };
  },
};
