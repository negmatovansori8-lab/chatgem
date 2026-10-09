"use client";

import { isFreshMapContext, mapContextSchema, type MapContext } from "@/lib/maps/context";

const KEY = "chatgem:maps:last";

/** Tab-scoped (sessionStorage) — cleared when the tab closes. */
export function saveMapSession(ctx: Omit<MapContext, "updatedAt" | "tzOffsetMinutes">) {
  try {
    const value: MapContext = {
      ...ctx,
      updatedAt: Date.now(),
      tzOffsetMinutes: new Date().getTimezoneOffset(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode) — follow-ups just won't have context
  }
}

export function loadMapSession(): MapContext | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = mapContextSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || !isFreshMapContext(parsed.data)) return null;
    return { ...parsed.data, tzOffsetMinutes: new Date().getTimezoneOffset() };
  } catch {
    return null;
  }
}
