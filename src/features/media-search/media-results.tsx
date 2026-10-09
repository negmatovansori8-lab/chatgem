"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Film, Info, Music2, Pause, Play, Search, User } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { DownloadButton } from "@/components/media/download-button";
import { cn } from "@/lib/utils";
import type { MediaItem, MediaLink, MediaSearchResult } from "@/lib/media/types";

type T = (key: string) => string;

function fill(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

function trackTime(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
}

function filmTime(sec: number, t: T) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? fill(t("media.hm"), { h, m }) : fill(t("media.m"), { m });
}

const actionBtn =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.98] sm:min-h-9";

function Cover({ item, className }: { item: MediaItem; className: string }) {
  const { t } = useI18n();
  const [broken, setBroken] = useState(false);
  const Icon = item.kind === "movie" ? Film : Music2;
  if (!item.cover || broken) {
    return (
      <span
        className={cn("grid shrink-0 place-items-center bg-[var(--surface-3)] text-[var(--fg-subtle)]", className)}
        role="img"
        aria-label={t("media.noCover")}
      >
        <Icon className="h-6 w-6" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.cover}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={cn("shrink-0 bg-[var(--surface-3)] object-cover", className)}
    />
  );
}

function SourceLine({ item, t }: { item: MediaItem; t: T }) {
  const license = item.download?.license ?? item.source.license;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[var(--fg-subtle)]">
      <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 font-medium text-[var(--fg-muted)]">
        {item.source.name}
      </span>
      {license ? <span title={fill(t("media.license"), { license })}>{license}</span> : null}
    </p>
  );
}

function linkText(link: MediaLink, t: T) {
  const key = link.role === "watch" ? "media.linkWatch" : link.role === "listen" ? "media.linkListen" : "media.linkInfo";
  return fill(t(key), { name: link.label });
}

function Links({ links, t }: { links?: MediaLink[]; t: T }) {
  if (!links?.length) return null;
  return (
    <>
      {links.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            actionBtn,
            "border border-[var(--border)] bg-[var(--surface)] px-3 font-medium text-[var(--fg-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--fg)]",
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="max-w-[12rem] truncate">{linkText(link, t)}</span>
        </a>
      ))}
    </>
  );
}

function DownloadOrNote({ item, t }: { item: MediaItem; t: T }) {
  if (item.download) {
    return (
      <DownloadButton
        source={{ url: item.download.url }}
        meta={{
          title: item.title,
          artist: item.kind === "music" ? item.artist : undefined,
          mimeType: item.download.mimeType,
        }}
      />
    );
  }
  return (
    <span className="inline-flex min-h-10 items-center gap-1.5 text-xs text-[var(--fg-subtle)] sm:min-h-9">
      <Info className="h-3.5 w-3.5 shrink-0" />
      {t("media.noDownload")}
    </span>
  );
}

function PlayPause({
  item,
  playing,
  onToggle,
}: {
  item: MediaItem;
  playing: boolean;
  onToggle: (item: MediaItem) => void;
}) {
  const { t } = useI18n();
  if (!item.play || item.play.kind !== "audio") return null;
  return (
    <button
      type="button"
      className={cn(actionBtn, "bg-[var(--fg)] px-3 text-[var(--bg)]")}
      aria-label={playing ? t("media.pause") : t("media.play")}
      onClick={() => onToggle(item)}
    >
      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
      {playing ? t("media.pause") : t("media.play")}
      {item.play.preview ? <span className="font-medium opacity-70">{t("media.preview")}</span> : null}
    </button>
  );
}

function MusicCard({
  item,
  playing,
  onToggle,
}: {
  item: MediaItem;
  playing: boolean;
  onToggle: (item: MediaItem) => void;
}) {
  const { t } = useI18n();
  const meta = [item.album, item.year, item.durationSec ? trackTime(item.durationSec) : null].filter(Boolean).join(" · ");
  return (
    <li className="nj-rise flex gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-sm transition hover:border-[var(--accent)]/40 sm:p-3">
      <Cover item={item} className="h-[4.5rem] w-[4.5rem] rounded-xl sm:h-20 sm:w-20" />
      <div className="min-w-0 flex-1">
        <p className="flex items-start gap-1.5 text-[15px] font-semibold leading-snug text-[var(--fg)]">
          <span className="line-clamp-2 break-words">{item.title}</span>
          {item.explicit ? (
            <span
              className="mt-0.5 shrink-0 rounded bg-[var(--surface-3)] px-1 text-[10px] font-bold leading-4 text-[var(--fg-muted)]"
              title={t("media.explicit")}
            >
              E
            </span>
          ) : null}
        </p>
        {item.artist ? (
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-[var(--fg-muted)]">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.artist}</span>
          </p>
        ) : null}
        {meta ? <p className="mt-0.5 truncate text-xs text-[var(--fg-subtle)]">{meta}</p> : null}
        <div className="mt-1.5">
          <SourceLine item={item} t={t} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <PlayPause item={item} playing={playing} onToggle={onToggle} />
          <DownloadOrNote item={item} t={t} />
        </div>
      </div>
    </li>
  );
}

