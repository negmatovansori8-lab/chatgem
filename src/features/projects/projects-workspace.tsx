"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, FolderKanban, Plus, Trash2 } from "lucide-react";
import { AppBackButton } from "@/components/layout/app-back-button";
import { useI18n } from "@/components/i18n/locale-provider";
import type { ProjectRecord } from "@/types/knowledge";

export function ProjectsWorkspace() {
  const { t } = useI18n();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selected, setSelected] = useState<ProjectRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data.projects ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, instructions }),
    });
    const data = await res.json();
    setName("");
    setDescription("");
    setInstructions("");
    setCreating(false);
    await refresh();
    if (data.project) setSelected(data.project);
    setSaving(false);
  }

  async function onSave() {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/projects/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: selected.name,
        description: selected.description,
        instructions: selected.instructions,
      }),
    });
    await refresh();
    setSaving(false);
  }

  async function onDelete(id: string) {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    await refresh();
  }

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-lg flex-col bg-black text-white">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {selected || creating ? (
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setCreating(false);
            }}
            className="grid h-10 w-10 place-items-center rounded-full bg-[#2a2a2a]"
            aria-label={t("common.back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <AppBackButton className="max-w-[7rem]" />
        )}
        <h1 className="flex-1 text-center text-[17px] font-semibold">
          {creating
            ? t("projects.create")
            : selected
              ? t("projects.edit")
              : t("projects.title")}
        </h1>
        {!selected && !creating ? (
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
          <form onSubmit={onCreate} className="space-y-3 pt-2">
            <p className="text-sm text-white/45">{t("projects.subtitle")}</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("projects.name")}
              required
              className="w-full rounded-2xl bg-[#1a1a1a] px-4 py-3 text-[15px] outline-none placeholder:text-white/35"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("projects.description")}
              className="w-full rounded-2xl bg-[#1a1a1a] px-4 py-3 text-[15px] outline-none placeholder:text-white/35"
            />
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t("projects.instructions")}
              rows={5}
              className="w-full resize-none rounded-2xl bg-[#1a1a1a] px-4 py-3 text-[15px] outline-none placeholder:text-white/35"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-[#3b82f6] py-3.5 text-[15px] font-semibold disabled:opacity-50"
            >
              {t("projects.create")}
            </button>
          </form>
        ) : selected ? (
          <div className="space-y-3 pt-2">
            <input
              value={selected.name}
              onChange={(e) => setSelected({ ...selected, name: e.target.value })}
              className="w-full rounded-2xl bg-[#1a1a1a] px-4 py-3 text-[15px] outline-none"
            />
            <textarea
              value={selected.description ?? ""}
              onChange={(e) =>
                setSelected({ ...selected, description: e.target.value })
              }
              placeholder={t("projects.description")}
              rows={2}
              className="w-full resize-none rounded-2xl bg-[#1a1a1a] px-4 py-3 text-[15px] outline-none placeholder:text-white/35"
            />
            <textarea
              value={selected.instructions ?? ""}
              onChange={(e) =>
                setSelected({ ...selected, instructions: e.target.value })
              }
              placeholder={t("projects.instructions")}
              rows={8}
              className="w-full resize-none rounded-2xl bg-[#1a1a1a] px-4 py-3 text-[15px] outline-none placeholder:text-white/35"
            />
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving}
              className="w-full rounded-2xl bg-[#3b82f6] py-3.5 text-[15px] font-semibold disabled:opacity-50"
            >
              {t("common.save")}
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-center text-sm text-white/45">{t("projects.subtitle")}</p>
            {loading ? (
              <p className="py-8 text-center text-sm text-white/35">{t("common.loading")}</p>
            ) : null}
            {!loading && !projects.length ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#1a1a1a]">
                  <FolderKanban className="h-7 w-7 text-white/50" />
                </div>
                <p className="text-sm text-white/45">{t("projects.empty")}</p>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="rounded-full bg-[#3b82f6] px-5 py-2.5 text-sm font-semibold"
                >
                  {t("projects.create")}
                </button>
              </div>
            ) : null}
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-2 rounded-2xl bg-[#1a1a1a] p-2"
              >
                <button
                  type="button"
                  onClick={() => setSelected(project)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">
                      {project.name}
                    </span>
                    <span className="block truncate text-xs text-white/40">
                      {project.description || t("projects.emptyDesc")}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center text-white/35 hover:text-red-400"
                  onClick={() => void onDelete(project.id)}
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
