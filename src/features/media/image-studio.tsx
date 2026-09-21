"use client";

import { useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppBackButton } from "@/components/layout/app-back-button";

export function ImageStudioWorkspace() {
  const [prompt, setPrompt] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setMessage(null);
    setUrl(null);
    const res = await fetch("/api/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error?.message ?? "Generation failed");
      return;
    }
    setUrl(typeof data.url === "string" ? data.url : null);
    setMessage(data.message ?? "Done");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex items-start gap-2">
        <AppBackButton />
        <div>
          <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            <ImageIcon className="h-3.5 w-3.5" />
            Image Studio
          </p>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Text to image</h1>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            Free generation is live via Pollinations.
          </p>
        </div>
      </header>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe an image…"
        className="min-h-[100px] rounded-2xl"
      />
      <Button
        type="button"
        className="rounded-full"
        onClick={() => void generate()}
        disabled={!prompt.trim() || busy}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Generate
      </Button>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={prompt}
          className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)]"
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
