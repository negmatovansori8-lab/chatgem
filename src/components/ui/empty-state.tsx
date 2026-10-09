"use client";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center px-4 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] shadow-[var(--shadow-sm)]">
          {icon}
        </div>
      ) : null}
      <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--fg)]">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-[var(--fg-muted)]">
          {description}
        </p>
      ) : null}
      {actions ? (
        <div className="mt-7 flex w-full max-w-xs flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceShell({
  children,
  className,
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex h-full min-h-0 w-full flex-col bg-[var(--bg)] text-[var(--fg)]",
        wide ? "max-w-6xl" : "max-w-lg md:max-w-xl lg:max-w-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
