import { DEFAULT_TILES } from "@/lib/maps/tiles";
import type { MapProvider, MapTiles } from "@/providers/maps/types";

/** OpenStreetMap raster basemap (override with MAP_TILE_URL / MAP_DARK_TILE_URL). */
export class OsmMapProvider implements MapProvider {
  readonly id = "osm";

  tiles(): MapTiles {
    const url = process.env.MAP_TILE_URL?.trim();
    if (!url) return DEFAULT_TILES;
    return {
      url,
      attribution:
        process.env.MAP_TILE_ATTRIBUTION?.trim() ||
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      ...(url.includes("{s}") ? { subdomains: process.env.MAP_TILE_SUBDOMAINS?.trim() || "abc" } : {}),
    };
  }

  /**
   * Dedicated dark basemap, only when configured (MAP_DARK_TILE_URL). Without it the
   * client renders the standard tiles with a dark filter — same data, no extra key.
   */
  darkTiles(): MapTiles | null {
    const url = process.env.MAP_DARK_TILE_URL?.trim();
    if (!url) return null;
    return {
      url,
      attribution:
        process.env.MAP_DARK_TILE_ATTRIBUTION?.trim() ||
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      ...(url.includes("{s}") ? { subdomains: process.env.MAP_DARK_TILE_SUBDOMAINS?.trim() || "abc" } : {}),
    };
  }

  satelliteTiles(): MapTiles | null {
    return {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri",
      maxZoom: 19,
    };
  }
}
