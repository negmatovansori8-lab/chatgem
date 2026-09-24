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

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-lg flex-col bg-black text-white">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <AppBackButton className="max-w-[7rem]" />
        <h1 className="flex-1 text-center text-[17px] font-semibold">
          {t("files.title")}
        </h1>
        <div className="w-10" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        <p className="mb-4 text-center text-sm text-white/45">{t("files.subtitle")}</p>

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
            "mb-5 flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-8 transition disabled:opacity-50",
            dragOver
              ? "border-[var(--accent)] bg-[var(--accent)]/10"
              : "border-white/15 bg-[#1a1a1a]",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.txt,.doc,.docx,.md,.json,image/*,text/*,.js,.ts,.tsx,.py,.css,.html"
            onChange={(e) => void onUpload(e.target.files)}
          />
          <Upload className="h-7 w-7 text-white/50" />
          <span className="text-[15px] font-medium">
            {uploading ? t("files.uploading") : t("files.upload")}
          </span>
          <span className="text-xs text-white/35">{t("files.formats")}</span>
          <span className="text-[11px] text-white/30">{t("gallery.drop")}</span>
        </button>
        {error ? <p className="mb-3 text-center text-xs text-red-400">{error}</p> : null}

        {!files.length ? (
          <p className="py-6 text-center text-sm text-white/35">{t("files.empty")}</p>
        ) : null}

        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 rounded-2xl bg-[#1a1a1a] p-2">
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
                  <span className="block text-[11px] text-white/35">
                    {file.status} · {(file.size / 1024).toFixed(1)} KB
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center text-white/35 hover:text-red-400"
                onClick={() => void onDelete(file.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        {selected ? (
          <div className="mt-5 rounded-2xl bg-[#1a1a1a] p-4">
            <h2 className="mb-2 text-[15px] font-semibold">{selected.name}</h2>
            <p className="mb-3 text-[11px] text-white/35">
              {selected.mimeType} · {selected.status}
            </p>
            <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-white/60">
              {selected.extractedText || t("files.noText")}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
