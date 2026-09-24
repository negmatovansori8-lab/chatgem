import { enhanceImagePromptAsync } from "@/lib/image-prompt";

export type GenOk = {
  ok: true;
  url: string;
  provider: string;
  kind: string;
  prompt: string;
  subject: string;
  warning?: string;
};
export type GenFail = { ok: false; detail: string; status?: number };

async function toDataUrl(bytes: ArrayBuffer, mime = "image/png"): Promise<string> {
  const b64 = Buffer.from(bytes).toString("base64");
  return `data:${mime};base64,${b64}`;
}

function openaiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

type Attempt = {
  label: string;
  body: Record<string, unknown>;
};

function worldClassAttempts(
  prompt: string,
  kind: "logo" | "photo" | "general",
): Attempt[] {
  const p = prompt.slice(0, 3200);
  const size =
    kind === "photo" ? "1536x1024" : kind === "logo" ? "1024x1024" : "1024x1024";

  // Newest GPT Image models first (DALL·E 3 retired on many accounts).
  const gptModels = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1"] as const;
  const attempts: Attempt[] = [];

  for (const model of gptModels) {
    attempts.push({
      label: `${model}-high`,
      body: {
        model,
        prompt: p,
        n: 1,
        size,
        quality: "high",
        output_format: "png",
      },
    });
    attempts.push({
      label: `${model}-medium`,
      body: {
        model,
        prompt: p,
        n: 1,
        size: "1024x1024",
        quality: "medium",
        output_format: "png",
      },
    });
  }

  // Legacy DALL·E 3 if still enabled on the key
  attempts.push({
    label: "dall-e-3-hd",
    body: {
      model: "dall-e-3",
      prompt: p.slice(0, 3900),
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: kind === "photo" ? "natural" : "vivid",
    },
  });
  attempts.push({
    label: "dall-e-3-standard",
    body: {
      model: "dall-e-3",
      prompt: p.slice(0, 3900),
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: kind === "photo" ? "natural" : "vivid",
    },
  });

  return attempts;
}

async function generateWithOpenAI(
  prompt: string,
  kind: "logo" | "photo" | "general",
): Promise<Omit<GenOk, "kind" | "prompt" | "subject"> | GenFail> {
  const key = openaiKey();
  if (!key) {
    return { ok: false, detail: "OPENAI_API_KEY missing on server" };
  }

  let lastDetail = "OpenAI images failed";
  let lastStatus = 0;

  for (const attempt of worldClassAttempts(prompt, kind)) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(attempt.body),
      signal: AbortSignal.timeout(120_000),
    });
    const raw = await res.text().catch(() => "");
    if (!res.ok) {
      lastStatus = res.status;
      lastDetail = `${attempt.label}: ${raw.slice(0, 280) || `HTTP ${res.status}`}`;
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
        };
      }
      if (first?.url) {
        const img = await fetch(first.url);
        if (img.ok) {
          const buf = await img.arrayBuffer();
          return {
            ok: true,
            provider: attempt.label,
            url: await toDataUrl(
              buf,
              img.headers.get("content-type") || "image/png",
            ),
          };
        }
      }
      lastDetail = `${attempt.label}: empty image payload`;
    } catch {
      lastDetail = `${attempt.label}: invalid response`;
    }
  }

  return { ok: false, detail: lastDetail, status: lastStatus };
}

function pollinationsPrompt(
  subject: string,
  kind: "logo" | "photo" | "general",
): string {
  const s = subject.trim() || "the subject";
  if (kind === "logo") {
    return [
      `award winning app logo of ${s}`,
      `flat vector icon, centered, square, plain white background`,
      `ultra sharp, high contrast, no phone, no mockup, no person, no watermark`,
    ].join(", ");
  }
  if (kind === "photo") {
    return [
      `ultra sharp photorealistic photo of ${s}`,
      `8k detail, cinematic lighting, subject fills frame`,
      `no phone screen, no mockup, no watermark, no blur`,
    ].join(", ");
  }
  return [
    `masterpiece detailed image of ${s}`,
    `sharp focus, beautiful lighting, subject fills frame`,
    `no phone, no mockup, no watermark`,
  ].join(", ");
}

