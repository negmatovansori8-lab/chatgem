"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Plus, Trash2 } from "lucide-react";
import { AppBackButton } from "@/components/layout/app-back-button";
import { useI18n } from "@/components/i18n/locale-provider";
import type { KnowledgeBaseRecord, KnowledgeItemRecord } from "@/types/knowledge";

export function KnowledgeWorkspace() {
  const { t } = useI18n();
  const [bases, setBases] = useState<KnowledgeBaseRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<KnowledgeItemRecord[]>([]);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  async function refreshBases() {
    const res = await fetch("/api/knowledge");
    const data = await res.json();
    setBases(data.knowledgeBases ?? []);
  }

  async function openBase(id: string) {
    setActiveId(id);
    setCreating(false);
    const res = await fetch(`/api/knowledge/${id}`);
    const data = await res.json();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void refreshBases();
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

  const activeName = bases.find((b) => b.id === activeId)?.name;

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-lg flex-col bg-black text-white">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {activeId || creating ? (
          <button
            type="button"
            onClick={() => {
              setActiveId(null);
              setCreating(false);
              setItems([]);
            }}
            className="grid h-10 w-10 place-items-center rounded-full bg-[#2a2a2a]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <AppBackButton className="max-w-[7rem]" />
        )}
        <h1 className="flex-1 truncate text-center text-[17px] font-semibold">
          {creating
            ? t("knowledge.newBase")
            : activeName || t("knowledge.title")}
        </h1>
        {!activeId && !creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="grid h-10 w-10 place-items-center rounded-full bg-[#2a2a2a]"
          >
            <Plus className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        {creating ? (
          <form onSubmit={createBase} className="space-y-3 pt-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("knowledge.newBase")}
              className="w-full rounded-2xl bg-[#1a1a1a] px-4 py-3 text-[15px] outline-none placeholder:text-white/35"
              required
            />
            <button
              type="submit"
              className="w-full rounded-2xl bg-[#3b82f6] py-3.5 text-[15px] font-semibold"
            >
              {t("knowledge.newBase")}
            </button>
          </form>
        ) : activeId ? (
          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("knowledge.search")}
                className="flex-1 rounded-2xl bg-[#1a1a1a] px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />
              <button
                type="button"
                onClick={() => void search()}
                className="rounded-2xl bg-white/10 px-4 text-sm font-medium"
              >
                {t("knowledge.searchBtn")}
              </button>
            </div>
            <form onSubmit={addItem} className="space-y-2 rounded-2xl bg-[#1a1a1a] p-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("knowledge.docTitle")}
                className="w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm outline-none placeholder:text-white/35"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("knowledge.docContent")}
                rows={3}
                className="w-full resize-none rounded-xl bg-black/40 px-3 py-2.5 text-sm outline-none placeholder:text-white/35"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-[#3b82f6] py-2.5 text-sm font-semibold"
              >
                {t("knowledge.addDoc")}
              </button>
            </form>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="rounded-2xl bg-[#1a1a1a] p-4">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 line-clamp-4 text-sm text-white/55">{item.content}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-center text-sm text-white/45">{t("knowledge.subtitle")}</p>
            {!bases.length ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#1a1a1a]">
                  <BookOpen className="h-7 w-7 text-white/50" />
                </div>
                <p className="text-sm text-white/45">{t("knowledge.select")}</p>
              </div>
            ) : null}
            {bases.map((base) => (
              <div
                key={base.id}
                className="flex items-center gap-2 rounded-2xl bg-[#1a1a1a] p-2"
              >
                <button
                  type="button"
                  onClick={() => void openBase(base.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/15 text-amber-400">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <span className="truncate text-[15px] font-medium">{base.name}</span>
                </button>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center text-white/35 hover:text-red-400"
                  onClick={() => void removeBase(base.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
