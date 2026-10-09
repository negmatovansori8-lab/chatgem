import {
  aspectToSize,
  type ImageAspect,
  type ImageKind,
  type ImageQuality,
} from "@/providers/images/types";

function key() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

async function toDataUrl(bytes: ArrayBuffer, mime = "image/png") {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function parseImageResponse(
  res: Response,
  width: number,
  height: number,
  provider: string,
  signal?: AbortSignal,
): Promise<
  | { ok: true; url: string; provider: string; width: number; height: number }
  | { ok: false; detail: string; status?: number }
> {
  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    return {
      ok: false,
      detail: raw.slice(0, 220) || `OpenAI images error ${res.status}`,
      status: res.status,
    };
  }
  try {
    const data = JSON.parse(raw) as {
      data?: Array<{ url?: string; b64_json?: string }>;
    };
    const first = data.data?.[0];
    if (first?.b64_json) {
      return {
        ok: true,
        provider,
        url: `data:image/png;base64,${first.b64_json}`,
        width,
        height,
      };
    }
    if (first?.url) {
      const img = await fetch(first.url, { signal });
      if (img.ok) {
        const buf = await img.arrayBuffer();
        return {
          ok: true,
          provider,
          url: await toDataUrl(buf, img.headers.get("content-type") || "image/png"),
          width,
          height,
        };
      }
      return { ok: true, provider, url: first.url, width, height };
    }
  } catch {
    return { ok: false, detail: "Invalid OpenAI image response" };
  }
  return { ok: false, detail: "Empty OpenAI image payload" };
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const bin = Buffer.from(m[2], "base64");
  return new Blob([bin], { type: m[1] || "image/png" });
}

async function urlToPngBlob(url: string, signal?: AbortSignal): Promise<Blob | null> {
  if (url.startsWith("data:")) return dataUrlToBlob(url);
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Blob([buf], { type: res.headers.get("content-type") || "image/png" });
  } catch {
    return null;
  }
}

/** OpenAI image variations (image-to-image style). */
export async function openaiImageVariation(opts: {
  imageUrl: string;
  aspect?: ImageAspect;
  signal?: AbortSignal;
}): Promise<
  | { ok: true; url: string; provider: string; width: number; height: number }
  | { ok: false; detail: string; status?: number }
> {
  const apiKey = key();
  if (!apiKey) return { ok: false, detail: "OPENAI_API_KEY missing" };
  const aspect = opts.aspect ?? "1:1";
  const dims = aspectToSize(aspect);
  const blob = await urlToPngBlob(opts.imageUrl, opts.signal);
  if (!blob) return { ok: false, detail: "Could not load source image" };

  const form = new FormData();
  form.append("image", blob, "source.png");
  form.append("n", "1");
  form.append("size", "1024x1024");

  try {
    const res = await fetch("https://api.openai.com/v1/images/variations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: opts.signal ?? AbortSignal.timeout(90_000),
    });
    return parseImageResponse(res, dims.width, dims.height, "dall-e-2-variation", opts.signal);
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : "Variation failed",
    };
  }
}

/** OpenAI image edits (prompt + source image). */
export async function openaiImageEdit(opts: {
  imageUrl: string;
  prompt: string;
  aspect?: ImageAspect;
  signal?: AbortSignal;
}): Promise<
  | { ok: true; url: string; provider: string; width: number; height: number }
  | { ok: false; detail: string; status?: number }
> {
  const apiKey = key();
  if (!apiKey) return { ok: false, detail: "OPENAI_API_KEY missing" };
  const aspect = opts.aspect ?? "1:1";
  const dims = aspectToSize(aspect);
  const blob = await urlToPngBlob(opts.imageUrl, opts.signal);
  if (!blob) return { ok: false, detail: "Could not load source image" };

  const form = new FormData();
  form.append("image", blob, "source.png");
  form.append("prompt", opts.prompt.slice(0, 1000));
  form.append("n", "1");
  form.append("size", "1024x1024");

  try {
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: opts.signal ?? AbortSignal.timeout(90_000),
    });
    return parseImageResponse(res, dims.width, dims.height, "dall-e-2-edit", opts.signal);
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : "Edit failed",
    };
  }
}

export async function openaiGenerateHd(opts: {
  prompt: string;
  kind: ImageKind;
  aspect: ImageAspect;
  quality?: ImageQuality;
  signal?: AbortSignal;
}) {
  const { openaiImageProvider } = await import("@/providers/images/openai");
  return openaiImageProvider.generate({
    prompt: opts.prompt,
    kind: opts.kind,
    aspect: opts.aspect,
    quality: opts.quality ?? "hd",
    signal: opts.signal,
  });
}
