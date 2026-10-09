import type { BBox, LatLng } from "@/providers/maps/types";

const EARTH_R = 6371000;

export function inBBox(p: LatLng, b: BBox): boolean {
  return p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Step count derived from a REAL walking-route distance (~0.78 m per step).
 * Never feed it straight-line distance; always label as approximate.
 */
export function estimateSteps(walkingRouteMeters: number): number {
  return Math.max(1, Math.round(walkingRouteMeters / 0.78));
}

export function formatDistance(meters: number, locale = "en"): string {
  const lang = locale.split("-")[0]?.toLowerCase() ?? "en";
  if (meters < 1000) {
    const m = meters < 100 ? Math.round(meters) : Math.round(meters / 10) * 10;
    if (lang === "tg") return `${m} метр`;
    if (lang === "ru") return `${m} м`;
    return `${m} m`;
  }
  const km = meters / 1000;
  const value = km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString("ru-RU");
  if (lang === "ru" || lang === "tg") return `${value} км`;
  return `${value} km`;
}

/**
 * "18:47" — arrival clock = now + real route duration; "02.10 18:47" when the
 * arrival is on another day (long trips).
 * Uses the device timezone, or `tzOffsetMinutes` (Date#getTimezoneOffset of
 * the user's device) when rendered on the server.
 */
export function formatClock(seconds: number, now = new Date(), tzOffsetMinutes?: number): string {
  const arrivalMs = now.getTime() + Math.max(0, seconds) * 1000;
  const parts = (ms: number) => {
    if (tzOffsetMinutes != null) {
      const d = new Date(ms - tzOffsetMinutes * 60_000);
      return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), m: d.getUTCMinutes() };
    }
    const d = new Date(ms);
    return { y: d.getFullYear(), mo: d.getMonth(), d: d.getDate(), h: d.getHours(), m: d.getMinutes() };
  };
  const a = parts(arrivalMs);
  const today = parts(now.getTime());
  const clock = `${String(a.h).padStart(2, "0")}:${String(a.m).padStart(2, "0")}`;
  if (a.y === today.y && a.mo === today.mo && a.d === today.d) return clock;
  return `${String(a.d).padStart(2, "0")}.${String(a.mo + 1).padStart(2, "0")} ${clock}`;
}

function ruMinutes(n: number) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return `${n} минута`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${n} минуты`;
  return `${n} минут`;
}

function ruHours(n: number) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return `${n} час`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${n} часа`;
  return `${n} часов`;
}

function ruDays(n: number) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return `${n} день`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${n} дня`;
  return `${n} дней`;
}

function tgMinutes(n: number) {
  return `${n} дақиқа`;
}

function tgHours(n: number) {
  return `${n} соат`;
}

/** Human travel time from routing provider seconds (real ETA, not invented). */
export function formatDuration(seconds: number, locale = "en"): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  const lang = locale.split("-")[0]?.toLowerCase() ?? "en";

  if (mins < 60) {
    if (lang === "ru") return ruMinutes(mins);
    if (lang === "tg") return tgMinutes(mins);
    return mins === 1 ? "1 minute" : `${mins} minutes`;
  }

  if (mins >= 24 * 60) {
    const totalHours = Math.round(mins / 60);
    const d = Math.floor(totalHours / 24);
    const h = totalHours % 24;
    if (lang === "ru") return h > 0 ? `${ruDays(d)} ${ruHours(h)}` : ruDays(d);
    if (lang === "tg") return h > 0 ? `${d} рӯз ${tgHours(h)}` : `${d} рӯз`;
    const days = d === 1 ? "1 day" : `${d} days`;
    return h > 0 ? `${days} ${h} h` : days;
  }

  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (lang === "ru") {
    return m > 0 ? `${ruHours(h)} ${ruMinutes(m)}` : ruHours(h);
  }
  if (lang === "tg") {
    return m > 0 ? `${tgHours(h)} ${tgMinutes(m)}` : tgHours(h);
  }
  if (m === 0) return h === 1 ? "1 hour" : `${h} hours`;
  return `${h} h ${m} min`;
}

/** "in 18 minutes" / "через 18 минут" — relative arrival from now. */
export function formatArrivalRelative(seconds: number, locale = "en"): string {
  const body = formatDuration(seconds, locale);
  const lang = locale.split("-")[0]?.toLowerCase() ?? "en";
  if (lang === "ru") return `через ${body}`;
  if (lang === "tg") return `пас аз ${body}`;
  return `in ${body}`;
}

/** Clock time = now + route duration (local device time). */
export function formatArrivalClock(
  seconds: number,
  locale = "en",
  now = new Date(),
): string {
  const lang = locale.split("-")[0]?.toLowerCase() ?? "en";
  const time = formatClock(seconds, now);
  if (lang === "ru") return `примерно в ${time}`;
  if (lang === "tg") return `тақрибан соати ${time}`;
  return `around ${time}`;
}

export function decodeOsrmPolyline(encoded: string): LatLng[] {
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const coordinates: LatLng[] = [];

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return coordinates;
}
