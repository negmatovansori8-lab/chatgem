"use client";

import { cn } from "@/lib/utils";
import styles from "./brand-mark.module.css";

/** Flat gem mark. One shape, two blues, no photos and no extra icons. */
function MarkGlyph() {
  return (
    <svg viewBox="0 0 64 64" className={styles.glyph} aria-hidden>
      <circle cx="32" cy="32" r="32" fill="#050814" />
      <path d="M32 14 47 26 32 30 17 26Z" fill="#7DD3FC" />
      <path d="M32 14 47 26 32 30Z" fill="#BFDBFE" />
      <path d="M47 26 42 35 32 30Z" fill="#2563EB" />
      <path d="M17 26 22 35 32 30Z" fill="#1D4ED8" />
      <path d="M42 35 32 51 32 30Z" fill="#1E3A8A" />
      <path d="M22 35 32 51 32 30Z" fill="#172554" />
      <path d="M32 14 36.5 19.5 32 22.5 27.5 19.5Z" fill="#FFFFFF" />
    </svg>
  );
}

export type BrandMarkSize = "xs" | "sm" | "md" | "lg" | "xl";

const BOX: Record<BrandMarkSize, string> = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-14 w-14",
  xl: "h-16 w-16",
};

/**
 * ChatGem mark: a flat gem on a dark disc.
 * `tile` adds the glow used on hero surfaces; `animate` adds the intro or the loading pulse.
 */
export function BrandMark({
  size = "md",
  tile = false,
  animate = "none",
  title,
  className,
}: {
  size?: BrandMarkSize;
  tile?: boolean | "dark" | "light";
  animate?: "none" | "intro" | "loop";
  /** Accessible name; omit when the brand name is already next to the mark. */
  title?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        styles.root,
        BOX[size],
        tile && styles.glow,
        animate === "intro" && styles.intro,
        animate === "loop" && styles.loop,
        className,
      )}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <MarkGlyph />
    </span>
  );
}

/** Two-tone wordmark matching the logo: blue «Chat», neutral «Gem». */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-body)] font-semibold leading-none tracking-[-0.03em] text-[color:var(--landing-fg,var(--fg))]",
        className,
      )}
    >
      <span className="bg-gradient-to-r from-[#1d6ff2] to-[#38bdf8] bg-clip-text text-transparent">Chat</span>
      Gem
    </span>
  );
}
