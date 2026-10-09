import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "@/providers/maps/errors";

describe("maps requests on an unstable connection", () => {
  afterEach(() => vi.restoreAllMocks());

  it("retries a dropped connection and a gateway error, then succeeds", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

    await expect(fetchJson<{ ok: boolean }>("https://example.test/search")).resolves.toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  }, 10_000);

  it("does not retry answers that will not change", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 429 }));
    await expect(fetchJson("https://example.test/search")).rejects.toMatchObject({ code: "rate_limit" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("gives up with a network error after the retries", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchJson("https://example.test/search", { retries: 1 })).rejects.toMatchObject({ code: "network" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
