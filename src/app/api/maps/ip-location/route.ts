import { NextResponse } from "next/server";
import { mapsError, rateLimited } from "@/lib/maps/api-helpers";

export const runtime = "nodejs";

/** City-level radius — IP lookups are never street-accurate. */
const APPROX_ACCURACY_M = 5_000;
const TIMEOUT_MS = 5_000;

type IpFix = { lat: number; lng: number; city?: string; region?: string; country?: string };

function clientIp(req: Request): string | null {
  const raw =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "";
  const ip = raw.replace(/^::ffff:/, "");
  if (!/^[\d.]+$|^[\da-f:]+$/i.test(ip)) return null;
  // Loopback / private ranges: let the provider use the server's public egress IP (local dev).
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd])/i.test(ip)) return null;
  return ip;
}

function valid(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

async function fromIpwho(ip: string | null): Promise<IpFix | null> {
  const res = await fetch(
    `https://ipwho.is/${ip ?? ""}?fields=success,latitude,longitude,city,region,country`,
    { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" },
  );
  if (!res.ok) return null;
  const j = (await res.json()) as Record<string, unknown>;
  if (j.success !== true || !valid(j.latitude, j.longitude)) return null;
  return {
    lat: j.latitude as number,
    lng: j.longitude as number,
    city: typeof j.city === "string" ? j.city : undefined,
    region: typeof j.region === "string" ? j.region : undefined,
    country: typeof j.country === "string" ? j.country : undefined,
  };
}

async function fromGeojs(ip: string | null): Promise<IpFix | null> {
  const res = await fetch(
    ip ? `https://get.geojs.io/v1/ip/geo/${ip}.json` : "https://get.geojs.io/v1/ip/geo.json",
    { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" },
  );
  if (!res.ok) return null;
  const j = (await res.json()) as Record<string, unknown>;
  const lat = Number(j.latitude);
  const lng = Number(j.longitude);
  if (!valid(lat, lng)) return null;
  return {
    lat,
    lng,
    city: typeof j.city === "string" ? j.city : undefined,
    region: typeof j.region === "string" ? j.region : undefined,
    country: typeof j.country === "string" ? j.country : undefined,
  };
}

/**
 * Approximate (city-level) position from the caller's IP, used only when the
 * browser refuses GPS. Nothing is logged or stored.
 */
export async function GET(req: Request) {
  if (rateLimited(req)) return mapsError("rate_limit");
  const ip = clientIp(req);
  for (const lookup of [fromIpwho, fromGeojs]) {
    try {
      const fix = await lookup(ip);
      if (!fix) continue;
      const place = [fix.city, fix.country].filter(Boolean).join(", ");
      return NextResponse.json(
        {
          fix: {
            location: { lat: fix.lat, lng: fix.lng },
            accuracyMeters: APPROX_ACCURACY_M,
            approximate: true,
            place: place || undefined,
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      // try the next provider
    }
  }
  return mapsError("place_not_found");
}
