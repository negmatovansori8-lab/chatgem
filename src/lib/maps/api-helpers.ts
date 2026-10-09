import { NextResponse } from "next/server";
import {
  MapsError,
  httpStatusFor,
  toMapsError,
  type MapsErrorCode,
} from "@/providers/maps/errors";
import type { LatLng } from "@/providers/maps/types";

export function parseLatLng(v: unknown): LatLng | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as { lat?: unknown; lng?: unknown };
  const lat = typeof o.lat === "number" ? o.lat : Number.NaN;
  const lng = typeof o.lng === "number" ? o.lng : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng };
}

export function parseLocale(v: unknown): string {
  return typeof v === "string" && /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(v) ? v : "tg";
}

export function mapsErrorResponse(e: unknown) {
  const err = toMapsError(e);
  return NextResponse.json(
    { error: { code: err.code } },
    { status: httpStatusFor(err.code) },
  );
}

export function mapsError(code: MapsErrorCode) {
  return mapsErrorResponse(new MapsError(code));
}

/** Per-client sliding window — shields free upstream providers from abuse. */
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 90;

export function rateLimited(req: Request): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return list.length > MAX_PER_WINDOW;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await req.json()) as unknown;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
