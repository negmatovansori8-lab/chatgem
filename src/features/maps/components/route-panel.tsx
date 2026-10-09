"use client";

import { useEffect, useRef, useState } from "react";
import {
  Accessibility,
  Bike,
  Bus,
  Car,
  Clock3,
  Footprints,
  Globe,
  LocateFixed,
  Navigation,
  Phone,
  Route,
  Share2,
  Star,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { CATEGORY_EMOJI, type MapCategoryKey } from "@/lib/maps/intent";
import { TRANSIT_EMOJI, areaTypeLabel, categoryLabel, isCategoryKey } from "@/lib/maps/labels";
import { estimateSteps, formatClock, formatDistance, formatDuration } from "@/lib/maps/geo";
import type { SavedKind, SavedPlace } from "@/lib/maps/storage";
import {
  TRAVEL_MODES,
  type LatLng,
  type MapPlace,
  type RouteLeg,
  type TrafficLevel,
  type TravelMode,
} from "@/providers/maps/types";
import { cn } from "@/lib/utils";
import type { PlaceMetrics } from "@/features/maps/components/place-card";

export type RouteState = RouteLeg | "loading" | { error: string };

const MODE_ICON: Record<TravelMode, typeof Footprints> = {
  walking: Footprints,
  cycling: Bike,
  driving: Car,
  transit: Bus,
};

export const MODE_EMOJI: Record<TravelMode, string> = { walking: "🚶", cycling: "🚲", driving: "🚗", transit: "🚌" };

const TRAFFIC_DOT: Record<TrafficLevel, string> = { normal: "🟢", moderate: "🟡", heavy: "🔴" };

export function isLeg(v: RouteState | undefined): v is RouteLeg {
  return Boolean(v && typeof v === "object" && "mode" in v);
}

export type RouteView = { distanceMeters: number; durationSeconds: number; geometry: LatLng[] };

/** The route currently chosen (1 = provider's main route, traffic-aware when known). */
export function routeView(leg: RouteLeg, altIndex: number): RouteView {
  const alt = altIndex > 0 ? leg.alternatives?.[altIndex - 1] : undefined;
  if (alt) return alt;
  return {
    distanceMeters: leg.distanceMeters,
    durationSeconds: leg.traffic?.durationInTrafficSeconds ?? leg.durationSeconds,
    geometry: leg.geometry,
  };
}

function prettyCategory(place: MapPlace, locale: string): string | null {
  if (isCategoryKey(place.category)) return categoryLabel(place.category, locale);
  const area = areaTypeLabel(place.category, locale);
  if (area) return area;
  const raw = place.category?.replace(/_/g, " ").trim();
  if (!raw || raw === "yes" || raw === "link") return null;
  return raw[0]!.toUpperCase() + raw.slice(1);
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function RoutePanel({
  place,
  mode,
  routes,
  metrics,
  altIndex,
  hasLocation,
  locating,
  now,
  locale,
  saved,
  t,
  errorText,
  onMode,
  onAlt,
  onLocate,
  onClose,
  onSave,
  onUnsave,
  onShare,
  className,
}: {
  place: MapPlace;
  mode: TravelMode;
  routes: Partial<Record<TravelMode, RouteState>>;
  /** Real walk/drive totals from the distance matrix, shown on tabs before a route is fetched. */
  metrics?: PlaceMetrics;
  altIndex: number;
  hasLocation: boolean;
  locating: boolean;
  now: Date;
  locale: string;
  saved?: SavedPlace;
  t: (key: string) => string;
  errorText: (code: string) => string;
  onMode: (mode: TravelMode) => void;
  onAlt: (index: number) => void;
  onLocate: () => void;
  onClose: () => void;
  onSave: (kind: SavedKind) => void;
  onUnsave: () => void;
  onShare: () => void;
  className?: string;
}) {
  const emoji = CATEGORY_EMOJI[place.category as MapCategoryKey] ?? "📍";
  const state = routes[mode];
  const currentKnown = mode === "walking" ? metrics?.walk : mode === "driving" ? metrics?.drive : null;
  const pretty = prettyCategory(place, locale);
  const categoryText = pretty && pretty.toLowerCase() !== place.name.toLowerCase() ? pretty : null;
  const d = place.details;

  return (
    <section
      aria-live="polite"
      className={cn(
        "rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)] [animation:njRise_220ms_ease-out]",
        className,
      )}
    >
      <header className="flex items-start gap-3">
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-muted)] text-[22px]">
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold leading-snug tracking-tight text-[var(--fg)]">{place.name}</h2>
          {categoryText ? <p className="mt-0.5 text-[12px] font-medium text-[var(--accent)]">{categoryText}</p> : null}
          {place.address ? (
            <p className="mt-0.5 line-clamp-2 text-[12.5px] text-[var(--fg-muted)]">📍 {place.address}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("maps.close")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--fg-subtle)] hover:bg-[var(--surface-2)]"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {d ? (
        <ul className="mt-3 space-y-1.5 text-[12.5px] text-[var(--fg-muted)]">
          {d.openingHours ? (
            <li className="flex items-start gap-2">
              <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-words">{d.openingHours === "24/7" ? t("maps.open247") : d.openingHours}</span>
            </li>
          ) : null}
          {d.phone ? (
            <li className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <a href={`tel:${d.phone.replace(/[^\d+]/g, "")}`} className="font-medium text-[var(--fg)] hover:underline">
                {d.phone}
              </a>
            </li>
          ) : null}
          {d.website ? (
            <li className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <a
                href={d.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="truncate font-medium text-[var(--accent)] hover:underline"
              >
                {hostOf(d.website)}
              </a>
            </li>
          ) : null}
          {d.cuisine ? (
            <li className="flex items-center gap-2">
              <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" />
              <span className="capitalize">{d.cuisine}</span>
            </li>
          ) : null}
          {d.wheelchair ? (
            <li className="flex items-center gap-2">
              <Accessibility className="h-3.5 w-3.5 shrink-0" />
              <span>{t(`maps.wheelchair.${d.wheelchair}`)}</span>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <ActionBtn onClick={() => onMode(mode)} primary disabled={!hasLocation}>
          <Navigation className="h-3.5 w-3.5" />
          {t("maps.route")}
        </ActionBtn>
        <SaveMenu saved={saved} t={t} onSave={onSave} onUnsave={onUnsave} />
        <ActionBtn onClick={onShare}>
          <Share2 className="h-3.5 w-3.5" />
          {t("maps.share")}
        </ActionBtn>
      </div>

      {!hasLocation ? (
        <div className="mt-4 rounded-2xl bg-[var(--surface-2)] p-3 text-[13px] text-[var(--fg-muted)]">
          <p>{t("maps.needLocationForMetrics")}</p>
          <button
            type="button"
            onClick={onLocate}
            disabled={locating}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--pill)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--pill-fg)] disabled:opacity-60"
          >
            <LocateFixed className={cn("h-3.5 w-3.5", locating && "animate-pulse")} />
            {t("maps.locateMe")}
          </button>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label={t("maps.route")} className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-[var(--surface-2)] p-1">
            {TRAVEL_MODES.map((m) => {
              const Icon = MODE_ICON[m];
              const r = routes[m];
              const known = m === "walking" ? metrics?.walk : m === "driving" ? metrics?.drive : null;
              const seconds = isLeg(r)
                ? r.available
                  ? (r.traffic?.durationInTrafficSeconds ?? r.durationSeconds)
                  : null
                : known?.durationSeconds;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => onMode(m)}
                  className={cn(
                    "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11.5px] font-semibold transition-all",
                    mode === m
                      ? "bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-sm)]"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    <Icon className="h-4 w-4" />
                    <span className="hidden min-[380px]:inline">{t(`maps.mode.${m}`)}</span>
                  </span>
                  <span className="text-[10.5px] font-medium tabular-nums text-[var(--fg-subtle)]">
                    {seconds != null ? formatDuration(seconds, locale) : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 min-h-[92px]">
            {state === undefined ? (
              <>
                {currentKnown ? (
                  <Stats
                    t={t}
                    mode={mode}
                    locale={locale}
                    now={now}
                    distanceMeters={currentKnown.distanceMeters}
                    durationSeconds={currentKnown.durationSeconds}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => onMode(mode)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--pill)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--pill-fg)]"
                >
                  <Route className="h-3.5 w-3.5" />
                  {t("maps.showRoute")}
                </button>
              </>
            ) : state === "loading" ? (
              <div className="grid grid-cols-3 gap-2" aria-label={t("maps.calculating")}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-16 rounded-2xl cg-skeleton" />
                ))}
              </div>
            ) : isLeg(state) && state.available ? (
              <LegBody leg={state} mode={mode} altIndex={altIndex} now={now} locale={locale} t={t} onAlt={onAlt} />
            ) : (
              <p className="rounded-2xl bg-[var(--surface-2)] p-3 text-[13px] text-[var(--fg-muted)]">
                {mode === "transit" &&
                (isLeg(state) || (typeof state === "object" && state.error === "transit_unavailable"))
                  ? t("maps.transitUnavailable")
                  : isLeg(state)
                    ? t("maps.err.route")
                    : errorText(state.error)}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function LegBody({
  leg,
  mode,
  altIndex,
  now,
  locale,
  t,
  onAlt,
}: {
  leg: RouteLeg;
  mode: TravelMode;
  altIndex: number;
  now: Date;
  locale: string;
  t: (key: string) => string;
  onAlt: (index: number) => void;
}) {
  const view = routeView(leg, altIndex);
  const options = [
    { distanceMeters: leg.distanceMeters, durationSeconds: leg.traffic?.durationInTrafficSeconds ?? leg.durationSeconds },
    ...(leg.alternatives ?? []),
  ];
  const fastest = options.reduce((best, o, i) => (o.durationSeconds < options[best]!.durationSeconds ? i : best), 0);
  const shortest = options.reduce((best, o, i) => (o.distanceMeters < options[best]!.distanceMeters ? i : best), 0);

  return (
    <>
      <Stats
        t={t}
        mode={mode}
        locale={locale}
        now={now}
        distanceMeters={view.distanceMeters}
        durationSeconds={view.durationSeconds}
      />
      <p className="mt-3 text-[13.5px] font-medium text-[var(--fg)]">
        {t("maps.arriveSentence").replace("{time}", formatClock(view.durationSeconds, now))}
      </p>
      {mode === "walking" ? (
        <p className="mt-0.5 text-[12px] text-[var(--fg-subtle)]">
          👣 {t("maps.stepsApprox").replace("{n}", estimateSteps(view.distanceMeters).toLocaleString("ru-RU"))}
        </p>
      ) : null}

      {mode === "driving" && leg.traffic && altIndex === 0 ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[12px] font-medium text-[var(--fg)]">
          {TRAFFIC_DOT[leg.traffic.level]} {t(`maps.traffic.${leg.traffic.level}`)} ·{" "}
          {t("maps.traffic.withTraffic")} {formatDuration(leg.traffic.durationInTrafficSeconds, locale)}
        </p>
      ) : null}

      {mode === "transit" && leg.transitSteps?.length ? (
        <ol className="mt-3 space-y-1.5">
          {leg.transitSteps.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[12.5px]">
              <span className="text-[16px] leading-none">{s.kind === "walk" ? "🚶" : (TRANSIT_EMOJI[s.vehicle] ?? "🚌")}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[var(--fg)]">
                  {s.kind === "walk" ? t("maps.mode.walking") : `${t(`maps.vehicle.${s.vehicle}`)} ${s.name}`}
                  <span className="font-medium text-[var(--fg-muted)]"> · {formatDuration(s.durationSeconds, locale)}</span>
                </span>
                {s.kind === "ride" ? (
                  <span className="block truncate text-[11.5px] text-[var(--fg-muted)]">
                    {[
                      s.stops != null ? t("maps.stops").replace("{n}", String(s.stops)) : "",
                      s.from && s.to ? `${s.from} → ${s.to}` : s.headsign ?? "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : (
                  <span className="block text-[11.5px] text-[var(--fg-muted)]">{formatDistance(s.distanceMeters, locale)}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      ) : mode === "transit" && leg.transitLines?.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {leg.transitLines.map((line, i) => (
            <li key={`${line.name}-${i}`} className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[12px] font-medium text-[var(--fg)]">
              {TRANSIT_EMOJI[line.vehicle]} {line.name} · {formatDuration(line.durationSeconds, locale)}
            </li>
          ))}
        </ul>
      ) : null}

      {options.length > 1 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">{t("maps.routes")}</p>
          <ul className="space-y-1.5">
            {options.map((o, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onAlt(i)}
                  aria-pressed={i === altIndex}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[12.5px] transition-colors",
                    i === altIndex
                      ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                      : "border-[var(--border)] hover:bg-[var(--surface-2)]",
                  )}
                >
                  <span className="font-semibold text-[var(--fg)]">
                    {t("maps.routeN").replace("{n}", String(i + 1))}
                    <span className="ms-1.5 font-medium text-[var(--accent)]">
                      {i === fastest ? t("maps.fastest") : i === shortest ? t("maps.shortest") : t("maps.alternative")}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--fg-muted)]">
                    {formatDistance(o.distanceMeters, locale)} · {formatDuration(o.durationSeconds, locale)} · 🕐{" "}
                    {formatClock(o.durationSeconds, now)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function Stats({
  t,
  mode,
  locale,
  now,
  distanceMeters,
  durationSeconds,
}: {
  t: (key: string) => string;
  mode: TravelMode;
  locale: string;
  now: Date;
  distanceMeters: number;
  durationSeconds: number;
}) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      <Stat label={`📏 ${t("maps.distance")}`} value={formatDistance(distanceMeters, locale)} />
      <Stat label={`${MODE_EMOJI[mode]} ${t(`maps.mode.${mode}`)}`} value={formatDuration(durationSeconds, locale)} strong />
      <Stat label={`🕐 ${t("maps.arrival")}`} value={formatClock(durationSeconds, now)} />
    </dl>
  );
}

function ActionBtn({
  children,
  onClick,
  primary,
  disabled,
  pressed,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-colors disabled:opacity-50",
        primary
          ? "bg-[var(--pill)] text-[var(--pill-fg)]"
          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-2)]",
      )}
    >
      {children}
    </button>
  );
}

function SaveMenu({
  saved,
  t,
  onSave,
  onUnsave,
}: {
  saved?: SavedPlace;
  t: (key: string) => string;
  onSave: (kind: SavedKind) => void;
  onUnsave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const choose = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <ActionBtn onClick={() => setOpen((o) => !o)} pressed={Boolean(saved)}>
        <Star className={cn("h-3.5 w-3.5", saved && "fill-amber-400 text-amber-400")} />
        {saved ? t(`maps.saved.${saved.kind}`) : t("maps.save")}
      </ActionBtn>
      {open ? (
        <div className="absolute start-0 top-[calc(100%+6px)] z-30 w-48 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-lg)]">
          {(["favorite", "home", "work"] as SavedKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => choose(() => onSave(kind))}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-start text-[13px] hover:bg-[var(--surface-2)]",
                saved?.kind === kind && "font-semibold text-[var(--accent)]",
              )}
            >
              {kind === "home" ? "🏠" : kind === "work" ? "💼" : "⭐"} {t(`maps.saveAs.${kind}`)}
            </button>
          ))}
          {saved ? (
            <button
              type="button"
              onClick={() => choose(onUnsave)}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-start text-[13px] text-[var(--danger)] hover:bg-[var(--surface-2)]"
            >
              ✕ {t("maps.unsave")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-[var(--surface-2)] px-2.5 py-2">
      <dt className="truncate text-[11px] text-[var(--fg-subtle)]">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-[14px] font-semibold tabular-nums leading-tight text-[var(--fg)]",
          strong && "text-[var(--accent)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
