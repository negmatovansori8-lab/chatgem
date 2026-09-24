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

async function generateWithOpenAI(
  prompt: string,
  kind: "logo" | "photo" | "general",
): Promise<Omit<GenOk, "kind" | "prompt" | "subject"> | GenFail> {
  const key = openaiKey();
  if (!key) {
    return { ok: false, detail: "OPENAI_API_KEY missing on server" };
  }

  const style = kind === "photo" ? "natural" : "vivid";
  const attempts: Array<Record<string, unknown>> = [
    {
      model: "dall-e-3",
      prompt: prompt.slice(0, 3900),
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style,
    },
    {
      model: "dall-e-3",
      prompt: prompt.slice(0, 3900),
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style,
    },
    {
      model: "dall-e-2",
      prompt: prompt.slice(0, 900),
      n: 1,
      size: "1024x1024",
    },
  ];

  let lastDetail = "OpenAI images failed";
  let lastStatus = 0;

  for (const body of attempts) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text().catch(() => "");
    if (!res.ok) {
      lastStatus = res.status;
      lastDetail = raw.slice(0, 400) || `HTTP ${res.status}`;
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
          provider: String(body.model),
          url: `data:image/png;base64,${first.b64_json}`,
        };
      }
      if (first?.url) {
        const img = await fetch(first.url);
        if (img.ok) {
          const buf = await img.arrayBuffer();
          return {
            ok: true,
            provider: `${String(body.model)}${body.quality === "hd" ? "-hd" : ""}`,
            url: await toDataUrl(
              buf,
              img.headers.get("content-type") || "image/png",
            ),
          };
        }
      }
      lastDetail = "Empty image payload from OpenAI";
    } catch {
      lastDetail = "Invalid OpenAI response";
    }
  }

  return { ok: false, detail: lastDetail, status: lastStatus };
}

/** Short locked prompt — Flux ignores long essays and invents phones/faces. */
function pollinationsPrompt(
  subject: string,
  kind: "logo" | "photo" | "general",
): string {
  const s = subject.trim() || "the subject";
  if (kind === "logo") {
    return [
      `simple modern app logo icon of ${s}`,
      `flat vector, centered, square, plain white background`,
      `sharp, high contrast, no phone, no mockup, no person, no watermark, no text blur`,
    ].join(", ");
  }
  if (kind === "photo") {
    return [
      `sharp photorealistic photo of ${s}`,
      `main subject clearly visible and in focus`,
      `natural light, detailed, no phone screen, no mockup frame, no watermark, no blurry mess`,
    ].join(", ");
  }
  return [
    `clear detailed image of ${s}`,
    `subject fills the frame, sharp focus`,
    `no phone, no mockup, no random person, no watermark`,
  ].join(", ");
}

async function generateWithPollinations(
  subject: string,
  kind: "logo" | "photo" | "general",
): Promise<Omit<GenOk, "kind" | "prompt" | "subject"> | GenFail> {
  const prompt = pollinationsPrompt(subject, kind);
  const encoded = encodeURIComponent(prompt);
  const seed = Date.now() % 100000;
  // Keep prompt short; nologo=true; private to reduce feed defaults.
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&private=true&nofeed=true&model=flux&seed=${seed}`;

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
        "Сифати ройгон (Pollinations). Барои сурати HD дар Render OPENAI_API_KEY + пул гузоред.",
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
    return "OPENAI_API_KEY дар Render нест. Environment → илова кунед.";
  }
  if (/insufficient_quota|billing|credit|exceeded/.test(d)) {
    return "Пули OpenAI тамом шуд — platform.openai.com → Billing.";
  }
  if (/401|invalid.?api|incorrect.?api/.test(d)) {
    return "OPENAI_API_KEY нодуруст аст.";
  }
  if (/429|rate.?limit/.test(d)) {
    return "Лимити OpenAI пур шуд — як дақиқа интизор шавед.";
  }
  return detail.slice(0, 200);
}

/** Shared image pipeline for /api/images and chat intercept. */
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

  if (subject && subject.length < 120) {
    const shortPrompt =
      kind === "logo"
        ? `Simple modern logo icon for ${subject}, flat vector, white background, no mockup, no phone, no watermark`
        : `Sharp clear photo of ${subject} only, in focus, no phone mockup, no watermark`;
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
