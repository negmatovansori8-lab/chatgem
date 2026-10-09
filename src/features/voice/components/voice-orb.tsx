"use client";

import { useEffect, useRef } from "react";
import type { VoiceEngine, VoicePhase } from "@/features/voice/voice-engine";
import { cn } from "@/lib/utils";

const BARS = 24;

type Props = {
  engine: VoiceEngine;
  phase: VoicePhase;
  muted: boolean;
  size?: "lg" | "sm";
  className?: string;
};

/** Animated orb + waveform. Reads audio levels in rAF — no React re-renders per frame. */
export function VoiceOrb({ engine, phase, muted, size = "lg", className }: Props) {
  const orbRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  const mutedRef = useRef(muted);

  useEffect(() => {
    phaseRef.current = phase;
    mutedRef.current = muted;
  }, [phase, muted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const orb = orbRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !orb || !g) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bins = new Uint8Array(512);
    const heights = new Float32Array(BARS);
    let amp = 0;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      const t = time / 1000;
      const p = phaseRef.current;
      const live = (p === "listening" || p === "hearing") && !mutedRef.current;

      let target = 0.04;
      if (live) target = Math.min(1, engine.level() * 1.4);
      else if (p === "speaking") target = 0.42 + 0.22 * Math.sin(t * 7.3) * Math.sin(t * 2.9);
      else if (p === "thinking" || p === "transcribing" || p === "connecting") target = 0.16 + 0.08 * Math.sin(t * 3);
      if (reduced) target *= 0.35;
      amp += (target - amp) * 0.22;

      orb.style.setProperty("--voice-lvl", amp.toFixed(3));

      if (live) engine.frequencies(bins);
      const w = canvas.width;
      const h = canvas.height;
      g.clearRect(0, 0, w, h);
      const gap = w / (BARS * 2.2);
      const barW = gap * 1.2;
      const total = BARS * barW + (BARS - 1) * gap;
      const x0 = (w - total) / 2;
      g.fillStyle = "rgba(255,255,255,0.92)";

      for (let i = 0; i < BARS; i++) {
        const center = 1 - Math.abs(i - (BARS - 1) / 2) / (BARS / 2);
        let v: number;
        if (live) {
          // Voice band (~80 Hz – 4 kHz) spread across the bars, mirrored from the middle.
          const idx = Math.floor(2 + Math.abs(i - (BARS - 1) / 2) * 3.2);
          v = ((bins[idx] ?? 0) / 255) * (0.35 + amp * 1.2);
        } else if (p === "speaking") {
          v = amp * (0.45 + 0.55 * Math.abs(Math.sin(t * 5 + i * 0.55))) * (0.4 + center * 0.6);
        } else {
          v = amp * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 0.4)) * (0.3 + center * 0.7);
        }
        heights[i] = heights[i]! + (Math.min(1, v) - heights[i]!) * 0.35;
        const bh = Math.max(barW, heights[i]! * h * 0.8);
        const x = x0 + i * (barW + gap);
        const y = (h - bh) / 2;
        if (typeof g.roundRect === "function") {
          g.beginPath();
          g.roundRect(x, y, barW, bh, barW / 2);
          g.fill();
        } else {
          g.fillRect(x, y, barW, bh);
        }
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [engine]);

  return (
    <div
      ref={orbRef}
      aria-hidden
      className={cn(
        "cg-voice-orb relative grid place-items-center rounded-full",
        size === "lg" ? "h-44 w-44 sm:h-52 sm:w-52" : "h-10 w-10",
        `cg-voice-orb--${phase}`,
        muted && "cg-voice-orb--muted",
        className,
      )}
    >
      <span className="cg-voice-orb__halo" />
      <span className="cg-voice-orb__core" />
      <canvas ref={canvasRef} className={cn("relative", size === "lg" ? "h-16 w-28 sm:h-20 sm:w-32" : "h-5 w-7")} />
    </div>
  );
}
