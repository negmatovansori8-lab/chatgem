"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { FolderKanban, Plus, Trash2 } from "lucide-react";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { useI18n } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { HttpError, jsonInit, requestJson } from "@/lib/http";
import type { ProjectRecord } from "@/types/knowledge";

export function ProjectsWorkspace() {
  const { t } = useI18n();
  const toast = useToast();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selected, setSelected] = useState<ProjectRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  const fail = useCallback(
    (e: unknown) => toast.error(e instanceof HttpError && e.offline ? t("common.offline") : t("common.requestFailed")),
    [t, toast],
  );

  const refresh = useCallback(
    () =>
      requestJson<{ projects?: ProjectRecord[] }>("/api/projects")
        .then((data) => {
          setProjects(data.projects ?? []);
          setLoadError(false);
        })
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const data = await requestJson<{ project?: ProjectRecord }>(
        "/api/projects",
        jsonInit("POST", { name: name.trim(), description, instructions }),
      );
      setName("");
      setDescription("");
      setInstructions("");
      setCreating(false);
      await refresh();
      if (data.project) setSelected(data.project);
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }

  async function onSave() {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await requestJson(
        `/api/projects/${selected.id}`,
        jsonInit("PATCH", {
          name: selected.name,
          description: selected.description,
          instructions: selected.instructions,
        }),
      );
      await refresh();
      toast.success(t("common.save"));
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await requestJson(`/api/projects/${id}`, jsonInit("DELETE"));
      if (selected?.id === id) setSelected(null);
      await refresh();
    } catch (e) {
      fail(e);
    }
  }

  const inDetail = Boolean(selected || creating);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col bg-[var(--bg)] text-[var(--fg)] md:max-w-xl">
      <WorkspaceHeader
        title={creating ? t("projects.create") : selected ? t("projects.edit") : t("projects.title")}
        onBack={
          inDetail
            ? () => {
                setSelected(null);
                setCreating(false);
              }
            : undefined
        }
        action={
          !inDetail ? (
            <Button variant="ghost" size="icon" aria-label={t("projects.create")} onClick={() => setCreating(true)}>
              <Plus className="h-5 w-5" />
            </Button>
          ) : null
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
        {creating ? (
          <form onSubmit={onCreate} className="space-y-3">
            <p className="text-sm text-[var(--fg-muted)]">{t("projects.subtitle")}</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("projects.name")} required />
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("projects.description")}
            />
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t("projects.instructions")}
              rows={5}
              className="resize-none"
            />
            <Button type="submit" size="lg" className="w-full" disabled={saving || !name.trim()}>
              {t("projects.create")}
            </Button>
          </form>
        ) : selected ? (
          <div className="space-y-3">
            <Input
              value={selected.name}
              aria-label={t("projects.name")}
              onChange={(e) => setSelected({ ...selected, name: e.target.value })}
            />
            <Textarea
              value={selected.description ?? ""}
              onChange={(e) => setSelected({ ...selected, description: e.target.value })}
              placeholder={t("projects.description")}
              rows={2}
              className="min-h-[72px] resize-none"
            />
            <Textarea
              value={selected.instructions ?? ""}
              onChange={(e) => setSelected({ ...selected, instructions: e.target.value })}
              placeholder={t("projects.instructions")}
              rows={8}
              className="resize-none"
            />
            <Button size="lg" className="w-full" onClick={() => void onSave()} disabled={saving}>
              {t("common.save")}
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-2)]" />
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
        ) : !projects.length ? (
          <EmptyState
            icon={<FolderKanban className="h-6 w-6" />}
            title={t("projects.empty")}
            description={t("projects.subtitle")}
            actions={<Button onClick={() => setCreating(true)}>{t("projects.create")}</Button>}
          />
        ) : (
          <div className="space-y-2">
            <p className="mb-3 text-center text-sm text-[var(--fg-muted)]">{t("projects.subtitle")}</p>
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-1.5"
              >
                <button
                  type="button"
                  onClick={() => setSelected(project)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-start transition hover:bg-[var(--surface-2)]"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent-2)]">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{project.name}</span>
                    <span className="block truncate text-xs text-[var(--fg-subtle)]">
                      {project.description || t("projects.emptyDesc")}
                    </span>
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.delete")}
                  className="hover:text-[var(--danger)]"
                  onClick={() => void onDelete(project.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
