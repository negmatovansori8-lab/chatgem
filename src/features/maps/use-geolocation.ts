"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocationError, browserLocation, isGpsFix } from "@/lib/maps/location";
import type { LocationErrorCode, LocationFix, LocationProvider } from "@/providers/maps/types";

export type GeoStatus = "idle" | "locating" | "ready" | "error";

/** How long to wait for a real GPS fix before giving up. */
const GPS_WAIT_MS = 20_000;
/** After a coarse network reading, keep listening this long for GPS to refine it. */
const REFINE_MS = 8_000;

/**
 * Device GPS only. Prompts when `locate()` runs. A granted permission is
 * reused silently on mount. Network and IP guesses are never stored.
 * After the first GPS fix, the marker follows the device. Nothing is persisted.
 */
export function useGeolocation(provider: LocationProvider & {
  permissionState?: () => Promise<PermissionState | "unknown">;
  watch?: (onFix: (fix: LocationFix) => void) => () => void;
} = browserLocation) {
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [error, setError] = useState<LocationErrorCode | null>(null);
  const [permission, setPermission] = useState<PermissionState | "unknown" | null>(null);
  const fixRef = useRef<LocationFix | null>(null);
  const errorRef = useRef<LocationErrorCode | null>(null);
  const inflight = useRef<Promise<LocationFix | null> | null>(null);
  const stopWatch = useRef<(() => void) | null>(null);

  const apply = useCallback((f: LocationFix) => {
    if (!isGpsFix(f)) return;
    fixRef.current = f;
    setFix(f);
  }, []);

  const startWatch = useCallback(() => {
    if (stopWatch.current || !provider.watch) return;
    stopWatch.current = provider.watch((f) => {
      if (!isGpsFix(f)) return;
      apply(f);
      setStatus("ready");
      setError(null);
    });
  }, [apply, provider]);

  useEffect(() => () => stopWatch.current?.(), []);

  const locate = useCallback((opts?: { fresh?: boolean }): Promise<LocationFix | null> => {
    if (inflight.current) return inflight.current;
    setStatus("locating");
    setError(null);
    errorRef.current = null;

    const p = new Promise<LocationFix | null>((resolve) => {
      let settled = false;
      let stopTemp: (() => void) | null = null;
      let hardTimer = 0;
      let refineTimer = 0;

      const settle = (next: LocationFix | null, code: LocationErrorCode | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(hardTimer);
        window.clearTimeout(refineTimer);
        stopTemp?.();
        stopTemp = null;
        if (next && isGpsFix(next)) {
          apply(next);
          setError(null);
          errorRef.current = null;
          setStatus("ready");
          setPermission("granted");
          startWatch();
          resolve(next);
          return;
        }
        const codeFinal = code ?? "gps_unavailable";
        errorRef.current = codeFinal;
        setError(codeFinal);
        if (codeFinal === "permission_denied") setPermission("denied");
        const kept = isGpsFix(fixRef.current) ? fixRef.current : null;
        if (!kept) {
          fixRef.current = null;
          setFix(null);
          setStatus("error");
        } else {
          setStatus("ready");
        }
        resolve(kept);
      };

      const listenForGps = () => {
        if (settled || stopTemp || !provider.watch) return;
        stopTemp = provider.watch((f) => {
          if (isGpsFix(f)) settle(f, null);
        });
      };

      hardTimer = window.setTimeout(() => settle(null, "gps_unavailable"), GPS_WAIT_MS);

      void provider
        .getCurrentPosition({ timeoutMs: GPS_WAIT_MS, maximumAge: opts?.fresh ? 0 : 0 })
        .then((f) => {
          if (settled) return;
          if (isGpsFix(f)) {
            settle(f, null);
            return;
          }
          // A Wi-Fi/cell reading is not the user's position. Wait for GPS to refine it.
          listenForGps();
          if (!settled && !refineTimer) refineTimer = window.setTimeout(() => settle(null, "gps_unavailable"), REFINE_MS);
        })
        .catch((e: unknown) => {
          if (settled) return;
          const code = e instanceof LocationError ? e.code : "gps_unavailable";
          if (code === "permission_denied" || code === "unsupported" || code === "insecure_context") {
            settle(null, code);
            return;
          }
          listenForGps();
          if (!settled && !refineTimer) refineTimer = window.setTimeout(() => settle(null, code), REFINE_MS);
        });
    }).finally(() => {
      inflight.current = null;
    });

    inflight.current = p;
    return p;
  }, [apply, provider, startWatch]);

  const [autoChecked, setAutoChecked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const state = (await provider.permissionState?.()) ?? "unknown";
      if (cancelled) return;
      setPermission(state);
      if (state === "granted") await locate();
      else if (state === "denied") {
        errorRef.current = "permission_denied";
        setError("permission_denied");
        setStatus("error");
      }
      if (!cancelled) setAutoChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [locate, provider]);

  const getLatest = useCallback(() => (isGpsFix(fixRef.current) ? fixRef.current : null), []);
  /** Why the last `locate()` failed (readable right after its promise resolves to null). */
  const getLastError = useCallback(() => errorRef.current, []);

  return useMemo(
    () => ({
      fix: isGpsFix(fix) ? fix : null,
      location: isGpsFix(fix) ? fix.location : null,
      status,
      error,
      permission,
      locate,
      /** True once the silent permission check finished. */
      autoChecked,
      getLatest,
      getLastError,
    }),
    [autoChecked, error, fix, getLastError, getLatest, locate, permission, status],
  );
}
