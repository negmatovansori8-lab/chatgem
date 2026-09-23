import { enhanceImagePromptAsync } from "@/lib/image-prompt";

export type GenOk = {
  ok: true;
  url: string;
  provider: string;
  kind: string;
  prompt: string;
  subject: string;
};
export type GenFail = { ok: false; detail: string; status?: number };

async function toDataUrl(bytes: ArrayBuffer, mime = "image/png"): Promise<string> {
  const b64 = Buffer.from(bytes).toString("base64");
  return `data:${mime};base64,${b64}`;
}

async function generateWithOpenAI(
  prompt: string,
  kind: "logo" | "photo" | "general",
): Promise<Omit<GenOk, "kind" | "prompt" | "subject"> | GenFail> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { ok: false, detail: "OPENAI_API_KEY missing" };
  }

  // World-class path: DALL·E 3 HD first, then standard, then DALL·E 2.
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
      lastDetail = raw.slice(0, 300) || `HTTP ${res.status}`;
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

async function generateWithPollinations(
  prompt: string,
  kind: "logo" | "photo" | "general",
): Promise<Omit<GenOk, "kind" | "prompt" | "subject"> | GenFail> {
  const short = prompt.slice(0, 450);
  const encoded = encodeURIComponent(short);
  const seed = Date.now() % 100000;
  // Flux at 1024 — no enhance (it invents faces). Prefer turbo for speed/quality mix.
  const model = kind === "logo" ? "flux" : "flux";
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1280&height=1280&nologo=true&nofeed=true&model=${model}&seed=${seed}`;

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
    if (buf.byteLength < 1000) {
      return { ok: false, detail: "Pollinations returned empty image" };
    }
    const mime = res.headers.get("content-type") || "image/jpeg";
    return {
      ok: true,
      provider: "pollinations-flux",
      url: await toDataUrl(buf, mime),
    };
  } catch (error) {
    return {
      ok: false,
      detail:
        error instanceof Error ? error.message : "Pollinations fetch failed",
    };
  }
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
        ? `Award-winning minimal logo for ${subject}, vector, flat, no watermark`
        : `World-class photorealistic image of ${subject}, cinematic lighting, 8K detail, subject must be ${subject}, no people unless requested, no watermark`;
    const retry = await generateWithOpenAI(shortPrompt, kind);
    if (retry.ok) {
      return { ...retry, kind, prompt: shortPrompt, subject };
    }
  }

  const poll = await generateWithPollinations(prompt, kind);
  if (poll.ok) {
    return { ...poll, kind, prompt, subject };
  }

  return {
    ok: false,
    detail: `OpenAI: ${openai.detail}. Fallback: ${poll.detail}`,
    status: "status" in openai ? openai.status : undefined,
  };
}
