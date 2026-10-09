"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/locale-provider";

type Provider = {
  id: string;
  name: string;
  configured: boolean;
  authUrl: string;
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.5C16.7 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.2-1.5H12z"
      />
      <path
        fill="#4285F4"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.5C16.7 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.2-1.5H12z"
        opacity="0"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.3l2.9-2.2C8.8 10.3 10.3 9.2 12 9.2c1.8 0 3 .7 3.7 1.4l2.5-2.5C16.7 6.7 14.6 5.8 12 5.8c-2.9 0-5.4 1.6-6.7 4.1l2 1.5z"
        opacity="0"
      />
      <path
        fill="#34A853"
        d="M12 21.2c2.6 0 4.8-.9 6.4-2.4l-3.1-2.4c-.9.6-2 1-3.3 1-2.5 0-4.6-1.7-5.4-4l-3 2.3C5.1 19.1 8.3 21.2 12 21.2z"
        opacity="0"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current" aria-hidden="true">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12.4c0 5.3 3.4 9.7 8.2 11.3.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 .1.8 1.7 2.8 1.2.1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.4-5.5-6.1 0-1.3.5-2.4 1.2-3.3-.1-.3-.5-1.6.1-3.3 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6.2 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 3 .1 3.3.8.9 1.2 2 1.2 3.3 0 4.7-2.8 5.8-5.5 6.1.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

/** Only Cursor/VS Code Electron — NOT Mobile Preview iframes. */
function isCursorElectron() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Electron|Cursor\/|VSCodium|Code\/1\d/i.test(ua);
}

function isLanHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

async function openGoogleInChrome() {
  const res = await fetch("/api/auth/open-browser", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/api/auth/oauth/google" }),
  });
  if (!res.ok) throw new Error("open failed");
}

function goToOAuth(authUrl: string) {
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.assign(authUrl);
      return;
    }
  } catch {
    // cross-origin frame
  }
  window.location.assign(authUrl);
}

export function OAuthButtons({ mode = "login" }: { mode?: "login" | "register" }) {
  const { t } = useI18n();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lanTip, setLanTip] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLanTip(isLanHost());
    void fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = (data.providers ?? []) as Provider[];
        const ready = list.filter((p) => p.configured && p.id !== "apple");
        // Always surface Google if server says configured; else still show Google
        // entry so the user gets a clear server error instead of a missing button.
        if (ready.length) {
          setProviders(ready);
        } else {
          setProviders([
            {
              id: "google",
              name: "Google",
              configured: false,
              authUrl: "/api/auth/oauth/google",
            },
          ]);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setProviders([
            {
              id: "google",
              name: "Google",
              configured: true,
              authUrl: "/api/auth/oauth/google",
            },
          ]);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) {
    return (
      <div className="h-12 w-full animate-pulse rounded-full bg-white/10" aria-hidden />
    );
  }

  async function onProviderClick(provider: Provider) {
    if (provider.id === "google" && isCursorElectron()) {
      setBusy(true);
      try {
        await openGoogleInChrome();
      } catch {
        window.open(
          `${window.location.origin}/api/auth/oauth/google`,
          "_blank",
          "noopener,noreferrer",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    goToOAuth(provider.authUrl);
  }

  const callbackHint =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/auth/callback/google`
      : "";

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            disabled={busy && provider.id === "google"}
            onClick={() => void onProviderClick(provider)}
            className="flex w-full items-center justify-center gap-2.5 rounded-full border border-white/20 bg-white px-4 py-3.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
          >
            {provider.id === "google" ? <GoogleIcon /> : <GithubIcon />}
            {provider.id === "google"
              ? mode === "login"
                ? t("auth.googleContinue")
                : t("auth.googleSignup")
              : provider.name}
          </button>
        ))}
      </div>

      {lanTip && callbackHint ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100/90">
          {t("auth.googleLanTip").replace("{uri}", callbackHint)}
        </p>
      ) : null}
    </div>
  );
}
