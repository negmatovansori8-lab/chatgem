"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  ImageIcon,
  Loader2,
  Mic,
  X,
} from "lucide-react";
import { AppBackButton } from "@/components/layout/app-back-button";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

type StyleCard = {
  id: string;
  url: string;
  labelKey: string;
  prompt: string;
};

const STYLES: StyleCard[] = [
  {
    id: "stickers",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=900&q=80",
    labelKey: "gallery.style.stickers",
    prompt: "Cute colorful sticker pack, thick outlines, white background",
  },
  {
    id: "photo",
    url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=900&q=80",
    labelKey: "gallery.style.diagram",
    prompt: "Clear educational diagram of photosynthesis, labeled scheme",
  },
  {
    id: "map",
    url: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=900&q=80",
    labelKey: "gallery.style.map",
    prompt: "Vintage map of Ancient Rome, parchment style",
  },
  {
    id: "timeline",
    url: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&q=80",
    labelKey: "gallery.style.timeline",
    prompt: "Historical timeline infographic, clean educational style",
  },
  {
    id: "cell",
    url: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=900&q=80",
    labelKey: "gallery.style.cell",
    prompt: "Labeled plant cell scientific diagram, textbook style",
  },
  {
    id: "room",
    url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=900&q=80",
    labelKey: "gallery.style.room",
    prompt: "Cozy bedroom with warm string lights, photorealistic",
  },
  {
    id: "mountains",
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=80",
    labelKey: "gallery.style.mountains",
    prompt: "Epic mountain landscape at sunrise, photorealistic, cinematic",
  },
  {
    id: "neon",
    url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=900&q=80",
    labelKey: "gallery.style.neon",
    prompt: "Neon cyberpunk city street at night, vibrant lights",
  },
];

type MadeItem = {
  id: string;
  url: string;
  prompt: string;
};

export function GalleryWorkspace() {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<MadeItem | null>(null);
  const [library, setLibrary] = useState<MadeItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nj_image_library_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as MadeItem[];
      if (Array.isArray(parsed)) setLibrary(parsed.slice(0, 40));
    } catch {
      // ignore
    }
  }, []);

  async function generate(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: q }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error?.message ?? t("gallery.errorGenerate"));
      return;
    }
    if (typeof data.url === "string") {
      const item: MadeItem = {
        id: crypto.randomUUID(),
        url: data.url,
        prompt: q,
      };
      setResult(item);
      setLibrary((prev) => [item, ...prev].slice(0, 40));
      try {
        const raw = localStorage.getItem("nj_image_library_v1");
        const prev = raw ? (JSON.parse(raw) as MadeItem[]) : [];
        localStorage.setItem(
          "nj_image_library_v1",
          JSON.stringify([item, ...prev].slice(0, 40)),
        );
      } catch {
        // ignore
      }
    }
    setMessage(
      typeof data.message === "string"
        ? data.message
        : t("gallery.done"),
    );
    if (data.openaiError?.detail) {
      const detail =
        typeof data.openaiError.detail === "string"
          ? data.openaiError.detail.slice(0, 180)
          : "";
      if (detail) {
        setMessage((prev) => `${prev ?? ""}\nOpenAI: ${detail}`);
      }
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void generate(prompt);
  }

  function pickStyle(style: StyleCard) {
    setPrompt(t(style.labelKey));
    void generate(style.prompt);
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-black text-white">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5">
        <AppBackButton className="shrink-0" />
        <div className="flex-1" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-5xl">
          <p className="mb-4 text-center text-[13px] leading-snug text-white/45 sm:mb-5 sm:text-[14px]">
            {t("gallery.libraryTip")}{" "}
            <Link
              href="/app/knowledge"
              className="text-white/70 underline-offset-2 hover:underline"
            >
              {t("sidebar.library")}
            </Link>{" "}
            {t("gallery.libraryTipEnd")}
          </p>

          <h1 className="mb-5 text-center text-[26px] font-semibold tracking-tight text-white sm:mb-7 sm:text-[34px]">
            {t("gallery.createTitle")}
          </h1>

          {result ? (
            <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#141414] sm:mb-8 sm:rounded-3xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.url}
                alt={result.prompt}
                className="max-h-[55vh] w-full object-cover"
              />
              <div className="flex items-start justify-between gap-2 px-3 py-2.5 sm:px-4">
                <p className="min-w-0 flex-1 truncate text-sm text-white/55">
                  {result.prompt}
                </p>
                <button
                  type="button"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/40 hover:bg-white/10"
                  onClick={() => setResult(null)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
            {STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                disabled={busy}
                onClick={() => pickStyle(style)}
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#1a1a1a] text-left transition active:scale-[0.98] disabled:opacity-60 sm:aspect-[4/5] sm:rounded-3xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={style.url}
                  alt={t(style.labelKey)}
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2.5 pb-2.5 pt-10 sm:px-3.5 sm:pb-3.5">
                  <p className="text-[13px] font-semibold leading-snug text-white sm:text-[15px]">
                    {t(style.labelKey)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {library.length ? (
            <section className="mt-8 sm:mt-10">
              <h2 className="mb-3 text-[13px] font-semibold text-white/45 sm:mb-4 sm:text-[14px]">
                {t("gallery.yourLibrary")}
              </h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
                {library.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="aspect-square overflow-hidden rounded-2xl"
                    onClick={() => setResult(item)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.prompt}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {message ? (
            <p className="mt-4 text-center text-xs text-white/40" role="status">
              {message}
            </p>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="shrink-0 border-t border-white/5 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
      >
        <div className="mx-auto w-full max-w-3xl">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const url = URL.createObjectURL(file);
              const item: MadeItem = {
                id: crypto.randomUUID(),
                url,
                prompt: file.name,
              };
              setResult(item);
              setLibrary((prev) => [item, ...prev]);
              setMessage(t("gallery.updated"));
            }}
          />
          <div className="flex items-end gap-1 rounded-[1.75rem] border border-white/10 bg-[#212121] px-1.5 py-1.5">
            <button
              type="button"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10"
              aria-label={t("gallery.upload")}
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("gallery.prompt")}
              rows={1}
              className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-base text-white outline-none placeholder:text-white/40 md:text-[15px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void generate(prompt);
                }
              }}
            />
            {!prompt.trim() && !busy ? (
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/45"
                aria-label="Voice"
                disabled
              >
                <Mic className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={busy || !prompt.trim()}
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-full",
                  busy || !prompt.trim()
                    ? "bg-white/15 text-white/40"
                    : "bg-white text-black",
                )}
                aria-label={t("gallery.generate")}
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowUp className="h-5 w-5" strokeWidth={2.25} />
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
