import { afterEach, describe, expect, it, vi } from "vitest";
import { runImageGeneration } from "@/providers/images";
import { pollinationsImageProvider } from "@/providers/images/pollinations";

function imageResponse() {
  const bytes = new Uint8Array(4000).map((_, i) => (i * 31 + Date.now()) % 256);
  return new Response(bytes, { status: 200, headers: { "Content-Type": "image/jpeg" } });
}

describe("image generation on an unstable connection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("retries Pollinations after a dropped connection instead of failing at once", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(imageResponse());

    const out = await pollinationsImageProvider.generate({ prompt: "car logo", kind: "logo", aspect: "1:1", exact: true });
    expect(out.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  }, 15_000);

  it("reports a network error, not raw 'fetch failed', when the connection stays down", async () => {
    for (const key of ["OPENAI_API_KEY", "GOOGLE_AI_API_KEY", "GROQ_API_KEY", "POLLINATIONS_API_KEY"]) vi.stubEnv(key, "");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));

    const out = await runImageGeneration({ prompt: "car logo", kind: "logo", skipEnhance: true });
    expect(out).toMatchObject({ ok: false, code: "NETWORK" });
  }, 20_000);
});