async function generateWithPollinations(
  subject: string,
  kind: "logo" | "photo" | "general",
): Promise<Omit<GenOk, "kind" | "prompt" | "subject"> | GenFail> {
  const prompt = pollinationsPrompt(subject, kind);
  const encoded = encodeURIComponent(prompt);
  const seed = Date.now() % 100000;
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1280&height=1280&nologo=true&private=true&nofeed=true&model=flux&seed=${seed}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "image/*",
        "User-Agent": "ChatGem/1.0",
      },
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      return { ok: false, detail: `Pollinations HTTP ${res.status}` };
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 2000) {
      return { ok: false, detail: "Pollinations returned empty image" };
    }
    const mime = res.headers.get("content-type") || "image/jpeg";
    return {
      ok: true,
      provider: "pollinations-flux",
      url: await toDataUrl(buf, mime),
      warning:
        "Ин сифати ройгон аст. Барои сатҳи ҷаҳонӣ: Render → Environment → OPENAI_API_KEY + Billing дар platform.openai.com ($10+).",
    };
  } catch (error) {
    return {
      ok: false,
      detail:
        error instanceof Error ? error.message : "Pollinations fetch failed",
    };
  }
}

function friendlyOpenAIFail(detail: string): string {
  const d = detail.toLowerCase();
  if (/missing/.test(d)) {
    return "OPENAI_API_KEY дар Render нест.";
  }
  if (/insufficient_quota|billing|credit|exceeded/.test(d)) {
    return "Пули OpenAI тамом — platform.openai.com → Billing.";
  }
  if (/401|invalid.?api|incorrect.?api/.test(d)) {
    return "OPENAI_API_KEY нодуруст аст.";
  }
  if (/429|rate.?limit/.test(d)) {
    return "Лимити OpenAI пур шуд.";
  }
  if (/organization.?must.?be.?verified|verification/.test(d)) {
    return "OpenAI Organization Verification лозим (барои GPT Image).";
  }
  return detail.slice(0, 220);
}

/** World-class image pipeline: GPT Image high → DALL·E → Flux fallback. */
export async function generateImageFromPrompt(
  rawPrompt: string,
  kindHint?: "logo" | "photo" | "general" | "auto",
): Promise<GenOk | GenFail> {
  const enhanced = await enhanceImagePromptAsync(rawPrompt);
  const kind =
    kindHint && kindHint !== "auto" ? kindHint : enhanced.kind;
  const prompt = enhanced.prompt;
  const subject = enhanced.subject;

  const openai = await generateWithOpenAI(prompt, kind);
  if (openai.ok) {
    return { ...openai, kind, prompt, subject };
  }

  // Second pass: ultra-short English subject (better model adherence)
  if (subject && subject.length < 160) {
    const shortPrompt =
      kind === "logo"
        ? `World-class minimal logo icon for "${subject}", flat vector, centered on white, no mockup, no phone, no watermark, crisp edges`
        : `World-class ultra-sharp photograph of ${subject}, subject fills the frame, cinematic light, 8K detail, no phone mockup, no watermark`;
    const retry = await generateWithOpenAI(shortPrompt, kind);
    if (retry.ok) {
      return { ...retry, kind, prompt: shortPrompt, subject };
    }
  }

  const poll = await generateWithPollinations(subject, kind);
  if (poll.ok) {
    return {
      ...poll,
      kind,
      prompt: pollinationsPrompt(subject, kind),
      subject,
      warning: `${poll.warning ?? ""} OpenAI: ${friendlyOpenAIFail(openai.detail)}`.trim(),
    };
  }

  return {
    ok: false,
    detail: `Сурат сохта нашуд. ${friendlyOpenAIFail(openai.detail)} / ${poll.detail}`,
    status: "status" in openai ? openai.status : undefined,
  };
}
