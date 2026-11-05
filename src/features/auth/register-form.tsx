"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/locale-provider";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { OAuthButtons } from "@/features/auth/oauth-buttons";

export function RegisterForm() {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { t } = useI18n();
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        name: form.get("name"),
        mode: "register",
      }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setNotice(data.error?.message ?? t("auth.error.register"));
      return;
    }
    router.push("/app/chat");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[var(--bg)] text-[var(--fg)]">
      <div className="absolute end-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex items-center gap-1 sm:end-4">
        <LanguageSwitcher compact />
        <ThemeToggle />
      </div>
      <div className="flex shrink-0 flex-col items-center px-4 pb-4 pt-16 sm:px-6 sm:pt-20">
        <Link href="/" className="brand-hover block rounded-[22.5%]" aria-label="ChatGem">
          <BrandMark size="lg" tile="dark" animate="intro" />
        </Link>
        <h1 className="font-display mt-4 text-2xl font-bold">{t("auth.register.title")}</h1>
        <p className="mt-1 max-w-sm px-2 text-center text-sm text-[var(--fg-muted)]">
          {t("auth.register.subtitle")}
        </p>
      </div>
      <div className="mx-auto w-full max-w-md flex-1 space-y-4 overflow-y-auto px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] animate-auth-rise sm:px-5">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5">
          <OAuthButtons mode="register" />
          <div className="my-4 h-px bg-[var(--border)]" />
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">{t("auth.name")}</Label>
              <Input
                id="name"
                name="name"
                required
                autoComplete="name"
                className="rounded-full border-[var(--border)] bg-[var(--surface-2)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="rounded-full border-[var(--border)] bg-[var(--surface-2)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <PasswordInput
                id="password"
                name="password"
                minLength={8}
                required
                autoComplete="new-password"
                className="rounded-full border-[var(--border)] bg-[var(--surface-2)]"
              />
            </div>
            {notice ? <p className="text-xs text-[var(--danger)]" role="alert">{notice}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-[var(--pill)] py-3 text-sm font-semibold text-[var(--pill-fg)] disabled:opacity-60"
            >
              {pending ? t("common.loading") : t("auth.register.cta")}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-[var(--fg-muted)]">
          {t("auth.hasAccount")}{" "}
          <Link href="/login" className="text-[var(--fg)] underline underline-offset-2">
            {t("auth.login.cta")}
          </Link>
        </p>
      </div>
    </div>
  );
}
