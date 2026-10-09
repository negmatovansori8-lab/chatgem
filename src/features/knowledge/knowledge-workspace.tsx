"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Download,
  ImageIcon,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { AppBackButton } from "@/components/layout/app-back-button";
import { ImageLightbox } from "@/components/media/image-lightbox";
import { useI18n } from "@/components/i18n/locale-provider";
import { useToast } from "@/components/ui/toast";
import {
  IMAGE_LIBRARY_EVENT,
  loadImageLibrary,
  removeImageFromLibrary,
  type LibraryImage,
} from "@/lib/image-prompt";
import { cn } from "@/lib/utils";
import { useQuickDownload } from "@/components/media/download-button";
import type { KnowledgeBaseRecord, KnowledgeItemRecord } from "@/types/knowledge";

type Tab = "images" | "docs";

export function KnowledgeWorkspace() {
  const { t } = useI18n();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("images");
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const quickDownload = useQuickDownload();
  const [bases, setBases] = useState<KnowledgeBaseRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<KnowledgeItemRecord[]>([]);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  function refreshImages() {
    setImages(loadImageLibrary());
  }

  async function refreshBases() {
    const res = await fetch("/api/knowledge");
    const data = await res.json();
    setBases(data.knowledgeBases ?? []);
  }

  async function openBase(id: string) {
    setActiveId(id);
    setCreating(false);
    setTab("docs");
    const res = await fetch(`/api/knowledge/${id}`);
    const data = await res.json();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    refreshImages();
    void refreshBases();
    const onLib = () => refreshImages();
    window.addEventListener(IMAGE_LIBRARY_EVENT, onLib);
    window.addEventListener("storage", onLib);
    return () => {
      window.removeEventListener(IMAGE_LIBRARY_EVENT, onLib);
      window.removeEventListener("storage", onLib);
    };
  }, []);

  async function createBase(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setName("");
    setCreating(false);
    await refreshBases();
    if (data.knowledgeBase) void openBase(data.knowledgeBase.id);
  }

  async function addItem(event: FormEvent) {
    event.preventDefault();
    if (!activeId || !title.trim() || !content.trim()) return;
    await fetch(`/api/knowledge/${activeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    setTitle("");
    setContent("");
    await openBase(activeId);
  }

  async function search() {
    if (!activeId) return;
    const res = await fetch(
      `/api/knowledge/${activeId}?q=${encodeURIComponent(query)}`,
    );
    const data = await res.json();
    setItems(data.items ?? []);
  }

  async function removeBase(id: string) {
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    if (activeId === id) {
      setActiveId(null);
      setItems([]);
    }
    await refreshBases();
  }

  function deleteImage(id: string) {
    removeImageFromLibrary(id);
    refreshImages();
    toast.info(t("common.delete"));
  }

  function downloadImage(item: LibraryImage) {
    void quickDownload(item.url, { title: item.prompt });
  }

  const activeName = bases.find((b) => b.id === activeId)?.name;
  const showDocDetail = tab === "docs" && Boolean(activeId || creating);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[var(--bg)] text-[var(--fg)]">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 pb-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] lg:px-6 lg:py-4">
        {showDocDetail ? (
          <button
            type="button"
            onClick={() => {
              setActiveId(null);
              setCreating(false);
              setItems([]);
            }}
            className="nj-icon-btn shrink-0 lg:hidden"
            aria-label={t("common.back")}
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
          </button>
        ) : null}
        <AppBackButton className={showDocDetail ? "max-lg:hidden" : undefined} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-center text-[17px] font-semibold tracking-tight lg:text-start lg:font-display lg:text-xl">
            {creating
              ? t("knowledge.newBase")
              : activeName && tab === "docs"
                ? activeName
                : t("sidebar.library")}
          </h1>
          <p className="mt-0.5 hidden text-sm text-[var(--fg-muted)] lg:block">
            {t("knowledge.librarySubtitle")}
          </p>
        </div>
        {tab === "docs" && !showDocDetail ? (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setActiveId(null);
              setTab("docs");
            }}
            className="nj-icon-btn shrink-0 lg:hidden"
            aria-label={t("knowledge.newBase")}
          >
            <Plus className="h-5 w-5" strokeWidth={1.75} />
          </button>
        ) : (
          <span className="h-10 w-10 shrink-0 lg:hidden" aria-hidden />
        )}
        {tab === "docs" ? (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setActiveId(null);
            }}
            className="hidden items-center gap-2 rounded-[var(--radius-md)] bg-[var(--fg)] px-3.5 py-2 text-sm font-semibold text-[var(--bg)] transition hover:opacity-90 lg:inline-flex"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            {t("knowledge.newBase")}
          </button>
        ) : (
          <Link
            href="/app/gallery"
            className="hidden items-center gap-2 rounded-[var(--radius-md)] bg-[var(--fg)] px-3.5 py-2 text-sm font-semibold text-[var(--bg)] transition hover:opacity-90 lg:inline-flex"
          >
            <ImageIcon className="h-4 w-4" strokeWidth={2} />
            {t("knowledge.createImage")}
          </Link>
        )}
      </header>

      {/* Tabs */}
      <div className="flex shrink-0 justify-center gap-1 border-b border-[var(--border)] px-3 py-2 lg:justify-start lg:px-6">
        <button
          type="button"
          onClick={() => {
            setTab("images");
            setCreating(false);
            setActiveId(null);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
            tab === "images"
              ? "bg-[var(--accent-muted)] text-[var(--accent-2)]"
              : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
          )}
        >
          <ImageIcon className="h-4 w-4" />
          {t("knowledge.tabImages")}
          {images.length ? (
            <span className="rounded-full bg-[var(--surface-3)] px-1.5 text-[11px] tabular-nums">
              {images.length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setTab("docs")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
            tab === "docs"
              ? "bg-[var(--accent-muted)] text-[var(--accent-2)]"
              : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
          )}
        >
          <BookOpen className="h-4 w-4" />
          {t("knowledge.tabDocs")}
        </button>
      </div>

      {tab === "images" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 pt-4 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            {!images.length ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--surface-2)] text-[var(--fg-subtle)]">
                  <ImageIcon className="h-8 w-8" strokeWidth={1.5} />
                </div>
                <p className="max-w-sm text-sm text-[var(--fg-muted)]">
                  {t("knowledge.imagesEmpty")}
                </p>
                <Link
                  href="/app/gallery"
                  className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-fg)]"
                >
                  {t("knowledge.createImage")}
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {images.map((item) => (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]"
                  >
                    <button
                      type="button"
                      className="block w-full"
                      onClick={() => setLightbox(item.url)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.prompt || ""}
                        className="aspect-square w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                    <p className="line-clamp-2 px-2 py-1.5 text-[11px] text-[var(--fg-muted)]">
                      {item.prompt || "—"}
                    </p>
                    <div className="absolute end-1.5 top-1.5 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => downloadImage(item)}
                        className="grid h-8 w-8 place-items-center rounded-full bg-[var(--bg)]/90 text-[var(--fg)] shadow-sm"
                        aria-label={t("gallery.download")}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteImage(item.id)}
                        className="grid h-8 w-8 place-items-center rounded-full bg-[var(--bg)]/90 text-red-400 shadow-sm"
                        aria-label={t("common.delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : !bases.length && !creating ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--surface-2)] text-[var(--fg-subtle)]">
            <BookOpen className="h-8 w-8" strokeWidth={1.5} />
          </div>
          <div className="max-w-sm space-y-1">
            <p className="text-[15px] font-medium text-[var(--fg)]">
              {t("knowledge.select")}
            </p>
            <p className="text-sm text-[var(--fg-muted)]">
              {t("knowledge.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setActiveId(null);
            }}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--fg)] px-5 py-2.5 text-sm font-semibold text-[var(--bg)] transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            {t("knowledge.newBase")}
          </button>
        </div>
      ) : (
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col lg:flex-row">
          <aside
            className={cn(
              "min-h-0 shrink-0 overflow-y-auto border-[var(--border)] lg:w-72 lg:border-e xl:w-80",
              showDocDetail ? "hidden lg:block" : "block",
            )}
          >
            <div className="space-y-2 p-4 lg:p-5">
              {bases.map((base) => (
                <div
                  key={base.id}
                  className={cn(
                    "flex items-center gap-1 rounded-[var(--radius-lg)] border border-transparent p-1.5 transition",
                    activeId === base.id
                      ? "border-[var(--border)] bg-[var(--surface-2)]"
                      : "hover:bg-[var(--surface-2)]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void openBase(base.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-left"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent-2)]">
                      <BookOpen className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <span className="truncate text-[15px] font-medium">
                      {base.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-red-400"
                    onClick={() => void removeBase(base.id)}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          <section
            className={cn(
              "min-h-0 min-w-0 flex-1 overflow-y-auto",
              showDocDetail ? "block" : "hidden lg:block",
            )}
          >
            <div className="mx-auto w-full max-w-2xl space-y-4 p-4 pb-10 sm:p-6 lg:max-w-3xl lg:p-8">
              {creating ? (
                <form onSubmit={createBase} className="space-y-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("knowledge.newBase")}
                    className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[15px] outline-none placeholder:text-[var(--fg-subtle)] focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--accent-muted)]"
                    required
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="w-full rounded-[var(--radius-lg)] bg-[var(--accent)] py-3.5 text-[15px] font-semibold text-[var(--accent-fg)] sm:w-auto sm:px-8"
                  >
                    {t("knowledge.newBase")}
                  </button>
                </form>
              ) : activeId ? (
                <>
                  <div className="flex gap-2">
                    <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 focus-within:ring-2 focus-within:ring-[var(--accent-muted)]">
                      <Search className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("knowledge.search")}
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--fg-subtle)]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void search()}
                      className="shrink-0 rounded-[var(--radius-lg)] bg-[var(--surface-2)] px-4 text-sm font-medium"
                    >
                      {t("knowledge.searchBtn")}
                    </button>
                  </div>
                  <form
                    onSubmit={addItem}
                    className="space-y-2 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4"
                  >
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t("knowledge.docTitle")}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--fg-subtle)]"
                    />
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={t("knowledge.docContent")}
                      rows={3}
                      className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--fg-subtle)]"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-[var(--radius-md)] bg-[var(--accent)] py-2.5 text-sm font-semibold text-[var(--accent-fg)] sm:w-auto sm:px-6"
                    >
                      {t("knowledge.addDoc")}
                    </button>
                  </form>
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4"
                      >
                        <p className="font-semibold">{item.title}</p>
                        <p className="mt-1 line-clamp-4 text-sm text-[var(--fg-muted)]">
                          {item.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--surface-2)] text-[var(--fg-subtle)]">
                    <BookOpen className="h-8 w-8" strokeWidth={1.5} />
                  </div>
                  <p className="max-w-sm text-sm text-[var(--fg-muted)]">
                    {t("knowledge.select")}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <ImageLightbox
        open={Boolean(lightbox)}
        src={lightbox}
        onClose={() => setLightbox(null)}
        downloadLabel={t("gallery.download")}
        onDownload={
          lightbox
            ? () => {
                const item = images.find((img) => img.url === lightbox);
                void quickDownload(lightbox, { title: item?.prompt });
              }
            : undefined
        }
      />
    </div>
  );
}
