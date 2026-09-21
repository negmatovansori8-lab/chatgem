"use client";

import { FormEvent, useEffect, useState } from "react";
import { Brain, Pencil, Trash2 } from "lucide-react";
import { AppBackButton } from "@/components/layout/app-back-button";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { MemoryRecord } from "@/types/knowledge";

export function MemoryWorkspace() {
  const { t } = useI18n();
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  async function refresh() {
    const res = await fetch("/api/memory");
    const data = await res.json();
    setMemories(data.memories ?? []);
    setEnabled(Boolean(data.enabled));
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggleEnabled() {
    const next = !enabled;
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setEnabled(next);
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, category: category || undefined }),
    });
    setContent("");
    setCategory("");
    await refresh();
  }

  async function onSaveEdit(id: string) {
    if (!editText.trim()) return;
    await fetch(`/api/memory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editText.trim() }),
    });
    setEditingId(null);
    setEditText("");
    await refresh();
  }

  async function onToggleItem(memory: MemoryRecord) {
    await fetch(`/api/memory/${memory.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !memory.enabled }),
    });
    await refresh();
  }

  async function onDelete(id: string) {
    await fetch(`/api/memory/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-lg flex-col bg-[var(--bg)] text-[var(--fg)]">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <AppBackButton />
        <h1 className="flex-1 text-center text-[17px] font-semibold">
          {t("memory.title")}
        </h1>
        <div className="w-10" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        <p className="mb-4 text-center text-sm text-[var(--fg-subtle)]">{t("memory.subtitle")}</p>

        <button
          type="button"
          onClick={() => void toggleEnabled()}
          className={cn(
            "mb-5 flex w-full items-center justify-between rounded-2xl px-4 py-3.5",
            enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-[#1a1a1a] text-white/50",
          )}
        >
          <span className="inline-flex items-center gap-2 text-[15px] font-medium">
            <Brain className="h-5 w-5" />
            {enabled ? t("memory.on") : t("memory.off")}
          </span>
          <span className="text-xs opacity-70">
            {enabled ? t("memory.enabled") : t("memory.disabled")}
          </span>
        </button>

        <form onSubmit={onCreate} className="mb-5 space-y-2 rounded-2xl bg-[#1a1a1a] p-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("memory.add")}
            rows={3}
            className="w-full resize-none rounded-xl bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-white/35"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t("memory.category")}
            className="w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm outline-none placeholder:text-white/35"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-[#3b82f6] py-3 text-sm font-semibold"
          >
            {t("memory.save")}
          </button>
        </form>

        {!memories.length ? (
          <p className="py-8 text-center text-sm text-white/35">{t("memory.empty")}</p>
        ) : null}

        <ul className="space-y-2">
          {memories.map((memory) => (
            <li key={memory.id} className="rounded-2xl bg-[#1a1a1a] p-4">
              {editingId === memory.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl bg-black/40 px-3 py-2 text-sm outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void onSaveEdit(memory.id)}
                      className="flex-1 rounded-xl bg-[#3b82f6] py-2 text-sm font-semibold"
                    >
                      {t("common.save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-xl bg-white/10 px-4 py-2 text-sm"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-white/90">{memory.content}</p>
                  <p className="mt-1 text-[11px] text-white/35">
                    {memory.category || t("memory.general")} ·{" "}
                    {memory.enabled ? t("memory.enabled") : t("memory.disabled")}
                  </p>
                  <div className="mt-3 flex gap-1">
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:bg-white/10"
                      onClick={() => void onToggleItem(memory)}
                    >
                      {memory.enabled ? t("memory.turnOff") : t("memory.turnOn")}
                    </button>
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/10"
                      onClick={() => {
                        setEditingId(memory.id);
                        setEditText(memory.content);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:text-red-400"
                      onClick={() => void onDelete(memory.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
