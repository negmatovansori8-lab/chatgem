"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapsApiError,
  fetchMatrix,
  peekReverseGeocode,
  reverseGeocode,
  type ClientErrorCode,
} from "@/lib/maps/client";
import type { LatLng, MapPlace, RouteMetrics } from "@/providers/maps/types";

/** Rapid taps (or a double-tap that slipped through) resolve only the last point. */
const LOOKUP_DEBOUNCE_MS = 180;

export type PointState =
  | { status: "idle" }
  | { status: "loading"; point: LatLng }
  | { status: "done"; point: LatLng; place: MapPlace | null }
  | { status: "error"; point: LatLng; code: ClientErrorCode };

function codeOf(e: unknown): ClientErrorCode {
  return e instanceof MapsApiError ? e.code : "api_error";
}

/** Reverse geocoding of a tapped map point — one request per tap, never on pan/zoom. */
export function usePointLookup(locale: string) {
  const [state, setState] = useState<PointState>({ status: "idle" });
  const ctrl = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    ctrl.current?.abort();
    ctrl.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const lookup = useCallback(
    (point: LatLng) => {
      cancel();
      const cached = peekReverseGeocode(point, locale);
      if (cached !== undefined) {
        setState({ status: "done", point, place: cached });
        return;
      }
      setState({ status: "loading", point });
      const c = new AbortController();
      ctrl.current = c;
      timer.current = setTimeout(() => {
        reverseGeocode(point, locale, c.signal)
          .then((place) => {
            if (!c.signal.aborted) setState({ status: "done", point, place });
          })
          .catch((e: unknown) => {
            const code = codeOf(e);
            if (c.signal.aborted || code === "aborted") return;
            setState({ status: "error", point, code });
          });
      }, LOOKUP_DEBOUNCE_MS);
    },
    [cancel, locale],
  );

  const clear = useCallback(() => {
    cancel();
    setState({ status: "idle" });
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { state, lookup, clear };
}

export type PointMetricsState = {
  loading: boolean;
  walk: RouteMetrics | null;
  drive: RouteMetrics | null;
  /** The routing provider failed for that mode — unknown, not "no route". */
  walkFailed: boolean;
  driveFailed: boolean;
  error: ClientErrorCode | null;
};

type MetricsResult = Omit<PointMetricsState, "loading">;

const metricsCache = new Map<string, MetricsResult>();
const METRICS_CACHE_MAX = 60;

/**
 * Real network distance/time (walking + driving) from the user to the point.
 * Keyed to ~100 m of user movement so live GPS updates don't refetch.
 */
export function usePointMetrics(point: LatLng | null, from: LatLng | null): PointMetricsState {
  const key =
    point && from
      ? `${point.lat.toFixed(5)},${point.lng.toFixed(5)}>${from.lat.toFixed(3)},${from.lng.toFixed(3)}`
      : "";
  const [result, setResult] = useState<{ key: string } & MetricsResult>();
  const latest = useRef({ point, from });
  useEffect(() => {
    latest.current = { point, from };
  }, [point, from]);

  const cached = key ? metricsCache.get(key) : undefined;

  useEffect(() => {
    const { point: to, from: start } = latest.current;
    if (!key || !to || !start || metricsCache.has(key)) return;
    const c = new AbortController();
    fetchMatrix(start, [to], c.signal)
      .then((res) => {
        const value: MetricsResult = {
          walk: res.walking?.[0] ?? null,
          drive: res.driving?.[0] ?? null,
          walkFailed: Boolean(res.errors?.walking),
          driveFailed: Boolean(res.errors?.driving),
          error: null,
        };
        if (!value.walkFailed && !value.driveFailed) {
          if (metricsCache.size >= METRICS_CACHE_MAX) metricsCache.delete(metricsCache.keys().next().value!);
          metricsCache.set(key, value);
        }
        if (!c.signal.aborted) setResult({ key, ...value });
      })
      .catch((e: unknown) => {
        const code = codeOf(e);
        if (c.signal.aborted || code === "aborted") return;
        setResult({ key, walk: null, drive: null, walkFailed: true, driveFailed: true, error: code });
      });
    return () => c.abort();
  }, [key]);

  const current = cached ?? (result?.key === key ? result : undefined);
  return {
    loading: Boolean(key) && !current,
    walk: current?.walk ?? null,
    drive: current?.drive ?? null,
    walkFailed: current?.walkFailed ?? false,
    driveFailed: current?.driveFailed ?? false,
    error: current?.error ?? null,
  };
}
