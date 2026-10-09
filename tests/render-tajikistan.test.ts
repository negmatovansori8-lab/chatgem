import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderTajikistanFlag, renderTajikistanLogo, renderTajikistanMap } from "@/services/images/render-tajikistan";

const PNG_SIGNATURE = "iVBORw0KGgo";

/** Set RENDER_PREVIEW_DIR to inspect the rendered images. */
async function preview(name: string, url: string) {
  const dir = process.env.RENDER_PREVIEW_DIR;
  if (dir) await writeFile(path.join(dir, name), Buffer.from(url.split(",")[1]!, "base64"));
}

describe("Tajikistan renders", () => {
  it("renders the official flag at 1:2", async () => {
    const flag = await renderTajikistanFlag(1200);
    expect(flag.width).toBe(1200);
    expect(flag.height).toBe(600);
    expect(flag.url.startsWith(`data:image/png;base64,${PNG_SIGNATURE}`)).toBe(true);
    await preview("flag.png", flag.url);
  });

  it("renders the map-and-flag logo with a localized wordmark", async () => {
    for (const lang of ["tg", "en"] as const) {
      const logo = await renderTajikistanLogo(lang);
      expect(logo.width).toBe(1024);
      expect(logo.url.startsWith(`data:image/png;base64,${PNG_SIGNATURE}`)).toBe(true);
      await preview(`logo-${lang}.png`, logo.url);
    }
    const bare = await renderTajikistanLogo("tg", { wordmark: null, size: 512 });
    expect(bare.width).toBe(512);
    await preview("logo-bare.png", bare.url);
  });

  it("renders a localized political map", async () => {
    for (const lang of ["tg", "ru", "en"] as const) {
      const map = await renderTajikistanMap(lang);
      expect(map.width).toBe(1600);
      expect(map.height).toBeGreaterThan(1000);
      expect(map.url.startsWith(`data:image/png;base64,${PNG_SIGNATURE}`)).toBe(true);
      await preview(`map-${lang}.png`, map.url);
    }
  }, 30_000);
});
