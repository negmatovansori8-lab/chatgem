import { useSyncExternalStore } from "react";

export type DeviceKind = "phone" | "tablet" | "laptop" | "desktop";

export type DeviceProfile = {
  kind: DeviceKind;
  touch: boolean;
  width: number;
  height: number;
};

/**
 * Keep in sync with `BOOT_SCRIPT` in `boot-script.ts`: the physical screen and the pointer decide the device class,
 * so a narrow laptop window stays "laptop" and a phone in landscape stays "phone".
 */
export function detectDeviceKind(): DeviceKind {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  const ua = nav.userAgent || "";
  const touch = (nav.maxTouchPoints || 0) > 0;
  const coarseOnly =
    window.matchMedia("(pointer: coarse)").matches &&
    !window.matchMedia("(any-pointer: fine)").matches;
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && touch);
  const tabletUa = ipad || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || /Tablet|Silk|Kindle/i.test(ua);
  const phoneUa = nav.userAgentData?.mobile === true || /iPhone|iPod|Android.+Mobile|Windows Phone|Mobi/i.test(ua);
  const shortSide = Math.min(screen.width, screen.height);
  const longSide = Math.max(screen.width, screen.height);

  if (tabletUa) return "tablet";
  if (phoneUa) return "phone";
  if (coarseOnly) return shortSide < 600 ? "phone" : "tablet";
  return longSide >= 1680 && shortSide >= 950 ? "desktop" : "laptop";
}

export function applyDeviceAttributes(kind = detectDeviceKind()) {
  const root = document.documentElement;
  root.dataset.device = kind;
  root.dataset.touch = navigator.maxTouchPoints > 0 ? "1" : "0";
}

let cached: DeviceProfile | null = null;
const serverProfile: DeviceProfile = { kind: "laptop", touch: false, width: 0, height: 0 };

function read(): DeviceProfile {
  const next: DeviceProfile = {
    kind: detectDeviceKind(),
    touch: navigator.maxTouchPoints > 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  if (
    cached &&
    cached.kind === next.kind &&
    cached.touch === next.touch &&
    cached.width === next.width &&
    cached.height === next.height
  ) {
    return cached;
  }
  cached = next;
  return next;
}

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}

export function useDeviceProfile(): DeviceProfile {
  return useSyncExternalStore(subscribe, read, () => serverProfile);
}
