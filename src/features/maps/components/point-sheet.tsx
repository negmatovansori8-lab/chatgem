"use client";

import { useRef, type Ref } from "react";
import {
  AlertTriangle,
  Building2,
  Car,
  Copy,
  Crosshair,
  Footprints,
  Globe2,
  House,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  RotateCw,
  Ruler,
  Signpost,
  Star,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { addressTitle, areaLine, isExactAddress, localityLine } from "@/lib/maps/address";
import { errorKey } from "@/lib/maps/client";
import { formatDistance, formatDuration, haversineMeters } from "@/lib/maps/geo";
import type { PointMetricsState, PointState } from "@/features/maps/use-point-lookup";
import type { LatLng, LocationErrorCode, LocationFix, MapPlace, RouteMetrics } from "@/providers/maps/types";
import { cn } from "@/lib/utils";

export type ActivePoint = Exclude<PointState, { status: "idle" }>;

/** Swipe the handle down this far to dismiss the sheet. */
const DISMISS_DRAG_PX = 70;

export function formatCoords(p: LatLng): string {
  return `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
}

/** Name shown for the point: the place's own name, else "street, house", else coordinates. */
export function pointTitle(place: MapPlace | null, point: LatLng): string {
  return place?.name || addressTitle(place?.postal) || formatCoords(point);
}

export function PointSheet({
  state,
  metrics,
  userFix,
  locating,
  locationError,
  locale,
  variant,
  t,
  onClose,
  onRetry,
  onRoute,
  onSave,
  onCopy,
  onLocate,
  sheetRef,
  className,
}: {
  state: ActivePoint;
  metrics: PointMetricsState;
  userFix: LocationFix | null;
  locating: boolean;
  locationError: LocationErrorCode | null;
  locale: string;
  /** "sheet" = mobile bottom sheet, "panel" = desktop floating card. */
  variant: "sheet" | "panel";
  t: (key: string) => string;
  onClose: () => void;
  onRetry: () => void;
  onRoute: () => void;
  onSave: () => void;
  onCopy: () => void;
  onLocate: () => void;
  sheetRef?: Ref<HTMLElement>;
  className?: string;
}) {
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const place = state.status === "done" ? state.place : null;
  const postal = place?.postal;
  const exact = isExactAddress(postal);
  const sheet = variant === "sheet";

  function onHandleDown(e: React.PointerEvent<HTMLDivElement>) {
    drag.current = { y: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onHandleMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const el = bodyRef.current?.parentElement;
    if (!d || !el) return;
    d.dy = Math.max(0, e.clientY - d.y);
    // `translate`, not `transform`: the entry animation owns `transform`.
    el.style.transition = "none";
    el.style.translate = `0 ${d.dy}px`;
  }
  function onHandleUp() {
    const d = drag.current;
    const el = bodyRef.current?.parentElement;
    drag.current = null;
    if (!d || !el) return;
    el.style.transition = "translate 200ms ease";
    el.style.translate = "";
    if (d.dy > DISMISS_DRAG_PX) onClose();
  }

  return (
    <section
      ref={sheetRef}
      role="dialog"
      aria-modal="false"
      aria-label={t("maps.point.title")}
      className={cn(
        "flex flex-col bg-[var(--surface)] text-[var(--fg)]",
        sheet
          ? "cg-point-sheet absolute inset-x-0 bottom-0 z-[850] max-h-[78%] rounded-t-[28px] border-t border-[var(--border)] shadow-[0_-16px_48px_-16px_rgba(0,0,0,0.45)]"
          : "max-h-full rounded-3xl border border-[var(--border)] shadow-[var(--shadow-lg)] [animation:njRise_220ms_ease-out]",
        className,
      )}
    >
      {sheet ? (
        <div
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          className="shrink-0 cursor-grab touch-none select-none pb-1 pt-2.5"
          aria-hidden
        >
          <span className="mx-auto block h-1.5 w-11 rounded-full bg-[var(--border-strong)]" />
        </div>
      ) : null}

      <div
        ref={bodyRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4",
          sheet ? "pb-[max(1rem,env(safe-area-inset-bottom))]" : "py-4",
        )}
      >
        <header className="flex items-start gap-3" aria-live="polite">
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#ef4444] to-[#db2777] text-white shadow-[0_6px_16px_-6px_rgba(219,39,119,0.7)]"
          >
            <MapPin className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            {state.status === "loading" ? (
              <>
                <p className="flex items-center gap-2 text-[15px] font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
                  {t("maps.point.locating")}
                </p>
                <span className="cg-skeleton mt-2 block h-3 w-3/4 rounded-full" />
              </>
            ) : (
              <>
                <h2 className="break-words text-[16.5px] font-semibold leading-snug tracking-tight">
                  {state.status === "done" ? pointTitle(place, state.point) : t("maps.point.title")}
                </h2>
                {place && localityLine(postal, { withArea: false }) ? (
                  <p className="mt-0.5 text-[12.5px] text-[var(--fg-muted)]">{localityLine(postal, { withArea: false })}</p>
                ) : null}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("maps.close")}
            className="-me-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--fg-subtle)] transition hover:bg-[var(--surface-2)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {state.status === "error" ? (
          <div role="alert" className="mt-4 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger-muted)] p-3.5">
            <p className="flex items-start gap-2 text-[13.5px] font-medium">
              {state.code === "offline" ? (
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
              )}
              {state.code === "offline" ? t("maps.point.offline") : t(errorKey(state.code))}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--pill)] px-4 text-[13px] font-semibold text-[var(--pill-fg)]"
            >
              <RotateCw className="h-3.5 w-3.5" />
              {t("maps.retry")}
            </button>
          </div>
        ) : null}

        {state.status === "done" && !exact ? (
          <p
            role="status"
            className="mt-4 flex items-start gap-2 rounded-2xl bg-[color-mix(in_oklab,#f59e0b_14%,var(--surface))] p-3 text-[13px] text-[var(--fg)]"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#d97706]" />
            {t("maps.point.notFound")}
          </p>
        ) : null}

        {state.status === "loading" ? (
          <ul className="mt-4 space-y-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="cg-skeleton h-9 w-9 shrink-0 rounded-xl" />
                <span className="flex-1 space-y-1.5">
                  <span className="cg-skeleton block h-2.5 w-16 rounded-full" />
                  <span className="cg-skeleton block h-3.5 w-2/3 rounded-full" />
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {state.status === "done" && place ? (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            <InfoRow icon={Signpost} label={t("maps.point.street")} value={postal?.road} empty={t("maps.point.noStreet")} />
            <InfoRow
              icon={House}
              label={t("maps.point.house")}
              value={postal?.houseNumber}
              empty={t("maps.point.noHouse")}
            />
            {areaLine(postal) ? <InfoRow icon={Building2} label={t("maps.point.area")} value={areaLine(postal)} /> : null}
            {localityLine(postal, { withArea: false }) ? (
              <InfoRow icon={Globe2} label={t("maps.point.city")} value={localityLine(postal, { withArea: false })} />
            ) : null}
            {place.address ? <InfoRow icon={MapPin} label={t("maps.point.address")} value={place.address} /> : null}
          </ul>
        ) : null}

        <p className="mt-2 flex items-center gap-2 text-[12px] tabular-nums text-[var(--fg-subtle)]">
          <Crosshair className="h-3.5 w-3.5 shrink-0" />
          <span className="sr-only">{t("maps.point.coords")}: </span>
          {formatCoords(state.point)}
        </p>

        <DistanceBlock
          point={state.point}
          metrics={metrics}
          userFix={userFix}
          locating={locating}
          locationError={locationError}
          locale={locale}
          t={t}
          onLocate={onLocate}
        />

        <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
          <button
            type="button"
            onClick={onRoute}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 text-[14px] font-semibold text-[var(--accent-fg)] shadow-[var(--shadow-sm)] transition active:scale-[0.98]"
          >
            <Navigation className="h-4 w-4" />
            {t("maps.point.routeHere")}
          </button>
          <IconAction icon={Star} label={t("maps.save")} onClick={onSave} disabled={state.status === "loading"} />
          <IconAction icon={Copy} label={t("maps.point.copy")} onClick={onCopy} />
        </div>
      </div>
    </section>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  empty,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  empty?: string;
}) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent)]"
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-medium text-[var(--fg-subtle)]">{label}</p>
        {value ? (
          <p className="break-words text-[14px] font-medium leading-snug">{value}</p>
        ) : (
          <p className="text-[13.5px] leading-snug text-[var(--fg-muted)]">{empty}</p>
        )}
      </div>
    </li>
  );
}

function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg)] transition hover:bg-[var(--surface-3)] active:scale-95 disabled:opacity-50"
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

function DistanceBlock({
  point,
  metrics,
  userFix,
  locating,
  locationError,
  locale,
  t,
  onLocate,
}: {
  point: LatLng;
  metrics: PointMetricsState;
  userFix: LocationFix | null;
  locating: boolean;
  locationError: LocationErrorCode | null;
  locale: string;
  t: (key: string) => string;
  onLocate: () => void;
}) {
  if (!userFix) {
    return (
      <div className="mt-4 rounded-2xl bg-[var(--surface-2)] p-3.5">
        <p className="text-[13px] text-[var(--fg-muted)]">
          {locationError === "permission_denied" ? t("maps.point.needPermission") : t("maps.point.needLocation")}
        </p>
        <button
          type="button"
          onClick={onLocate}
          disabled={locating}
          className="mt-2.5 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--pill)] px-4 text-[13px] font-semibold text-[var(--pill-fg)] disabled:opacity-60"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {t("maps.locateMe").replace(/^\p{Extended_Pictographic}\s*/u, "")}
        </button>
      </div>
    );
  }

  const straight = haversineMeters(userFix.location, point);
  const leg = (m: RouteMetrics | null) =>
    m ? { primary: formatDistance(m.distanceMeters, locale), secondary: formatDuration(m.durationSeconds, locale) } : null;
  const walk = leg(metrics.walk);
  const drive = leg(metrics.drive);

  return (
    <div className="mt-4">
      <div className="grid grid-cols-3 gap-2">
        <MetricTile icon={Ruler} label={t("maps.point.straight")} primary={formatDistance(straight, locale)} secondary={t("maps.point.straightHint")} />
        <MetricTile
          icon={Footprints}
          label={t("maps.point.walk")}
          loading={metrics.loading}
          primary={walk?.primary}
          secondary={walk?.secondary}
          empty={metrics.walkFailed ? "—" : t("maps.point.noRoute")}
        />
        <MetricTile
          icon={Car}
          label={t("maps.point.drive")}
          loading={metrics.loading}
          primary={drive?.primary}
          secondary={drive?.secondary}
          empty={metrics.driveFailed ? "—" : t("maps.point.noRoute")}
        />
      </div>
      {metrics.error || metrics.walkFailed || metrics.driveFailed ? (
        <p className="mt-2 text-[12px] text-[var(--danger)]">
          {metrics.error === "offline" ? t("maps.point.offline") : t("maps.point.metricsError")}
        </p>
      ) : null}
      {userFix.approximate ? <p className="mt-2 text-[12px] text-[var(--fg-subtle)]">{t("maps.point.approx")}</p> : null}
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  primary,
  secondary,
  loading,
  empty,
}: {
  icon: LucideIcon;
  label: string;
  primary?: string;
  secondary?: string;
  loading?: boolean;
  empty?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-[var(--surface-2)] px-2.5 py-2.5">
      <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--fg-subtle)]">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      {loading ? (
        <>
          <span className="cg-skeleton cg-skeleton--raised mt-1.5 block h-3.5 w-3/4 rounded-full" />
          <span className="cg-skeleton cg-skeleton--raised mt-1 block h-2.5 w-1/2 rounded-full" />
        </>
      ) : primary ? (
        <>
          <p className="mt-1 truncate text-[14px] font-semibold tabular-nums">{primary}</p>
          {secondary ? <p className="truncate text-[11.5px] text-[var(--fg-muted)]">{secondary}</p> : null}
        </>
      ) : (
        <p className="mt-1 text-[12.5px] text-[var(--fg-muted)]">{empty}</p>
      )}
    </div>
  );
}
