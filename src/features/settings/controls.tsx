"use client";

import Link from "next/link";
import { useId } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-5 hidden md:block">
      <h2 className="font-display text-[1.375rem] font-semibold tracking-tight text-[var(--fg)]">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-prose text-[14px] leading-relaxed text-[var(--fg-muted)]">{description}</p>
      ) : null}
    </header>
  );
}

export function SettingsCard({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      {title ? (
        <div className="mb-2 px-1">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-subtle)]">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-[13px] leading-snug text-[var(--fg-subtle)]">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {children}
      </div>
    </section>
  );
}

export function SettingsStack({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}

/** One setting: title + short description on the start side, the control on the end side. */
export function SettingRow({
  icon: Icon,
  title,
  description,
  children,
  htmlFor,
  stacked,
  disabled,
}: {
  icon?: IconType;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  htmlFor?: string;
  stacked?: boolean;
  disabled?: boolean;
}) {
  const Label = htmlFor ? "label" : "div";
  return (
    <div
      className={cn(
        "flex min-h-[3.5rem] gap-3 px-4 py-3.5 sm:px-5",
        stacked ? "flex-col" : "items-center",
        disabled && "opacity-55",
      )}
    >
      <div className={cn("flex min-w-0 flex-1 gap-3", stacked ? "items-start" : "items-center")}>
        {Icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--fg-muted)]">
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </span>
        ) : null}
        <Label htmlFor={htmlFor} className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-snug text-[var(--fg)]">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-[13px] leading-snug text-[var(--fg-subtle)]">{description}</span>
          ) : null}
        </Label>
      </div>
      {children ? <div className={cn("shrink-0", stacked && "w-full")}>{children}</div> : null}
    </div>
  );
}

export function LinkRow({
  icon,
  title,
  description,
  value,
  href,
  onClick,
}: {
  icon?: IconType;
  title: string;
  description?: string;
  value?: string;
  href?: string;
  onClick?: () => void;
}) {
  const Icon = icon;
  const body = (
    <>
      {Icon ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--fg-muted)]">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-snug text-[var(--fg)]">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-[13px] leading-snug text-[var(--fg-subtle)]">{description}</span>
        ) : null}
      </span>
      {value ? <span className="max-w-[40%] truncate text-[13px] text-[var(--fg-muted)]">{value}</span> : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--fg-subtle)] rtl:rotate-180" />
    </>
  );
  const className = cn(
    "flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-[var(--surface-2)] active:bg-[var(--surface-3)] sm:px-5",
    focusRing,
    "focus-visible:ring-inset focus-visible:ring-offset-0",
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  busy,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group relative inline-flex h-11 w-[3.25rem] shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed",
        focusRing,
      )}
    >
      <span
        className={cn(
          "relative h-7 w-12 rounded-full transition-colors duration-200",
          checked ? "bg-[var(--accent)]" : "bg-[var(--surface-3)] group-hover:bg-[color-mix(in_oklab,var(--surface-3)_80%,var(--fg)_10%)]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 grid h-6 w-6 place-items-center rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-[inset-inline-start] duration-200",
            checked ? "start-[1.375rem]" : "start-0.5",
          )}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin text-[var(--accent)]" /> : null}
        </span>
      </span>
    </button>
  );
}

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconType;
};

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (next: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-1 rounded-xl bg-[var(--surface-2)] p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold transition-colors",
              focusRing,
              "focus-visible:ring-offset-0",
              active
                ? "bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-sm)]"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)] active:bg-[var(--surface-3)]",
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} /> : null}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const fieldClass = cn(
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 text-[15px] text-[var(--fg)] transition-colors placeholder:text-[var(--fg-subtle)] hover:border-[var(--border-strong)]",
  "focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted)]",
);

export function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  multiline,
  maxLength,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[14px] font-medium text-[var(--fg)]">
          {label}
        </label>
        {maxLength && multiline ? (
          <span className="text-[12px] tabular-nums text-[var(--fg-subtle)]">
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={4}
          className={cn(fieldClass, "min-h-[7rem] resize-y py-3 leading-relaxed")}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn(fieldClass, "h-11")}
        />
      )}
      {hint ? <p className="mt-1.5 text-[12px] leading-snug text-[var(--fg-subtle)]">{hint}</p> : null}
    </div>
  );
}

export function SelectField({
  id,
  value,
  onChange,
  children,
  label,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(fieldClass, "h-11 cursor-pointer appearance-none pe-10")}
      >
        {children}
      </select>
      <ChevronRight
        aria-hidden
        className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-[var(--fg-subtle)]"
      />
    </div>
  );
}

export function ActionButton({
  children,
  onClick,
  href,
  variant = "primary",
  loading,
  disabled,
  icon: Icon,
  className,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: IconType;
  className?: string;
  type?: "button" | "submit";
}) {
  const cls = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition-[background-color,opacity,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
    focusRing,
    variant === "primary" && "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-2)]",
    variant === "secondary" &&
      "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg)] hover:bg-[var(--surface-3)]",
    variant === "danger" &&
      "border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_14%,transparent)]",
    className,
  );
  const content = (
    <>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Icon ? (
        <Icon className="h-4 w-4" strokeWidth={2} />
      ) : null}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={cls}>
      {content}
    </button>
  );
}

/** Footer for cards whose fields need an explicit Save. */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onReset,
  saveLabel,
  resetLabel,
  hint,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  saveLabel: string;
  resetLabel: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 bg-[var(--surface-2)]/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-[12px] text-[var(--fg-subtle)]">{hint}</p>
      <div className="flex gap-2">
        <ActionButton variant="secondary" onClick={onReset} disabled={!dirty || saving} className="flex-1 sm:flex-none">
          {resetLabel}
        </ActionButton>
        <ActionButton onClick={onSave} loading={saving} disabled={!dirty} className="flex-1 sm:flex-none">
          {saveLabel}
        </ActionButton>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-[var(--surface-2)]", className)} />;
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold",
        tone === "neutral" && "bg-[var(--surface-2)] text-[var(--fg-muted)]",
        tone === "success" && "bg-[var(--accent-muted)] text-[var(--accent-2)]",
        tone === "warn" && "bg-amber-500/15 text-amber-500",
      )}
    >
      {children}
    </span>
  );
}
