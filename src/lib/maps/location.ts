"use client";

import type { LocationErrorCode, LocationFix, LocationProvider } from "@/providers/maps/types";

export class LocationError extends Error {
  constructor(readonly code: LocationErrorCode) {
    super(code);
    this.name = "LocationError";
  }
}

/**
 * Browser Geolocation API. Asks only when called (user gesture or explicit
 * map request); the fix is kept in memory and never persisted.
 */
export class BrowserLocationProvider implements LocationProvider {
  readonly id = "browser-geolocation";

  isSupported(): boolean {
    return typeof navigator !== "undefined" && "geolocation" in navigator;
  }

  getCurrentPosition(opts?: {
    timeoutMs?: number;
    maximumAge?: number;
    highAccuracy?: boolean;
  }): Promise<LocationFix> {
    return new Promise((resolve, reject) => {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        reject(new LocationError("insecure_context"));
        return;
      }
      if (!this.isSupported()) {
        reject(new LocationError("unsupported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            accuracyMeters: pos.coords.accuracy,
            timestamp: pos.timestamp,
          }),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            reject(new LocationError("permission_denied"));
            return;
          }
          // Some browsers report a blocked or dismissed prompt as a timeout.
          void this.permissionState().then((state) => {
            if (state === "denied") reject(new LocationError("permission_denied"));
            else reject(new LocationError(err.code === err.TIMEOUT ? "timeout" : "gps_unavailable"));
          });
        },
        {
          enableHighAccuracy: opts?.highAccuracy !== false,
          timeout: opts?.timeoutMs ?? 15_000,
          maximumAge: opts?.maximumAge ?? 30_000,
        },
      );
    });
  }

  /** Live updates like Google Maps' moving blue dot; returns a stop function. */
  watch(onFix: (fix: LocationFix) => void): () => void {
    if (!this.isSupported()) return () => undefined;
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        onFix({
          location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracyMeters: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }),
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }

  /** "granted" | "denied" | "prompt" | "unknown" — no prompt is shown. */
  async permissionState(): Promise<PermissionState | "unknown"> {
    try {
      const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
      return status?.state ?? "unknown";
    } catch {
      return "unknown";
    }
  }
}

export const browserLocation = new BrowserLocationProvider();

/** A reading worse than this is a Wi-Fi/cell guess, not a GPS fix. Never plot it. */
export const GPS_MAX_ACCURACY_M = 100;

export function isGpsFix(fix: LocationFix | null | undefined): boolean {
  return Boolean(
    fix &&
      !fix.approximate &&
      Number.isFinite(fix.accuracyMeters) &&
      fix.accuracyMeters > 0 &&
      fix.accuracyMeters <= GPS_MAX_ACCURACY_M,
  );
}

/** City-level fallback from the server (IP based) when the browser refuses GPS. */
export async function approximateLocation(): Promise<LocationFix | null> {
  try {
    const res = await fetch("/api/maps/ip-location", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { fix?: Omit<LocationFix, "timestamp"> };
    if (!data.fix?.location) return null;
    return { ...data.fix, approximate: true, timestamp: Date.now() };
  } catch {
    return null;
  }
}

export function locationErrorKey(code: LocationErrorCode): string {
  switch (code) {
    case "permission_denied":
      return "maps.err.permissionDenied";
    case "timeout":
      return "maps.err.locationTimeout";
    case "insecure_context":
      return "maps.err.insecure";
    case "unsupported":
      return "maps.err.unsupported";
    default:
      return "maps.err.gpsUnavailable";
  }
}
