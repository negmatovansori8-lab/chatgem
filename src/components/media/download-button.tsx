"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, Check, Download, Pause, Play, RotateCw, X } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { buildDownloadName, mediaKindOf, mimeFromUrl, type DownloadMeta, type MediaKind } from "@/lib/downloads/filename";
import {
  DownloadError,
  PAUSE,
  downloadToDevice,
  isResumable,
  type DownloadErrorCode,
  type DownloadPartial,
  type DownloadSource,
} from "@/lib/downloads/client";
import { downloadKey, downloadedName, rememberDownload, subscribeDownloads } from "@/lib/downloads/history";

type Phase =
  | { phase: "idle" }
  | { phase: "downloading"; loaded: number; total: number | null }
  | { phase: "paused"; loaded: number; total: number | null }
  | { phase: "error"; code: DownloadErrorCode }
  | { phase: "confirm" };

const CONFIRM_MS = 4000;

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const SAVED_KEY: Record<MediaKind, string> = {
  image: "download.savedImage",
  video: "download.savedVideo",
  audio: "download.savedAudio",
  file: "download.savedFile",
};

const LABEL_KEY: Record<MediaKind, string> = {
  image: "download.image",
  video: "download.video",
  audio: "download.audioFile",
  file: "download.file",
};

/** One-tap download for existing buttons (lightbox, gallery): same naming, validation and messages, no inline progress. */
export function useQuickDownload() {
  const { t } = useI18n();
  const toast = useToast();
  return async (url: string, meta?: DownloadMeta) => {
    const key = downloadKey(url);
    const name = downloadedName(key) ?? buildDownloadName({ ...meta, url, date: new Date() });
    try {
      const saved = await downloadToDevice({ url }, name, {
        signal: new AbortController().signal,
        onProgress: () => undefined,
      });
      rememberDownload(key, saved.name);
      const message = saved.shared
        ? "download.savedShared"
        : saved.handedOff
          ? "download.handedOff"
          : SAVED_KEY[mediaKindOf(saved.mimeType)];
      toast.success(t(message).replace("{name}", saved.name));
    } catch (err) {
      const code = err instanceof DownloadError ? err.code : "failed";
      if (code !== "cancelled") toast.error(t(`download.error.${code}`));
    }
  };
}

export type DownloadButtonProps = {
  source: DownloadSource;
  /** Title / artist / type used for «Artist - Song.mp3», «Image Name.jpg». */
  meta?: DownloadMeta;
  /** Identifies the media for the В«DownloadedВ» state (defaults to the URL). */
  cacheKey?: string;
  /** Visible text in the idle state (defaults to В«DownloadВ»). */
  label?: string;
  /** Icon-only button until a download starts (for overlays on thumbnails). */
  compact?: boolean;
  /** `ghost` blends into a row of text actions while idle. */
  variant?: "pill" | "ghost";
  className?: string;
};

