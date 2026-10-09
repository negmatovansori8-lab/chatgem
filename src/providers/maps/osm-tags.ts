import type { PlaceDetails } from "@/providers/maps/types";

function first(v: string | undefined, max: number): string | undefined {
  const s = v?.split(";")[0]?.trim();
  return s && s.length <= max ? s : undefined;
}

function safeUrl(v: string | undefined): string | undefined {
  const raw = first(v, 300);
  if (!raw) return undefined;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : /^[\w-]+(\.[\w-]+)+/.test(raw) ? `https://${raw}` : "";
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Contact/hours published in OSM tags (Overpass `tags`, Nominatim `extratags`). */
export function detailsFromTags(tags: Record<string, string> | undefined): PlaceDetails | undefined {
  if (!tags) return undefined;
  const wheelchair = tags.wheelchair;
  const details: PlaceDetails = {
    phone: first(tags.phone || tags["contact:phone"] || tags["contact:mobile"], 40),
    website: safeUrl(tags.website || tags["contact:website"] || tags.url),
    // Rules are ";"-separated ("Mo-Fr 08:00-20:00; Sa 09:00-14:00") — keep them all.
    openingHours: tags.opening_hours?.trim().slice(0, 160) || undefined,
    cuisine: first(tags.cuisine, 60)?.replace(/_/g, " "),
    wheelchair: wheelchair === "yes" || wheelchair === "no" || wheelchair === "limited" ? wheelchair : undefined,
    operator: first(tags.operator || tags.brand, 80),
  };
  const clean = Object.fromEntries(Object.entries(details).filter(([, v]) => v)) as PlaceDetails;
  return Object.keys(clean).length ? clean : undefined;
}
