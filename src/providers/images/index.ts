import { buildImageBrief, type ImageBrief } from "@/lib/image-brief";
import {
  DEFAULT_CHATGEM_LOGO_SUBJECT,
  detectImageKind,
  detectImageStyle,
  enhanceImagePrompt,
  enhanceImagePromptAsync,
  isMostlyEnglishPrompt,
} from "@/lib/image-prompt";
import { openaiImageProvider } from "@/providers/images/openai";
import {
  fluxFriendlyPrompt,
  pollinationsImageProvider,
} from "@/providers/images/pollinations";
import {
  aspectToSize,
  stylePromptSuffix,
  type ImageAspect,
  type ImageGenFailure,
  type ImageGenRequest,
  type ImageGenResult,
  type ImageKind,
  type ImageStyle,
} from "@/providers/images/types";

const NETWORK_ERROR_RE = /fetch failed|econnreset|econnrefused|enotfound|eai_again|etimedout|socket|network|connect timeout/;

function classifyFail(detail: string, status?: number): ImageGenFailure {
  const d = detail.toLowerCase();
  if (status === 499 || /cancel/.test(d)) {
    return { ok: false, detail: "Cancelled", code: "TIMEOUT", status: 499 };
  }
  // The last provider tried decides: a dropped connection there means "check the internet", not billing.
  if (NETWORK_ERROR_RE.test(d.split(" / ").pop() ?? d)) {
    return { ok: false, detail: "Network error: the image service could not be reached.", code: "NETWORK", status: 503 };
  }
  if (/prompt translation failed/.test(d)) {
    return {
      ok: false,
      detail: "Prompt translation failed: OpenAI, Gemini and Groq are all unavailable, so the image would not match the request.",
      code: "UNKNOWN",
      status,
    };
  }
  if (/pollinations_api_key|pollinations http 40[12]|placeholder image/.test(d)) {
    return {
      ok: false,
      detail: `No image provider available. OpenAI: ${/billing|quota/.test(d) ? "no billing credit" : "unavailable"}. ${detail.split(" / ").pop()}`,
      code: "QUOTA",
      status,
    };
  }
  if (/missing|openai_api_key/.test(d)) {
    return {
      ok: false,
      detail: "OPENAI_API_KEY is not configured on the server.",
      code: "AUTH",
      status,
    };
  }
  if (/insufficient_quota|billing|credit|exceeded/.test(d)) {
    return {
      ok: false,
      detail: "OpenAI billing / quota issue — check platform.openai.com → Billing.",
      code: "QUOTA",
      status,
    };
  }
  if (/401|invalid.?api|incorrect.?api/.test(d)) {
    return {
      ok: false,
      detail: "OPENAI_API_KEY is invalid.",
      code: "AUTH",
      status,
    };
  }
  if (/429|rate.?limit/.test(d)) {
    return {
      ok: false,
      detail: "Rate limit reached — wait a moment and retry.",
      code: "RATE_LIMIT",
      status,
    };
  }
  if (/timeout|aborted|timed?\s*out/.test(d)) {
    return {
      ok: false,
      detail: "Generation timed out. Please try again.",
      code: "TIMEOUT",
      status,
    };
  }
  return {
    ok: false,
    detail: detail.slice(0, 280),
    code: "PROVIDER",
    status,
  };
}

function composeFinalPrompt(
  enhanced: string,
  subject: string,
  kind: ImageKind,
  style: ImageStyle,
  variation: boolean,
  negativePrompt?: string,
): string {
  const head = subject.trim();
  const parts: string[] = [];
  if (head) parts.push(head);
  if (enhanced.trim() && enhanced.trim().toLowerCase() !== head.toLowerCase()) {
    parts.push(enhanced.trim());
  }
  const suffix = stylePromptSuffix(style, kind);
  if (suffix) parts.push(suffix);
  if (variation) {
    parts.push(
      kind === "logo"
        ? "fresh variation of the same brand mark, different geometry, same name"
        : "fresh variation, different camera angle, same subject",
    );
  }
  const avoidBits = [
    negativePrompt?.trim(),
    "tablet, phone, laptop, screen UI, random object",
    kind !== "logo" &&
    /\b(car|vehicle|mercedes|bmw|ferrari|lamborghini|logo|house|mountain)\b/i.test(
      subject,
    )
      ? "person, face, portrait, human"
      : null,
  ]
    .filter(Boolean)
    .join(", ");
  if (avoidBits) parts.push(`Avoid: ${avoidBits.slice(0, 400)}`);
  parts.push("no watermark");
  return parts.join(", ").slice(0, 1200);
}

async function generateOneImage(opts: {
  prompt: string;
  subject: string;
  kind: ImageKind;
  aspect: ImageAspect;
  style: ImageStyle;
  quality: import("@/providers/images/types").ImageQuality;
  seed: number;
  signal?: AbortSignal;
  /** Ready-made Flux prompt from the prompt engine. */
  fluxPrompt?: string;
}): Promise<
  | { ok: true; url: string; provider: string; width: number; height: number; warning?: string }
  | { ok: false; detail: string; status?: number }
