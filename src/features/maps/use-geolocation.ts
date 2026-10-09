"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocationError, approximateLocation, browserLocation, isGpsFix } from "@/lib/maps/location";
import type { LocationErrorCode, LocationFix, LocationProvider } from "@/providers/maps/types";

export type GeoStatus = "idle" | "locating" | "ready" | "error";

/** How long to wait for a precise GPS fix before keeping a network reading. */
const GPS_WAIT_MS = 12_000;
/** A computer has no GPS chip; accept a Wi-Fi or IP reading after this. */
const COARSE_WAIT_MS = 4_000;

function usable(fix: LocationFix): LocationFix {
  return isGpsFix(fix) ? { ...fix, approximate: false } : { ...fix, approximate: true };
}

function prefer(prev: LocationFix | null, next: LocationFix): LocationFix {
  const candidate = usable(next);
  if (!prev) return candidate;
  if (isGpsFix(candidate) && !isGpsFix(prev)) return candidate;
  if (!isGpsFix(candidate) && isGpsFix(prev)) return prev;
  return candidate.accuracyMeters <= prev.accuracyMeters ? candidate : prev;
}

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
    const next = prefer(fixRef.current, f);
    fixRef.current = next;
    setFix(next);
  }, []);

  const startWatch = useCallback(() => {
    if (stopWatch.current || !provider.watch) return;
    stopWatch.current = provider.watch((f) => {
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

      const finish = (next: LocationFix | null, code: LocationErrorCode | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(hardTimer);
        window.clearTimeout(refineTimer);
        stopTemp?.();
        stopTemp = null;
        if (next) {
          apply(next);
          setError(null);
          errorRef.current = null;
          setStatus("ready");
          if (!next.approximate) setPermission("granted");
          startWatch();
          resolve(fixRef.current);
          return;
        }
        const codeFinal = code ?? "gps_unavailable";
        errorRef.current = codeFinal;
        setError(codeFinal);
        if (codeFinal === "permission_denied") setPermission("denied");
        fixRef.current = null;
        setFix(null);
        setStatus("error");
        resolve(null);
      };

      const settle = (next: LocationFix | null, code: LocationErrorCode | null) => {
        if (settled) return;
        if (next) {
          finish(next, null);
          return;
        }
        void approximateLocation().then((ip) => {
          if (ip) finish(ip, null);
          else finish(null, code);
        });
      };

      let best: LocationFix | null = null;

      const note = (f: LocationFix) => {
        if (settled) return;
        const next = prefer(best, f);
        best = next;
        apply(next);
        setStatus("ready");
        setError(null);
        if (isGpsFix(next)) settle(next, null);
      };

      const listenForGps = () => {
        if (settled || stopTemp || !provider.watch) return;
        stopTemp = provider.watch((f) => note(f));
      };

      hardTimer = window.setTimeout(() => settle(best, "gps_unavailable"), GPS_WAIT_MS);
      refineTimer = window.setTimeout(() => {
        if (best) settle(best, null);
      }, COARSE_WAIT_MS);

      const ask = (highAccuracy: boolean, timeoutMs: number) =>
        provider
          .getCurrentPosition({
            highAccuracy,
            timeoutMs,
            maximumAge: opts?.fresh ? 0 : 60_000,
          })
          .then((f) => note(f))
          .catch((e: unknown) => {
            if (settled) return;
            const code = e instanceof LocationError ? e.code : "gps_unavailable";
            if (code === "permission_denied" || code === "unsupported" || code === "insecure_context") {
              settle(null, code);
            }
          });

      listenForGps();
      void ask(false, COARSE_WAIT_MS);
      void ask(true, GPS_WAIT_MS);
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
        const ip = await approximateLocation();
        if (cancelled) return;
        if (ip) {
          apply(ip);
          setStatus("ready");
          setError(null);
          errorRef.current = null;
        } else {
          errorRef.current = "permission_denied";
          setError("permission_denied");
          setStatus("error");
        }
      }
      if (!cancelled) setAutoChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [apply, locate, provider]);

  const getLatest = useCallback(() => fixRef.current, []);
  /** Why the last `locate()` failed (readable right after its promise resolves to null). */
  const getLastError = useCallback(() => errorRef.current, []);

  return useMemo(
    () => ({
      fix,
      location: fix?.location ?? null,
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
