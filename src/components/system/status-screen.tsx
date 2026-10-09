"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Full-screen message for 404 / crash / offline states, safe-area aware. */
export function StatusScreen({
  code,
  title,
  body,
  primary,
  secondary,
}: {
  code?: string;
  title: string;
  body: string;
  primary?: { label: string; onClick?: () => void; href?: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center bg-[var(--bg)] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-center text-[var(--fg)]">
      <BrandMark size="lg" tile animate="intro" className="mb-6" />
      {code ? (
        <p className="mb-2 font-mono text-[13px] font-semibold tracking-[0.2em] text-[var(--accent)]">{code}</p>
      ) : null}
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[var(--fg-muted)]">{body}</p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-2.5 sm:max-w-none sm:flex-row sm:justify-center">
        {primary ? (
          primary.href ? (
            <Link href={primary.href} className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
              {primary.label}
            </Link>
          ) : (
            <button type="button" onClick={primary.onClick} className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
              {primary.label}
            </button>
          )
        ) : null}
        {secondary ? (
          <Link
            href={secondary.href}
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full sm:w-auto")}
          >
            {secondary.label}
          </Link>
        ) : null}
      </div>
    </main>
  );
}
