"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, id, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const inputId = id ?? "password-field";

    return (
      <div className="space-y-2">
        <div className="relative w-full">
          <input
            ref={ref}
            id={inputId}
            {...props}
            type={visible ? "text" : "password"}
            className={cn(
              "flex h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 pe-12 ps-3.5 text-sm text-[var(--fg)] shadow-sm transition placeholder:text-[var(--fg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
          />
          <button
            type="button"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-controls={inputId}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
            className="absolute end-1.5 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
          >
            {visible ? <EyeOff className="h-5 w-5" strokeWidth={2.25} /> : <Eye className="h-5 w-5" strokeWidth={2.25} />}
          </button>
        </div>
        <label className="flex cursor-pointer items-center gap-2 select-none text-xs text-[var(--fg-muted)]">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--accent)]"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
          />
          Show password / Намоиши рамз
        </label>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
