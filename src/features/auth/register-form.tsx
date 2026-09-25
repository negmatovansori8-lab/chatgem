"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/locale-provider";
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
    <div className="relative flex min-h-dvh flex-col bg-[#050505] text-white">
      <div className="absolute end-4 top-4 z-10">
        <LanguageSwitcher compact />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pt-16">
        <Link
          href="/"
          className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-black"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/chatgem-logo.png"
            alt="ChatGem"
            className="h-full w-full object-cover object-top"
          />
        </Link>
        <h1 className="font-display mt-4 text-2xl font-bold">{t("auth.register.title")}</h1>
        <p className="mt-1 max-w-sm text-center text-sm text-white/50">
          {t("auth.register.subtitle")}
        </p>
      </div>
      <div className="mx-auto w-full max-w-md space-y-4 px-5 pb-10 animate-auth-rise">
        <div className="rounded-[1.5rem] border border-white/8 bg-[#121214] p-5">
          <OAuthButtons mode="register" />
          <div className="my-4 h-px bg-white/10" />
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">{t("auth.name")}</Label>
              <Input
                id="name"
                name="name"
                required
                autoComplete="name"
                className="rounded-full border-white/10 bg-black"
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
                autoComplete="new-password"
                className="rounded-full border-white/10 bg-black"
              />
            </div>
            {notice ? <p className="text-xs text-white/60" role="alert">{notice}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-white py-3 text-sm font-semibold text-black disabled:opacity-60"
            >
              {pending ? t("common.loading") : t("auth.register.cta")}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-white/50">
          {t("auth.hasAccount")}{" "}
          <Link href="/login" className="text-white underline underline-offset-2">
            {t("auth.login.cta")}
          </Link>
        </p>
      </div>
    </div>
  );
}