> {
  const { prompt, subject, kind, aspect, quality, seed, signal } = opts;

  let openaiDetail = "";
  if (openaiImageProvider.available()) {
    const openai = await openaiImageProvider.generate({
      prompt,
      kind,
      aspect,
      signal,
      quality,
    });
    if (openai.ok) {
      return {
        ok: true,
        url: openai.url,
        provider: openai.provider,
        width: openai.width,
        height: openai.height,
      };
    }
    openaiDetail = openai.detail;
    if (signal?.aborted) return classifyFail("cancelled", 499);
  }

  const fluxPrompt =
    opts.fluxPrompt ??
    fluxFriendlyPrompt(
      subject
        ? kind === "logo"
          ? `${subject}, logo`
          : `${subject}, photorealistic photo, sharp detail`
        : prompt,
    );

  // Flux cannot read Tajik/Russian and draws a random woman instead of the subject.
  if ((fluxPrompt.match(/[\u0400-\u04FF]/g) || []).length > 2) {
    return classifyFail(
      `Prompt translation failed (no working AI key for translation)${openaiDetail ? ` / OpenAI: ${openaiDetail}` : ""}`,
      503,
    );
  }

  const poll = await pollinationsImageProvider.generate({
    prompt: fluxPrompt,
    kind,
    aspect,
    signal,
    seed,
    exact: Boolean(opts.fluxPrompt),
  });
  if (poll.ok) {
    if (openaiDetail) console.warn(`[images] OpenAI unavailable (${openaiDetail.slice(0, 120)}); used Pollinations.`);
    return { ok: true, url: poll.url, provider: poll.provider, width: poll.width, height: poll.height };
  }

  return classifyFail(
    openaiDetail ? `${openaiDetail} / ${poll.detail}` : poll.detail,
    poll.status,
  );
}

function briefPrompts(
  brief: ImageBrief,
  opts: { style: ImageStyle | null; variation: boolean; negativePrompt?: string },
): { prompt: string; fluxPrompt: string } {
  const extra = [
    opts.style ? `Style direction: ${stylePromptSuffix(opts.style, brief.imageKind)}` : null,
    opts.negativePrompt?.trim() ? `Also avoid: ${opts.negativePrompt.trim().slice(0, 300)}` : null,
    opts.variation ? "Fresh variation: a different composition of the same subject" : null,
  ].filter(Boolean);
  return {
    prompt: [brief.prompt, ...extra].join(". ").slice(0, 3900),
    fluxPrompt: opts.variation ? `${brief.fluxPrompt}, alternative composition` : brief.fluxPrompt,
  };
}

const EXACT_RENDERS = {
  "tajikistan-map": { provider: "chatgem-cartography", kind: "general", aspect: "4:3" },
  "tajikistan-flag": { provider: "chatgem-official-flag", kind: "general", aspect: "16:9" },
  "tajikistan-logo": { provider: "chatgem-national-logo", kind: "logo", aspect: "1:1" },
} as const;

/** Flags, the country map and its map-and-flag logo must be exact — drawn from official/open data, not imagined. */
async function renderExact(brief: ImageBrief, originalPrompt: string, style: ImageStyle): Promise<ImageGenResult> {
  const { renderTajikistanFlag, renderTajikistanLogo, renderTajikistanMap } = await import("@/services/images/render-tajikistan");
  const render = brief.render ?? "tajikistan-flag";
  const lang = brief.labelLang ?? brief.lang;
  const out =
    render === "tajikistan-map"
      ? await renderTajikistanMap(lang)
      : render === "tajikistan-logo"
        ? await renderTajikistanLogo(lang, { wordmark: brief.wordmark })
        : await renderTajikistanFlag();
  const spec = EXACT_RENDERS[render];
  return {
    ok: true,
    url: out.url,
    provider: spec.provider,
    kind: spec.kind,
    prompt: brief.prompt,
    subject: brief.subject,
    originalPrompt,
    aspect: spec.aspect,
    style,
    width: out.width,
    height: out.height,
    title: brief.title,
    briefKind: brief.kind,
  };
}

