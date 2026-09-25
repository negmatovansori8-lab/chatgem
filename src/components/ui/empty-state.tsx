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
        "mx-auto flex w-full max-w-md flex-col items-center px-4 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-[var(--radius-lg)] bg-[var(--surface-3)] text-[var(--fg-muted)]">
          {icon}
        </div>
      ) : null}
      <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--fg)]">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
          {description}
        </p>
      ) : null}
      {actions ? <div className="mt-6 flex w-full flex-col gap-2">{actions}</div> : null}
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
        wide ? "max-w-6xl" : "max-w-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}
