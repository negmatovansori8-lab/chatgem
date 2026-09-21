"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function AuthShell({
  children,
  eyebrow,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  eyebrow?: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="relative flex min-h-dvh overflow-hidden bg-[var(--bg)]">
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 10% -10%, color-mix(in oklab, var(--accent) 28%, transparent), transparent 55%),
            radial-gradient(ellipse 70% 50% at 100% 0%, color-mix(in oklab, var(--accent-2) 22%, transparent), transparent 50%),
            radial-gradient(ellipse 50% 40% at 50% 110%, color-mix(in oklab, var(--accent) 12%, transparent), transparent 60%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage: `linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
      />

      {/* Brand panel — desktop */}
      <aside className="relative hidden w-[44%] flex-col justify-between border-e border-[var(--border)] p-10 lg:flex xl:w-[46%]">
        <div className="flex items-center justify-between gap-3">
          <Logo href="/" />
          <div className="flex items-center gap-1">
            <LanguageSwitcher compact />
            <ThemeToggle />
          </div>
        </div>

        <div className="max-w-md animate-auth-rise">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            {eyebrow ?? "ChatGem"}
          </p>
          <h1 className="font-display mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-[var(--fg)] xl:text-5xl">
            One workspace.
            <br />
            <span className="bg-[linear-gradient(120deg,var(--accent),var(--accent-2))] bg-clip-text text-transparent">
              Many minds.
            </span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-[var(--fg-muted)]">
            Chat, agents, knowledge, and tools — built as a real product, not a copy.
          </p>
        </div>

        <p className="text-xs text-[var(--fg-subtle)]">
          © {new Date().getFullYear()} ChatGem ·{" "}
          <Link href="/" className="underline-offset-2 hover:underline">
            Home
          </Link>
        </p>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-6 flex w-full max-w-md items-center justify-between lg:hidden">
          <Logo href="/" />
          <div className="flex items-center gap-1">
            <LanguageSwitcher compact />
            <ThemeToggle />
          </div>
        </div>

        <div className="w-full max-w-md animate-auth-rise">
          <div className="mb-6 lg:mb-8">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--fg)] sm:text-3xl">
              {title}
            </h2>
            <p className="mt-1.5 text-sm text-[var(--fg-muted)]">{subtitle}</p>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] p-5 shadow-[0_30px_80px_-48px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-7">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
