import { describe, expect, it } from "vitest";
import { isAllowedMime } from "../src/repositories/file-repository";
import { webSearch } from "../src/services/search/web-search";

describe("phase 3 knowledge", () => {
  it("allows common text uploads", () => {
    expect(isAllowedMime("text/plain")).toBe(true);
    expect(isAllowedMime("application/pdf")).toBe(true);
  });

  it("does not fabricate web search results when unconfigured", async () => {
    const result = await webSearch("nurjahon ai");
    expect(result.configured).toBe(false);
    expect(result.results).toEqual([]);
  });
});
