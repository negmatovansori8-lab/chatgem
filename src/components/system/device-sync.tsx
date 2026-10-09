"use client";

import { useLayoutEffect } from "react";
import { applyAccent, storedAccent } from "@/lib/accent";
import { applyDeviceAttributes } from "@/lib/device-profile";

/** Keeps `<html data-device>` and the accent in sync after the boot script (resize, dev remounts). */
export function DeviceSync() {
  useLayoutEffect(() => {
    applyDeviceAttributes();
    applyAccent(storedAccent());
    const onResize = () => applyDeviceAttributes();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return null;
}
