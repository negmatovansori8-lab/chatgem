"use client";

import { memo } from "react";
import { CATEGORY_EMOJI, type MapCategoryKey } from "@/lib/maps/intent";
import { formatClock, formatDistance, formatDuration } from "@/lib/maps/geo";
import type { MapPlace, RouteMetrics } from "@/providers/maps/types";
import { cn } from "@/lib/utils";

export type PlaceMetrics = {
  walk?: RouteMetrics | null;
  drive?: RouteMetrics | null;
};

function PlaceCardImpl({
  place,
  closest,
  metrics,
  metricsLoading,
  hasLocation,
  selected,
  now,
  locale,
  t,
  onSelect,
}: {
  place: MapPlace;
  closest: boolean;
  metrics?: PlaceMetrics;
  metricsLoading: boolean;
  hasLocation: boolean;
  selected: boolean;
  now: Date;
  locale: string;
  t: (key: string) => string;
  onSelect: (place: MapPlace) => void;
}) {
  const emoji = CATEGORY_EMOJI[place.category as MapCategoryKey] ?? "📍";
  const walk = metrics?.walk;
  const drive = metrics?.drive;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(place)}
        aria-current={selected || undefined}
        className={cn(
          "group flex w-full gap-3 rounded-2xl border p-3 text-left transition-all duration-200",
          selected
            ? "border-[var(--accent)] bg-[var(--accent-muted)] shadow-[var(--shadow-md)]"
            : "border-[var(--border)] bg-[var(--surface)] hover:-translate-y-px hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]",
        )}
      >
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[20px]"
        >
          {emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-[var(--fg)]">
              {place.name}
            </span>
            {closest && walk ? (
              <span className="shrink-0 rounded-full bg-[var(--success-muted)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--success)]">
                {t("maps.closest")}
              </span>
            ) : null}
          </span>
          {place.address ? (
            <span className="mt-0.5 line-clamp-1 block text-[12px] text-[var(--fg-muted)]">
              {place.address}
            </span>
          ) : null}

          {walk ? (
            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] tabular-nums">
              <span className="font-semibold text-[var(--fg)]">📏 {formatDistance(walk.distanceMeters, locale)}</span>
              <span className="text-[var(--fg-muted)]">🚶 {formatDuration(walk.durationSeconds, locale)}</span>
              <span className="text-[var(--fg-muted)]">🕐 {formatClock(walk.durationSeconds, now)}</span>
              {drive ? (
                <span className="text-[var(--fg-muted)]">🚗 {formatDuration(drive.durationSeconds, locale)}</span>
              ) : null}
            </span>
          ) : drive ? (
            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] tabular-nums">
              <span className="font-semibold text-[var(--fg)]">📏 {formatDistance(drive.distanceMeters, locale)}</span>
              <span className="text-[var(--fg-muted)]">🚗 {formatDuration(drive.durationSeconds, locale)}</span>
              <span className="text-[var(--fg-muted)]">🕐 {formatClock(drive.durationSeconds, now)}</span>
            </span>
          ) : metricsLoading ? (
            <span className="mt-2 block h-3.5 w-44 rounded-full cg-skeleton" aria-label={t("maps.calculating")} />
          ) : hasLocation ? (
            <span className="mt-2 block text-[12px] text-[var(--fg-subtle)]">{t("maps.dataUnavailable")}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

export const PlaceCard = memo(PlaceCardImpl);

export function PlaceCardSkeleton() {
  return (
    <li className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <span className="h-10 w-10 shrink-0 rounded-xl cg-skeleton" />
      <span className="flex-1 space-y-2 pt-0.5">
        <span className="block h-3.5 w-3/5 rounded-full cg-skeleton" />
        <span className="block h-3 w-4/5 rounded-full cg-skeleton" />
        <span className="block h-3 w-2/5 rounded-full cg-skeleton" />
      </span>
    </li>
  );
}
