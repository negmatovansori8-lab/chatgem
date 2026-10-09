import { describe, expect, it, vi } from "vitest";
import { isAllowedMime } from "../src/repositories/file-repository";
import { webSearch } from "../src/services/search/web-search";

describe("phase 3 knowledge", () => {
  it("allows common text uploads", () => {
    expect(isAllowedMime("text/plain")).toBe(true);
    expect(isAllowedMime("application/pdf")).toBe(true);
  });

  it("does not fabricate web search results when the free search is unreachable or empty", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      fetchSpy.mockRejectedValueOnce(new Error("offline"));
      const offline = await webSearch("nurjahon ai");
      expect(offline.configured).toBe(false);
      expect(offline.results).toEqual([]);

      fetchSpy.mockResolvedValueOnce(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
      const empty = await webSearch("nurjahon ai");
      expect(empty.results).toEqual([]);
    } finally {
      fetchSpy.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});
