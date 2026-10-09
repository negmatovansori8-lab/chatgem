"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ImageLightboxProps = {
  open: boolean;
  src: string | null;
  alt?: string;
  onClose: () => void;
  onDownload?: () => void;
  onRegenerate?: () => void;
  downloadLabel?: string;
  regenerateLabel?: string;
};

export function ImageLightbox({
  open,
  src,
  alt = "",
  onClose,
  onDownload,
  onRegenerate,
  downloadLabel = "Download",
  regenerateLabel = "Regenerate",
}: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setFit(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(4, z + 0.25));
      if (e.key === "-") setZoom((z) => Math.max(0.5, z - 0.25));
      if (e.key === "0") {
        setZoom(1);
        setFit(true);
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[180] flex flex-col bg-black/93 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-white/50">
          <ZoomIn className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">
            {Math.round(zoom * 100)}% · Esc to close
          </span>
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/15"
            aria-label="Zoom out"
            onClick={() => {
              setFit(false);
              setZoom((z) => Math.max(0.5, z - 0.25));
            }}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/15"
            aria-label="Zoom in"
            onClick={() => {
              setFit(false);
              setZoom((z) => Math.min(4, z + 0.25));
            }}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/15"
            aria-label={fit ? "Actual size" : "Fit to screen"}
            onClick={() => {
              if (fit) {
                setFit(false);
                setZoom(1);
              } else {
                setFit(true);
                setZoom(1);
              }
            }}
          >
            {fit ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          {onDownload ? (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-2 text-xs font-medium text-white hover:bg-white/15 sm:px-3"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{downloadLabel}</span>
            </button>
          ) : null}
          {onRegenerate ? (
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-2 text-xs font-medium text-white hover:bg-white/15 sm:px-3"
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{regenerateLabel}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/15"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto px-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-3"
        onClick={onClose}
      >
        <div className="flex min-h-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={cn(
              "rounded-lg shadow-2xl transition-transform duration-150",
              fit
                ? "max-h-[min(85vh,900px)] max-w-full object-contain"
                : "max-w-none",
            )}
            style={fit ? undefined : { transform: `scale(${zoom})`, transformOrigin: "center center" }}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
