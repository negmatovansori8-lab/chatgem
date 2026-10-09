"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/locale-provider";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-mark";
import { OAuthButtons } from "@/features/auth/oauth-buttons";

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const { t } = useI18n();
  const router = useRouter();
  const search = useSearchParams();
  const notice = formNotice ?? search.get("oauth_error");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormNotice(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        mode: "login",
      }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setFormNotice(data.error?.message ?? t("auth.error.login"));
      return;
    }
    router.push("/app/chat");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#050505] text-white">
      <div className="absolute end-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 sm:end-4">
        <LanguageSwitcher compact />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10 sm:px-5">
        <div className="flex w-full max-w-md flex-col items-center animate-auth-rise">
          <Link href="/" className="brand-hover block rounded-[22.5%]" aria-label="ChatGem">
            <BrandMark size="xl" tile="dark" animate="intro" />
          </Link>
          <h1 className="mt-5 text-3xl [--fg:#fafafa]">
            <BrandWordmark />
          </h1>
          <p className="mt-1 text-sm text-white/50">AI</p>
          <p className="mt-3 text-center text-sm text-white/45">{t("auth.login.subtitle")}</p>

          <div className="mt-6 w-full space-y-4">
            <OAuthButtons mode="login" />

            <div className="flex items-center gap-3 px-1">
              <span className="h-px flex-1 bg-white/15" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                {t("auth.orEmail")}
              </span>
              <span className="h-px flex-1 bg-white/15" />
            </div>

            <form
              onSubmit={onSubmit}
              className="space-y-3 rounded-[1.5rem] border border-white/8 bg-[#121214] p-5"
            >
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="rounded-full border-white/10 bg-black"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  minLength={8}
                  required
                  autoComplete="current-password"
                  className="rounded-full border-white/10 bg-black"
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-full bg-white py-3 text-sm font-semibold text-black disabled:opacity-60"
              >
                {pending ? t("common.loading") : t("auth.login.cta")}
              </button>
            </form>

            {notice ? (
              <p
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-100"
                role="status"
              >
                {notice}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
