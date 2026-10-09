"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Follows the app theme (`.dark` on <html>). */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => obs.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

type OrientationEventWithCompass = DeviceOrientationEvent & { webkitCompassHeading?: number };
type OrientationPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

export type CompassState = "off" | "starting" | "on" | "unavailable";

/**
 * Device heading from the real compass sensor (degrees clockwise from north).
 * Reports "unavailable" when no sensor reading arrives (most desktops).
 */
export function useCompass() {
  const [state, setState] = useState<CompassState>("off");
  const [heading, setHeading] = useState<number | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    setHeading(null);
    setState("off");
  }, []);

  /** Resolves with the outcome: "on" after the first real reading, otherwise "unavailable". */
  const start = useCallback(async (): Promise<CompassState> => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setState("unavailable");
      return "unavailable";
    }
    const perm = (window.DeviceOrientationEvent as unknown as OrientationPermission).requestPermission;
    if (perm) {
      try {
        if ((await perm()) !== "granted") {
          setState("unavailable");
          return "unavailable";
        }
      } catch {
        setState("unavailable");
        return "unavailable";
      }
    }
    setState("starting");
    return new Promise<CompassState>((resolve) => {
      let got = false;
      const onEvent = (e: Event) => {
        const ev = e as OrientationEventWithCompass;
        const h =
          typeof ev.webkitCompassHeading === "number"
            ? ev.webkitCompassHeading
            : ev.absolute && typeof ev.alpha === "number"
              ? (360 - ev.alpha) % 360
              : null;
        if (h == null || Number.isNaN(h)) return;
        if (!got) resolve("on");
        got = true;
        setHeading(Math.round(h));
        setState("on");
      };
      const type = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
      window.addEventListener(type, onEvent);
      const timer = window.setTimeout(() => {
        if (got) return;
        window.removeEventListener(type, onEvent);
        cleanup.current = null;
        setState("unavailable");
        resolve("unavailable");
      }, 1800);
      cleanup.current = () => {
        window.clearTimeout(timer);
        window.removeEventListener(type, onEvent);
        if (!got) resolve("off");
      };
    });
  }, []);

  useEffect(() => () => cleanup.current?.(), []);

  const toggle = useCallback(async (): Promise<CompassState> => {
    if (state === "on" || state === "starting") {
      stop();
      return "off";
    }
    return start();
  }, [start, state, stop]);

  return { state, heading, toggle, stop };
}