export function DownloadButton({
  source,
  meta,
  cacheKey,
  label,
  compact,
  variant = "pill",
  className,
}: DownloadButtonProps) {
  const { t } = useI18n();
  const toast = useToast();
  const [state, setState] = useState<Phase>({ phase: "idle" });
  const ctrlRef = useRef<AbortController | null>(null);
  const confirmTimer = useRef<number | undefined>(undefined);
  const lastTick = useRef({ pct: -1, loaded: 0 });
  const partialRef = useRef<DownloadPartial | undefined>(undefined);
  const nameRef = useRef<string | null>(null);
  const resumable = isResumable(source);

  const url = "url" in source ? source.url : undefined;
  const key = cacheKey ?? downloadKey("url" in source ? source.url : source.request.url);
  const savedName = useSyncExternalStore(
    subscribeDownloads,
    () => downloadedName(key),
    () => null,
  );
  const mime = meta?.mimeType || mimeFromUrl(url);
  const kind = mediaKindOf(mime);
  const aria = t(LABEL_KEY[kind]);

  useEffect(
    () => () => {
      ctrlRef.current?.abort();
      window.clearTimeout(confirmTimer.current);
    },
    [],
  );

  async function start(resume = false) {
    window.clearTimeout(confirmTimer.current);
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    const partial = resume ? partialRef.current : undefined;
    if (!resume) partialRef.current = undefined;
    lastTick.current = { pct: -1, loaded: partial?.loaded ?? 0 };
    setState({ phase: "downloading", loaded: partial?.loaded ?? 0, total: partial?.total ?? null });

    // Same name across pause / resume, so the saved file is not renamed halfway.
    const name =
      (resume && nameRef.current) || savedName || buildDownloadName({ ...meta, mimeType: mime, url, date: new Date() });
    nameRef.current = name;
    try {
      const saved = await downloadToDevice(source, name, {
        signal: ctrl.signal,
        resume: partial,
        onProgress: ({ loaded, total }) => {
          const pct = total ? Math.floor((loaded / total) * 100) : -1;
          const tick = lastTick.current;
          if (pct === tick.pct && (total || loaded - tick.loaded < 256 * 1024)) return;
          lastTick.current = { pct, loaded };
          setState({ phase: "downloading", loaded, total });
        },
      });
      if (ctrl.signal.aborted) return;
      partialRef.current = undefined;
      rememberDownload(key, saved.name);
      setState({ phase: "idle" });
      const message = saved.shared
        ? "download.savedShared"
        : saved.handedOff
          ? "download.handedOff"
          : SAVED_KEY[mediaKindOf(saved.mimeType)];
      toast.success(t(message).replace("{name}", saved.name));
    } catch (err) {
      if (ctrlRef.current !== ctrl) return;
      const code = err instanceof DownloadError ? err.code : "failed";
      const kept = err instanceof DownloadError ? err.partial : undefined;
      if (code === "paused") {
        partialRef.current = kept;
        setState({ phase: "paused", loaded: kept?.loaded ?? 0, total: kept?.total ?? null });
        return;
      }
      if (code === "cancelled") {
        partialRef.current = undefined;
        setState({ phase: "idle" });
        toast.info(t("download.cancelled"));
        return;
      }
      // A dropped connection keeps its bytes: Retry continues where it stopped.
      partialRef.current = resumable && code === "network" ? kept : undefined;
      setState({ phase: "error", code });
    } finally {
      if (ctrlRef.current === ctrl) ctrlRef.current = null;
    }
  }

  function cancel() {
    if (ctrlRef.current) {
      ctrlRef.current.abort();
      return;
    }
    // Cancelling a paused download: drop the kept bytes.
    partialRef.current = undefined;
    setState({ phase: "idle" });
    toast.info(t("download.cancelled"));
  }

  function pause() {
    ctrlRef.current?.abort(PAUSE);
  }

  function askAgain() {
    setState({ phase: "confirm" });
    window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => setState({ phase: "idle" }), CONFIRM_MS);
  }

  const pill =
    "inline-flex min-h-10 items-center gap-1.5 rounded-full border text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:min-h-9";

  const iconButton =
    "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--surface-3)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:h-7 sm:w-7";

  if (state.phase === "downloading" || state.phase === "paused") {
    const paused = state.phase === "paused";
    const pct = state.total ? Math.min(100, Math.round((state.loaded / state.total) * 100)) : null;
    const progress = pct == null ? (state.loaded ? formatBytes(state.loaded) : "") : `${pct}%`;
    return (
      <span
        className={cn(
          pill,
          "relative min-w-[11rem] overflow-hidden border-[var(--accent)]/40 bg-[var(--accent-muted)] ps-3 pe-1 text-[var(--fg)]",
          className,
        )}
        role="progressbar"
        aria-label={aria}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        aria-valuetext={paused ? `${t("download.paused")} ${progress}` : progress || t("download.preparing")}
      >
        {paused ? (
          <Pause className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
        ) : (
          <Download className="h-3.5 w-3.5 shrink-0 animate-pulse text-[var(--accent)]" />
        )}
        <span className="min-w-0 flex-1 truncate tabular-nums">
          {paused
            ? `${t("download.paused")} ${progress}`.trim()
            : pct == null
              ? progress || t("download.preparing")
              : `${t("download.downloading")} ${pct}%`}
        </span>
        {resumable ? (
          paused ? (
            <button
              type="button"
              onClick={() => void start(true)}
              className={iconButton}
              aria-label={t("download.resume")}
              title={t("download.resume")}
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={pause}
              className={iconButton}
              aria-label={t("download.pause")}
              title={t("download.pause")}
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          )
        ) : null}
        <button
          type="button"
          onClick={cancel}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--surface-3)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:h-7 sm:w-7"
          aria-label={t("download.cancel")}
          title={t("download.cancel")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--accent)]/15" aria-hidden>
          <span
            className={cn(
              "block h-full bg-[var(--accent)] transition-[width] duration-200",
              pct == null && "w-1/3",
              pct == null && !paused && "animate-pulse",
            )}
            style={pct == null ? undefined : { width: `${pct}%` }}
          />
        </span>
      </span>
    );
  }

  if (state.phase === "error") {
    const message = t(`download.error.${state.code}`);
    return (
      <span
        className={cn(
          pill,
          "max-w-full border-red-500/35 bg-red-500/10 ps-3 pe-1 text-[var(--fg)]",
          className,
        )}
        role="alert"
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
        <span className="min-w-0 flex-1 truncate" title={message}>
          {message}
        </span>
        <button
          type="button"
          onClick={() => void start(Boolean(partialRef.current))}
          className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 font-semibold text-[var(--fg)] shadow-sm transition hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <RotateCw className="h-3.5 w-3.5" />
          {t("download.retry")}
        </button>
        <button
          type="button"
          onClick={() => setState({ phase: "idle" })}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:h-7 sm:w-7"
          aria-label={t("download.dismiss")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  if (state.phase === "confirm") {
    return (
      <button
        type="button"
        onClick={() => void start()}
        className={cn(
          pill,
          "border-[var(--accent)]/50 bg-[var(--accent)] px-3.5 text-[var(--accent-fg)] hover:brightness-110",
          className,
        )}
      >
        <Download className="h-3.5 w-3.5" />
        {t("download.again")}
      </button>
    );
  }

  if (savedName) {
    return (
      <button
        type="button"
        onClick={askAgain}
        className={cn(
          pill,
          variant === "ghost"
            ? "min-h-8 border-0 px-2 text-emerald-700 hover:bg-emerald-500/10 sm:min-h-7 dark:text-emerald-300"
            : "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300",
          compact ? "w-10 justify-center sm:w-9" : variant === "pill" && "px-3.5",
          className,
        )}
        title={savedName}
        aria-label={`${t("download.done")}: ${savedName}`}
      >
        <Check className="h-3.5 w-3.5" />
        {compact ? null : t("download.done")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void start()}
      className={cn(
        pill,
        variant === "ghost"
          ? "min-h-8 border-0 px-2 text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)] sm:min-h-7"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] shadow-sm hover:border-[var(--accent)]/50 hover:bg-[var(--surface-2)] active:scale-[0.98]",
        compact ? "w-10 justify-center sm:w-9" : variant === "pill" && "px-3.5",
        className,
      )}
      aria-label={aria}
      title={aria}
    >
      <Download className="h-3.5 w-3.5" />
      {compact ? null : label ?? t("download.action")}
    </button>
  );
}