export async function runImageGeneration(
  req: ImageGenRequest,
): Promise<ImageGenResult> {
  const originalPrompt = req.prompt.trim();
  if (!originalPrompt) {
    return { ok: false, detail: "Prompt is required", code: "VALIDATION" };
  }

  const explicitStyle = Boolean(req.style && req.style !== "auto");
  const style: ImageStyle =
    req.style && req.style !== "auto"
      ? req.style
      : detectImageStyle(originalPrompt);
  const quality = req.quality ?? "standard";
  const variants = Math.min(4, Math.max(1, req.variants ?? 1));

  try {
    const keepRaw =
      Boolean(req.skipEnhance) && isMostlyEnglishPrompt(originalPrompt);
    const sync = enhanceImagePrompt(originalPrompt);
    const chatGemLogo = !keepRaw && sync.subject === DEFAULT_CHATGEM_LOGO_SUBJECT;
    const brief =
      keepRaw || chatGemLogo
        ? null
        : await buildImageBrief(originalPrompt, { kindHint: req.kind }).catch((error) => {
            console.warn(`[image-brief] ${error instanceof Error ? error.message : "failed"}`);
            return null;
          });

    // "Variation" on the national logo asks for a fresh creative take; the map and flag stay exact.
    const exact = brief?.render && !(req.variation && brief.render === "tajikistan-logo");
    if (brief && exact) return await renderExact(brief, originalPrompt, style);

    const aspect: ImageAspect = req.aspect ?? brief?.aspect ?? "1:1";
    const enhanced = brief
      ? { prompt: brief.prompt, subject: brief.subject, kind: brief.imageKind }
      : keepRaw
        ? {
            prompt: originalPrompt,
            subject: originalPrompt.slice(0, 200),
            kind:
              req.kind && req.kind !== "auto"
                ? req.kind
                : detectImageKind(originalPrompt),
          }
        : chatGemLogo
          ? sync
          : await enhanceImagePromptAsync(originalPrompt).catch(() => sync);
    const kind: ImageKind = brief
      ? brief.imageKind
      : req.kind && req.kind !== "auto"
        ? req.kind
        : enhanced.kind;

    if (req.signal?.aborted) {
      return { ok: false, detail: "Cancelled", code: "TIMEOUT", status: 499 };
    }

    const baseSeed = Date.now() % 900_000;
    const images: Array<{
      url: string;
      width: number;
      height: number;
      provider: string;
    }> = [];
    let lastFail: ImageGenFailure | null = null;
    let warning: string | undefined;
    let lastPrompt = "";

    for (let i = 0; i < variants; i++) {
      if (req.signal?.aborted) {
        return { ok: false, detail: "Cancelled", code: "TIMEOUT", status: 499 };
      }
      const variation = Boolean(req.variation) || i > 0;
      const fromBrief = brief ? briefPrompts(brief, { style: explicitStyle ? style : null, variation, negativePrompt: req.negativePrompt }) : null;
      lastPrompt =
        fromBrief?.prompt ??
        composeFinalPrompt(
          enhanced.prompt,
          enhanced.subject,
          kind,
          style,
          variation,
          req.negativePrompt,
        );
      const one = await generateOneImage({
        prompt: lastPrompt,
        subject: enhanced.subject,
        kind,
        aspect,
        style,
        quality: kind === "logo" ? "hd" : quality,
        seed: baseSeed + i * 7919,
        signal: req.signal,
        fluxPrompt: fromBrief?.fluxPrompt,
      });
      if (!one.ok) {
        lastFail = classifyFail(one.detail, one.status);
        if (images.length === 0) return lastFail;
        break;
      }
      if (one.warning) warning = one.warning;
      images.push({
        url: one.url,
        width: one.width,
        height: one.height,
        provider: one.provider,
      });
    }

    if (!images.length) {
      return lastFail ?? { ok: false, detail: "Image generation failed", code: "UNKNOWN" };
    }

    const primary = images[0]!;
    return {
      ok: true,
      url: primary.url,
      provider: primary.provider,
      kind,
      prompt: lastPrompt,
      subject: enhanced.subject,
      originalPrompt,
      aspect,
      style,
      width: primary.width,
      height: primary.height,
      warning,
      title: brief?.title,
      briefKind: brief?.kind,
      images: images.length > 1 ? images : undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, detail: "Cancelled", code: "TIMEOUT", status: 499 };
    }
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Image generation failed",
      code: "UNKNOWN",
    };
  }
}

export async function generateImageFromPrompt(
  rawPrompt: string,
  kindHint?: ImageKind | "auto",
  opts?: {
    aspect?: ImageAspect;
    style?: ImageStyle;
    variation?: boolean;
    signal?: AbortSignal;
  },
): Promise<
  | {
      ok: true;
      url: string;
      provider: string;
      kind: ImageKind;
      prompt: string;
      subject: string;
      warning?: string;
      title?: string;
      width: number;
      height: number;
    }
  | { ok: false; detail: string; status?: number }
> {
  const result = await runImageGeneration({
    prompt: rawPrompt,
    kind: kindHint,
    aspect: opts?.aspect,
    style: opts?.style,
    variation: opts?.variation,
    signal: opts?.signal,
  });
  if (!result.ok) {
    return { ok: false, detail: result.detail, status: result.status };
  }
  return {
    ok: true,
    url: result.url,
    provider: result.provider,
    kind: result.kind,
    prompt: result.prompt,
    subject: result.subject,
    warning: result.warning,
    title: result.title,
    width: result.width,
    height: result.height,
  };
}

export { aspectToSize };