function MovieCard({ item }: { item: MediaItem }) {
  const { t } = useI18n();
  const meta = [item.year, item.durationSec ? filmTime(item.durationSec, t) : null].filter(Boolean).join(" · ");
  const info = item.links?.filter((l) => l.role === "info") ?? [];

  return (
    <li className="nj-rise overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm transition hover:border-[var(--accent)]/40 md:col-span-2">
      <div className="flex gap-3 p-2.5 sm:gap-4 sm:p-3">
        <Cover item={item} className="aspect-[2/3] w-20 rounded-xl sm:w-24" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-[15px] font-semibold leading-snug text-[var(--fg)] sm:text-base">
            {item.title}
          </p>
          {meta ? <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">{meta}</p> : null}
          {item.description ? (
            <p className="mt-1 line-clamp-3 text-[13px] leading-5 text-[var(--fg-muted)]">{item.description}</p>
          ) : null}
          <div className="mt-1.5">
            <SourceLine item={item} t={t} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <DownloadOrNote item={item} t={t} />
            <Links links={info} t={t} />
          </div>
        </div>
      </div>
    </li>
  );
}

export function MediaResults({
  result,
  onPrompt,
}: {
  result: MediaSearchResult;
  /** Sends a suggestion back to the chat as a new search. */
  onPrompt?: (text: string) => void;
}) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playError, setPlayError] = useState(false);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  function playbackUrl(url: string) {
    try {
      const host = new URL(url).hostname;
      if (host === "audio-ssl.itunes.apple.com" || host === "audio.itunes.apple.com") {
        return `/api/media/preview?url=${encodeURIComponent(url)}`;
      }
    } catch {
      return url;
    }
    return url;
  }

  function toggle(item: MediaItem) {
    const url = item.play?.url;
    if (!url) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    if (playingId === item.id && !audio.paused) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    setPlayError(false);
    audio.pause();
    audio.src = playbackUrl(url);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setPlayingId(null);
      setPlayError(true);
    };
    void audio
      .play()
      .then(() => setPlayingId(item.id))
      .catch(() => {
        setPlayingId(null);
        setPlayError(true);
      });
  }

  return (
    <section className="my-1 space-y-3" aria-label={t("media.results")}>
      {playError ? <p className="text-[13px] text-[var(--fg-muted)]">{t("media.playFailed")}</p> : null}
      {result.items.length ? (
        <ul className="grid gap-2.5 md:grid-cols-2">
          {result.items.map((item) =>
            item.kind === "movie" ? (
              <MovieCard key={item.id} item={item} />
            ) : (
              <MusicCard key={item.id} item={item} playing={playingId === item.id} onToggle={toggle} />
            ),
          )}
        </ul>
      ) : null}
      {result.suggestions.length ? (
        <div className="space-y-1.5">
          {result.items.length ? <p className="text-xs text-[var(--fg-subtle)]">{t("media.suggestions")}</p> : null}
          <div className="flex flex-wrap gap-1.5">
            {result.suggestions.map((s) =>
              onPrompt ? (
                <button
                  key={s}
                  type="button"
                  onClick={() => onPrompt(fill(t("media.findPrompt"), { q: s }))}
                  className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs text-[var(--fg)] transition hover:border-[var(--accent)]/50 hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:min-h-9"
                >
                  <Search className="h-3.5 w-3.5 shrink-0 text-[var(--fg-subtle)]" />
                  <span className="truncate">{s}</span>
                </button>
              ) : (
                <span key={s} className="rounded-full bg-[var(--surface-3)] px-3 py-1.5 text-xs text-[var(--fg-muted)]">
                  {s}
                </span>
              ),
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Shown in the assistant bubble while the server searches the providers. */
export function MediaSearchProgress() {
  const { t } = useI18n();
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
        <span className="relative grid h-7 w-7 place-items-center rounded-full bg-[var(--accent-muted)] text-[var(--accent)]">
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)]/20" aria-hidden />
          <Search className="relative h-3.5 w-3.5" />
        </span>
        {t("media.searching")}
      </p>
      <div className="grid gap-2.5 md:grid-cols-2" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <span className="cg-skeleton h-20 w-20 shrink-0 rounded-xl" />
            <span className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
              <span className="cg-skeleton h-3.5 w-3/4 rounded-full" />
              <span className="cg-skeleton h-3 w-1/2 rounded-full" />
              <span className="cg-skeleton mt-2 h-8 w-28 rounded-full" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
