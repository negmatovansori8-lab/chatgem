import { haversineMeters } from "@/lib/maps/geo";
import { hasCyrillic, transliterate } from "@/lib/maps/translit";
import { TtlCache, coordKey } from "@/providers/maps/cache";
import { fetchJson } from "@/providers/maps/errors";
import type { AutocompleteProvider, LatLng, MapPlace } from "@/providers/maps/types";

/** Photon (komoot) — OSM type-ahead with prefix + typo tolerance. Self-host via PHOTON_BASE_URL. */
const BASE = (process.env.PHOTON_BASE_URL?.trim() || "https://photon.komoot.io").replace(/\/+$/, "");
const UA = "ChatGem/1.0 (maps-module)";

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
};

const cache = new TtlCache<MapPlace[]>(500, 10 * 60_000);
/** Cyrillic hits this close to the user outrank transliterated world matches. */
const LOCAL_METERS = 50_000;

/** Photon indexes default/en/de/fr names; Tajik/Russian UIs get local (default) names. */
function photonLang(locale: string): string {
  const l = locale.split("-")[0];
  return l === "en" || l === "de" || l === "fr" ? l : "default";
}

function toPlace(f: PhotonFeature, near: LatLng | undefined): MapPlace | null {
  const p = f.properties ?? {};
  const c = f.geometry?.coordinates;
  if (!c || !p.name && !p.street) return null;
  const location = { lat: c[1], lng: c[0] };
  const name = p.name || [p.street, p.housenumber].filter(Boolean).join(" ");
  const street = p.name && p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : "";
  const locality = p.city || p.county || p.state;
  const address = [street, p.district, locality !== name ? locality : "", p.country]
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .join(", ");
  return {
    id: `photon:${p.osm_type ?? "x"}${p.osm_id ?? `${c[1]},${c[0]}`}`,
    name,
    address,
    location,
    category: p.osm_value || p.type,
    locality,
    country: p.country,
    countryCode: p.countrycode?.toLowerCase(),
    distanceMeters: near ? haversineMeters(near, location) : undefined,
    source: "photon",
  };
}

export class PhotonAutocompleteProvider implements AutocompleteProvider {
  readonly id = "photon";

  async suggest(text: string, opts: { near?: LatLng; locale?: string; limit?: number }): Promise<MapPlace[]> {
    const q = text.trim().slice(0, 120);
    if (q.length < 2) return [];
    const locale = opts.locale || "tg";
    const limit = Math.min(opts.limit ?? 6, 10);
    const key = `${q.toLowerCase()}|${locale}|${opts.near ? coordKey(opts.near, 1) : "-"}|${limit}`;

    return cache.getOrLoad(key, async () => {
      const latin = hasCyrillic(q) ? transliterate(q) : q;
      if (latin === q) return this.query(q, locale, limit, opts.near);
      // "Лондон", "Биг Бен": Photon mostly indexes the Latin spelling of world places,
      // while local shops keep Cyrillic names — ask for both.
      const [orig, lat] = await Promise.allSettled([
        this.query(q, locale, limit, opts.near),
        this.query(latin, locale, limit, opts.near),
      ]);
      if (orig.status === "rejected" && lat.status === "rejected") throw orig.reason;
      const a = orig.status === "fulfilled" ? orig.value : [];
      const b = lat.status === "fulfilled" ? lat.value : [];
      const isLocal = (p: MapPlace) => p.distanceMeters != null && p.distanceMeters <= LOCAL_METERS;
      const merged: MapPlace[] = a.filter(isLocal);
      const rest = a.filter((p) => !isLocal(p));
      for (let i = 0; i < Math.max(rest.length, b.length); i++) {
        if (b[i]) merged.push(b[i]!);
        if (rest[i]) merged.push(rest[i]!);
      }
      const seen = new Set<string>();
      return merged
        .filter((p) => {
          const k = `${p.name.toLowerCase()}|${p.location.lat.toFixed(3)},${p.location.lng.toFixed(3)}`;
          if (seen.has(p.id) || seen.has(k)) return false;
          seen.add(p.id).add(k);
          return true;
        })
        .slice(0, limit);
    });
  }

  private async query(q: string, locale: string, limit: number, near?: LatLng): Promise<MapPlace[]> {
    const params = new URLSearchParams({ q, limit: String(limit), lang: photonLang(locale) });
    if (near) {
      // Bias towards the user without excluding the rest of the world.
      params.set("lat", near.lat.toFixed(4));
      params.set("lon", near.lng.toFixed(4));
      params.set("location_bias_scale", "0.3");
    }
    const data = await fetchJson<{ features?: PhotonFeature[] }>(`${BASE}/api/?${params}`, {
      headers: { "User-Agent": UA },
      timeoutMs: 6_000,
    });
    const seen = new Set<string>();
    return (data.features ?? [])
      .map((f) => toPlace(f, near))
      .filter((p): p is MapPlace => {
        if (!p) return false;
        const k = `${p.name}|${p.location.lat.toFixed(3)},${p.location.lng.toFixed(3)}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }
}
