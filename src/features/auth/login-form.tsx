"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/locale-provider";
import { OAuthButtons } from "@/features/auth/oauth-buttons";

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [emailMode, setEmailMode] = useState(false);
  const [hasOAuth, setHasOAuth] = useState(false);
  const { t } = useI18n();
  const router = useRouter();
  const search = useSearchParams();
  const notice = formNotice ?? search.get("oauth_error");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = (data.providers ?? []) as { configured?: boolean; id?: string }[];
        setHasOAuth(list.some((p) => p.configured && p.id !== "apple"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    <div className="relative flex min-h-dvh flex-col bg-[#050505] text-white">
      <div className="absolute end-4 top-4 z-10">
        <LanguageSwitcher compact />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="flex w-full max-w-md flex-col items-center animate-auth-rise">
          <Link
            href="/"
            className="grid h-16 w-16 place-items-center rounded-2xl bg-[linear-gradient(145deg,#3b82f6,#60a5fa)] shadow-[0_20px_50px_-20px_rgba(59,130,246,0.7)]"
          >
            <span className="font-display text-2xl font-bold text-white">C</span>
          </Link>
          <h1 className="font-display mt-5 text-3xl font-bold tracking-tight">ChatGem</h1>
          <p className="mt-1 text-sm text-white/50">AI</p>
          <p className="mt-3 text-sm text-white/45">{t("auth.login.subtitle")}</p>

          <div className="mt-6 w-full space-y-3">
            {!emailMode ? (
              <>
                <OAuthButtons mode="login" />
                {hasOAuth ? (
                  <button
                    type="button"
                    onClick={() => setEmailMode(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-transparent px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-white/5"
                  >
                    <Mail className="h-4 w-4" />
                    {t("auth.emailWay")}
                  </button>
                ) : (
                  <form onSubmit={onSubmit} className="space-y-3 rounded-[1.5rem] border border-white/8 bg-[#121214] p-5">
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
                )}
                <p className="pt-2 text-center text-xs text-white/45">
                  {t("auth.noAccount")}{" "}
                  <Link href="/register" className="text-white underline underline-offset-2">
                    {t("auth.register.cta")}
                  </Link>
                </p>
              </>
            ) : (
              <form onSubmit={onSubmit} className="space-y-3 rounded-[1.5rem] border border-white/8 bg-[#121214] p-5">
                <button
                  type="button"
                  className="text-xs text-white/50 hover:text-white"
                  onClick={() => setEmailMode(false)}
                >
                  ← {t("common.back")}
                </button>
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
                <p className="text-center text-xs text-white/50">
                  {t("auth.noAccount")}{" "}
                  <Link href="/register" className="text-white underline">
                    {t("auth.register.cta")}
                  </Link>
                </p>
              </form>
            )}

            {notice ? (
              <p
                className="rounded-2xl border border-white/8 bg-[#121214] px-4 py-3 text-xs text-white/70"
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
