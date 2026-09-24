"use client";

import { useEffect } from "react";
import { Download, RefreshCw, X, ZoomIn } from "lucide-react";
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
      className="fixed inset-0 z-[180] flex flex-col bg-black/92 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
          <ZoomIn className="h-3.5 w-3.5" />
          Fullscreen
        </span>
        <div className="flex items-center gap-1">
          {onDownload ? (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/15"
            >
              <Download className="h-3.5 w-3.5" />
              {downloadLabel}
            </button>
          ) : null}
          {onRegenerate ? (
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/15"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {regenerateLabel}
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

      <button
        type="button"
        className="min-h-0 flex-1 cursor-zoom-out px-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={onClose}
        aria-label="Close preview"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={cn(
            "mx-auto h-full max-h-full w-full max-w-5xl object-contain",
          )}
          onClick={(e) => e.stopPropagation()}
        />
      </button>
    </div>
  );
}
