"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Brain, Pencil, Trash2 } from "lucide-react";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { useI18n } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { HttpError, jsonInit, requestJson } from "@/lib/http";
import { cn } from "@/lib/utils";
import type { MemoryRecord } from "@/types/knowledge";

type MemoryResponse = { memories?: MemoryRecord[]; enabled?: boolean };

export function MemoryWorkspace() {
  const { t } = useI18n();
  const toast = useToast();
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const fail = useCallback(
    (e: unknown) => toast.error(e instanceof HttpError && e.offline ? t("common.offline") : t("common.requestFailed")),
    [t, toast],
  );

  const refresh = useCallback(
    () =>
      requestJson<MemoryResponse>("/api/memory")
        .then((data) => {
          setMemories(data.memories ?? []);
          setEnabled(Boolean(data.enabled));
          setLoadError(false);
        })
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      await refresh();
    } catch (e) {
      fail(e);
    }
  }

  async function toggleEnabled() {
    const next = !enabled;
    try {
      await requestJson("/api/memory", jsonInit("POST", { enabled: next }));
      setEnabled(next);
    } catch (e) {
      fail(e);
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!content.trim() || saving) return;
    setSaving(true);
    await run(async () => {
      await requestJson("/api/memory", jsonInit("POST", { content: content.trim(), category: category.trim() || undefined }));
      setContent("");
      setCategory("");
    });
    setSaving(false);
  }

  async function onSaveEdit(id: string) {
    if (!editText.trim()) return;
    await run(async () => {
      await requestJson(`/api/memory/${id}`, jsonInit("PATCH", { content: editText.trim() }));
      setEditingId(null);
      setEditText("");
    });
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col bg-[var(--bg)] text-[var(--fg)] md:max-w-xl">
      <WorkspaceHeader title={t("memory.title")} />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
        <p className="mb-4 text-center text-sm text-[var(--fg-muted)]">{t("memory.subtitle")}</p>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => void toggleEnabled()}
          className={cn(
            "mb-5 flex min-h-12 w-full items-center justify-between rounded-[var(--radius-lg)] border px-4 py-3 transition",
            enabled
              ? "border-transparent bg-[var(--accent-muted)] text-[var(--accent-2)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)]",
          )}
        >
          <span className="inline-flex items-center gap-2 text-[15px] font-medium">
            <Brain className="h-5 w-5" />
            {enabled ? t("memory.on") : t("memory.off")}
          </span>
          <span className="text-xs opacity-80">{enabled ? t("memory.enabled") : t("memory.disabled")}</span>
        </button>

        <form
          onSubmit={onCreate}
          className="mb-5 space-y-2.5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3"
        >
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("memory.add")}
            rows={3}
            className="min-h-[88px] resize-none"
          />
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("memory.category")} />
          <Button type="submit" size="lg" className="w-full" disabled={saving || !content.trim()}>
            {t("memory.save")}
          </Button>
        </form>

        {loading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-2)]" />
            ))}
          </div>
        ) : loadError ? (
          <EmptyState
            title={t("common.requestFailed")}
            actions={
              <Button variant="secondary" onClick={() => void refresh()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : !memories.length ? (
          <EmptyState icon={<Brain className="h-6 w-6" />} title={t("memory.empty")} className="py-8" />
        ) : (
          <ul className="space-y-2">
            {memories.map((memory) => (
              <li
                key={memory.id}
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                {editingId === memory.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="min-h-[88px] resize-none"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => void onSaveEdit(memory.id)}>
                        {t("common.save")}
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingId(null)}>
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words text-sm text-[var(--fg)]">{memory.content}</p>
                    <p className="mt-1 text-xs text-[var(--fg-subtle)]">
                      {memory.category || t("memory.general")} ·{" "}
                      {memory.enabled ? t("memory.enabled") : t("memory.disabled")}
                    </p>
                    <div className="mt-3 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void run(() =>
                            requestJson(`/api/memory/${memory.id}`, jsonInit("PATCH", { enabled: !memory.enabled })),
                          )
                        }
                      >
                        {memory.enabled ? t("memory.turnOff") : t("memory.turnOn")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("common.edit")}
                        onClick={() => {
                          setEditingId(memory.id);
                          setEditText(memory.content);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("common.delete")}
                        className="hover:text-[var(--danger)]"
                        onClick={() => void run(() => requestJson(`/api/memory/${memory.id}`, jsonInit("DELETE")))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
