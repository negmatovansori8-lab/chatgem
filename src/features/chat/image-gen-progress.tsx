"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

const STAGE_KEYS = [
  "chat.imageStageSketch",
  "chat.imageStageDetails",
  "chat.imageStageLighting",
  "chat.imageStageFinalize",
] as const;

type ImageGenProgressProps = {
  className?: string;
  aspect?: "portrait" | "square" | "landscape";
  /** While true, animate progress. When false after success, parent unmounts. */
  active?: boolean;
  /** Jump to 100% when generation finished successfully. */
  complete?: boolean;
};

export function ImageGenProgress({
  className,
  aspect = "portrait",
  active = true,
  complete = false,
}: ImageGenProgressProps) {
  const { t } = useI18n();
  const [pct, setPct] = useState(6);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (complete) {
      setPct(100);
      setStage(3);
      return;
    }
    if (!active) return;
    setPct(8);
    setStage(0);
    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      // Climb toward 99% while waiting; 100% only when complete=true
      const target = Math.min(99, 8 + (elapsed / 10000) * 91);
      setPct((p) => {
        const next = p + (target - p) * 0.32 + Math.random() * 0.6;
        return Math.min(99, Math.max(p, next));
      });
      if (elapsed < 2000) setStage(0);
      else if (elapsed < 4500) setStage(1);
      else if (elapsed < 7500) setStage(2);
      else setStage(3);
    }, 160);
    return () => window.clearInterval(id);
  }, [active, complete]);

  const aspectClass =
    aspect === "landscape"
      ? "aspect-video max-w-xl"
      : aspect === "square"
        ? "aspect-square max-w-[min(100%,18rem)] sm:max-w-sm"
        : "aspect-[3/4] max-w-[min(100%,20rem)] sm:max-w-[22rem]";

  const shown = complete ? 100 : Math.round(pct);

  return (
    <div className={cn("w-full space-y-2", className)}>
      <p className="text-[15px] leading-6 text-[var(--fg)]">
        {complete
          ? t("chat.imageReady")
          : t(STAGE_KEYS[stage] ?? STAGE_KEYS[0])}
      </p>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-3xl border border-[var(--border)]",
          aspectClass,
        )}
        style={{
          backgroundColor:
            "color-mix(in oklab, var(--surface-2) 80%, var(--accent-muted))",
          backgroundImage:
            "radial-gradient(circle, color-mix(in oklab, var(--fg-subtle) 35%, transparent) 1px, transparent 1.15px)",
          backgroundSize: "12px 12px",
          backgroundPosition: "center",
        }}
        aria-busy={!complete}
        aria-label={t(STAGE_KEYS[stage] ?? STAGE_KEYS[0])}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "h-10 w-10 rounded-2xl bg-[var(--surface-3)]/80 ring-1 ring-[var(--border)]",
              !complete && "animate-pulse",
            )}
          />
        </div>
        <span className="absolute bottom-3 end-3 rounded-full bg-[var(--bg)]/90 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-[var(--fg)] shadow-sm backdrop-blur-sm">
          {shown}%
        </span>
      </div>
    </div>
  );
}
