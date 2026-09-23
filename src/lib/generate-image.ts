import { enhanceImagePrompt } from "@/lib/image-prompt";

export type GenOk = { ok: true; url: string; provider: string; kind: string; prompt: string };
export type GenFail = { ok: false; detail: string; status?: number };

async function toDataUrl(bytes: ArrayBuffer, mime = "image/png"): Promise<string> {
  const b64 = Buffer.from(bytes).toString("base64");
  return `data:${mime};base64,${b64}`;
}

async function generateWithOpenAI(prompt: string): Promise<Omit<GenOk, "kind" | "prompt"> | GenFail> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { ok: false, detail: "OPENAI_API_KEY missing" };
  }

  const attempts: Array<Record<string, unknown>> = [
    {
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    },
    {
      model: "dall-e-2",
      prompt,
      n: 1,
      size: "512x512",
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
            provider: String(body.model),
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
): Promise<Omit<GenOk, "kind" | "prompt"> | GenFail> {
  const encoded = encodeURIComponent(prompt);
  const seed = Date.now() % 100000;
  const style =
    kind === "logo"
      ? "&model=flux&style=logo"
      : kind === "photo"
        ? "&model=flux"
        : "&model=flux";
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&enhance=true&seed=${seed}${style}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(75_000),
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
      provider: "pollinations",
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
  const enhanced = enhanceImagePrompt(rawPrompt);
  const kind =
    kindHint && kindHint !== "auto" ? kindHint : enhanced.kind;
  const prompt = enhanced.prompt;

  const openai = await generateWithOpenAI(prompt);
  if (openai.ok) {
    return { ...openai, kind, prompt };
  }

  const poll = await generateWithPollinations(prompt, kind);
  if (poll.ok) {
    return { ...poll, kind, prompt };
  }

  return {
    ok: false,
    detail: `OpenAI: ${openai.detail}. Fallback: ${poll.detail}`,
    status: "status" in openai ? openai.status : undefined,
  };
}
