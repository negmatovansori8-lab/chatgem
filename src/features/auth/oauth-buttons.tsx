"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/locale-provider";

type Provider = {
  id: string;
  name: string;
  configured: boolean;
  authUrl: string;
};

function ProviderIcon({ id }: { id: string }) {
  if (id === "google") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.5C16.7 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.2-1.5H12z"
        />
        <path
          fill="#4285F4"
          d="M23.5 12.2c0-.7-.1-1.4-.2-2H12v3.8h6.5c-.3 1.5-1.2 2.8-2.5 3.6v3h4c2.3-2.1 3.5-5.2 3.5-8.4z"
          opacity="0"
        />
      </svg>
    );
  }
  if (id === "github") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M12 .5A11.5 11.5 0 0 0 .5 12.4c0 5.3 3.4 9.7 8.2 11.3.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 .1.8 1.7 2.8 1.2.1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.4-5.5-6.1 0-1.3.5-2.4 1.2-3.3-.1-.3-.5-1.6.1-3.3 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6.2 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 3 .1 3.3.8.9 1.2 2 1.2 3.3 0 4.7-2.8 5.8-5.5 6.1.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
      </svg>
    );
  }
  return null;
}

/** Only Cursor/VS Code Electron — NOT Mobile Preview iframes. */
function isCursorElectron() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Electron|Cursor\/|VSCodium|Code\/1\d/i.test(ua);
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
    // cross-origin frame — fall through
  }
  window.location.assign(authUrl);
}

export function OAuthButtons({ mode = "login" }: { mode?: "login" | "register" }) {
  const { t } = useI18n();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = (data.providers ?? []) as Provider[];
        setProviders(list.filter((p) => p.configured && p.id !== "apple"));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || providers.length === 0) return null;

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

  return (
    <div className="space-y-3">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fg-subtle)]">
        {mode === "login" ? t("auth.continueWith") : t("auth.signupWith")}
      </p>

      <div className="grid gap-2">
        {providers.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="secondary"
            disabled={busy && provider.id === "google"}
            className="w-full justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-2)]"
            onClick={() => void onProviderClick(provider)}
          >
            <ProviderIcon id={provider.id} />
            {provider.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
