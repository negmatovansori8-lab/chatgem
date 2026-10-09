"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { AppBackButton } from "@/components/layout/app-back-button";
import { useI18n } from "@/components/i18n/locale-provider";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { FileRecord } from "@/types/knowledge";

export function FilesWorkspace() {
  const { t } = useI18n();
  const toast = useToast();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [selected, setSelected] = useState<FileRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const res = await fetch("/api/files");
    const data = await res.json();
    setFiles(data.files ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onUpload(list: FileList | null) {
    if (!list?.[0]) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", list[0]);
    try {
      const res = await fetch("/api/files", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error?.message ?? t("files.error");
        setError(msg);
        toast.error(msg);
        return;
      }
      await refresh();
      setSelected(data.file);
      toast.success(t("files.upload"));
    } catch {
      const msg = t("files.error");
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onDelete(id: string) {
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    await refresh();
    toast.info(t("common.delete"));
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      className="hidden"
      accept=".pdf,.txt,.doc,.docx,.md,.json,image/*,text/*,.js,.ts,.tsx,.py,.css,.html"
      onChange={(e) => void onUpload(e.target.files)}
    />
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col bg-[var(--bg)] text-[var(--fg)] md:max-w-xl lg:max-w-2xl">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <AppBackButton />
        <h1 className="flex-1 truncate text-center text-[17px] font-semibold">
          {t("files.title")}
        </h1>
        <div className="w-10 shrink-0" />
      </header>

      {!files.length ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void onUpload(e.dataTransfer.files);
          }}
          className={cn(
            "mx-4 mb-[max(1rem,env(safe-area-inset-bottom))] mt-3 flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed px-6 text-center transition disabled:opacity-50",
            dragOver
              ? "border-[var(--accent)] bg-[var(--accent)]/10"
              : "border-[var(--border)] bg-[var(--surface)]",
          )}
        >
          {fileInput}
          <Upload className="h-8 w-8 text-[var(--fg-subtle)]" />
          <span className="text-[17px] font-semibold">
            {uploading ? t("files.uploading") : t("files.upload")}
          </span>
          <span className="text-sm text-[var(--fg-muted)]">{t("files.empty")}</span>
          <span className="max-w-[16rem] text-xs leading-relaxed text-[var(--fg-subtle)]">
            {t("files.hint")}
          </span>
          <span className="text-[11px] text-[var(--fg-subtle)]">{t("files.formats")}</span>
          {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
        </button>
      ) : null}

      {files.length ? (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mb-4 mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--surface)] px-4 text-[15px] font-medium disabled:opacity-50"
        >
          {fileInput}
          <Upload className="h-4 w-4" />
          {uploading ? t("files.uploading") : t("files.upload")}
        </button>
        {error ? <p className="mb-3 text-center text-xs text-[var(--danger)]">{error}</p> : null}

        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 rounded-2xl bg-[var(--surface)] p-2">
              <button
                type="button"
                onClick={() => setSelected(file)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-500/15 text-sky-400">
                  <FileText className="h-5 w-5" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{file.name}</span>
                  <span className="block text-[11px] text-[var(--fg-subtle)]">
                    {file.status} · {(file.size / 1024).toFixed(1)} KB
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center text-[var(--fg-subtle)] hover:text-[var(--danger)]"
                onClick={() => void onDelete(file.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        {selected ? (
          <div className="mt-5 rounded-2xl bg-[var(--surface)] p-4">
            <h2 className="mb-2 text-[15px] font-semibold">{selected.name}</h2>
            <p className="mb-3 text-[11px] text-[var(--fg-subtle)]">
              {selected.mimeType} · {selected.status}
            </p>
            <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-[var(--fg-muted)]">
              {selected.extractedText || t("files.noText")}
            </pre>
          </div>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}
