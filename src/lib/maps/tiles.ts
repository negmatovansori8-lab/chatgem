import type { MapTiles } from "@/providers/maps/types";

/**
 * Key-free default basemap: OpenStreetMap's single CDN host (the a/b/c
 * subdomains are legacy and defeat HTTP/2 connection reuse). Shared by server
 * status and the client's first paint so the tile layer never remounts when
 * /api/maps/status arrives. (CARTO needs an API key in browsers; Esri street
 * tiles lack Tajikistan street data.)
 */
export const DEFAULT_TILES: MapTiles = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
};

/** Origins to preconnect to so the first tiles skip DNS/TLS setup. */
export function tileOrigins(tiles: MapTiles): string[] {
  const subs = tiles.url.includes("{s}") ? (tiles.subdomains ?? "abc").split("") : [""];
  const origins = new Set<string>();
  for (const s of subs) {
    try {
      origins.add(new URL(tiles.url.replace("{s}", s).replace(/\{[^}]+\}/g, "0")).origin);
    } catch {
      // not a URL template
    }
  }
  return [...origins];
}
