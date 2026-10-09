"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppBackButton } from "@/components/layout/app-back-button";
import { useI18n } from "@/components/i18n/locale-provider";

/** Lightweight studio — full experience lives in GalleryWorkspace. */
export function ImageStudioWorkspace() {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function generate() {
    if (!prompt.trim() || busy) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setMessage(null);
    setUrl(null);
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, aspect: "1:1", style: "auto" }),
        signal: ac.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error?.message ?? t("gallery.errorGenerate"));
        return;
      }
      setUrl(typeof data.url === "string" ? data.url : null);
      setMessage(data.message ?? t("gallery.done"));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setMessage(t("gallery.errorGenerate"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nj-page space-y-6 py-6">
      <header className="flex min-w-0 items-start gap-2">
        <AppBackButton />
        <div className="min-w-0 flex-1">
          <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            Image Studio
          </p>
          <h1 className="font-display text-2xl font-bold text-[var(--fg)] sm:text-3xl">
            {t("gallery.createTitle")}
          </h1>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">{t("gallery.subtitle")}</p>
        </div>
      </header>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={t("gallery.prompt")}
        className="min-h-[100px] w-full"
        disabled={busy}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-11"
          onClick={() => void generate()}
          disabled={!prompt.trim() || busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("gallery.generate")}
        </Button>
        {busy ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => abortRef.current?.abort()}
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            {t("gallery.cancel")}
          </Button>
        ) : null}
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={prompt}
          className="h-auto max-h-[70vh] w-full rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] object-contain"
        />
      ) : null}
      {message ? (
        <p className="text-xs text-[var(--fg-subtle)]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
