"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Bot, MessageSquare, Play, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppBackButton } from "@/components/layout/app-back-button";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { AgentRecord, AgentRunRecord } from "@/types/agents";

export function AgentsWorkspace() {
  const { t } = useI18n();
  const router = useRouter();
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selected, setSelected] = useState<AgentRecord | null>(null);
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [runInput, setRunInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const res = await fetch("/api/agents");
    const data = await res.json();
    setAgents(data.agents ?? []);
    setLoading(false);
  }

  async function openAgent(id: string) {
    setBusy(true);
    const res = await fetch(`/api/agents/${id}`);
    const data = await res.json();
    setSelected(data.agent ?? null);
    setRuns(data.runs ?? []);
    setCreating(false);
    setBusy(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !instructions.trim()) return;
    setBusy(true);
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        instructions,
        tools: ["calculator", "web-search"],
      }),
    });
    const data = await res.json();
    setName("");
    setInstructions("");
    setCreating(false);
    await refresh();
    if (data.agent) void openAgent(data.agent.id);
    setBusy(false);
  }

  async function onRun(event: FormEvent) {
    event.preventDefault();
    if (!selected || !runInput.trim()) return;
    setBusy(true);
    await fetch(`/api/agents/${selected.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: runInput }),
    });
    setRunInput("");
    await openAgent(selected.id);
    setBusy(false);
  }

  async function onDelete(id: string) {
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    if (selected?.id === id) {
      setSelected(null);
      setRuns([]);
    }
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
              setRuns([]);
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
            ? t("agents.create")
            : selected
              ? selected.name
              : t("agents.title")}
        </h1>
        {!selected && !creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="grid h-10 w-10 place-items-center rounded-full bg-[#2a2a2a]"
            aria-label={t("agents.create")}
          >
            <Plus className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {creating ? (
          <form onSubmit={onCreate} className="mx-auto max-w-md space-y-3 pt-2">
            <p className="text-sm text-white/45">{t("agents.subtitle")}</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("agents.name")}
              className="w-full rounded-2xl bg-[#1a1a1a] px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35"
              required
            />
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t("agents.instructions")}
              rows={5}
              className="w-full resize-none rounded-2xl bg-[#1a1a1a] px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-[#3b82f6] py-3.5 text-[15px] font-semibold disabled:opacity-50"
            >
              {t("agents.create")}
            </button>
          </form>
        ) : selected ? (
          <div className="mx-auto max-w-md space-y-4 pt-2">
            <p className="whitespace-pre-wrap rounded-2xl bg-[#1a1a1a] px-4 py-3 text-sm text-white/70">
              {selected.instructions}
            </p>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem(
                  "nj_agent_prompt",
                  selected.instructions,
                );
                router.push("/app/chat");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-medium"
            >
              <MessageSquare className="h-4 w-4" />
              {t("agents.openChat")}
            </button>

            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-white/45">{t("agents.runs")}</p>
              {!runs.length ? (
                <p className="text-sm text-white/35">{t("agents.noRuns")}</p>
              ) : (
                runs.map((run) => (
                  <article
                    key={run.id}
                    className="rounded-2xl bg-[#1a1a1a] px-4 py-3"
                  >
                    <p className="text-[11px] uppercase tracking-wide text-white/35">
                      {run.status}
                    </p>
                    <p className="mt-1 text-sm text-white/90">{run.input}</p>
                    {run.output ? (
                      <p className="mt-2 text-sm text-white/55">{run.output}</p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-md space-y-3 pt-2">
            <p className="text-center text-sm text-white/45">{t("agents.subtitle")}</p>
            {loading ? (
              <p className="py-8 text-center text-sm text-white/35">{t("common.loading")}</p>
            ) : null}
            {!loading && !agents.length ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#1a1a1a]">
                  <Bot className="h-7 w-7 text-white/50" />
                </div>
                <p className="text-sm text-white/45">{t("agents.empty")}</p>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="rounded-full bg-[#3b82f6] px-5 py-2.5 text-sm font-semibold"
                >
                  {t("agents.create")}
                </button>
              </div>
            ) : null}
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-2 rounded-2xl bg-[#1a1a1a] p-2"
              >
                <button
                  type="button"
                  onClick={() => void openAgent(agent.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#3b82f6]/20 text-[#60a5fa]">
                    <Bot className="h-5 w-5" />
                  </div>
                  <span className="truncate text-[15px] font-medium">{agent.name}</span>
                </button>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center text-white/35 hover:text-red-400"
                  onClick={() => void onDelete(agent.id)}
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <form
          onSubmit={onRun}
          className="shrink-0 border-t border-white/5 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-end gap-1 rounded-[1.75rem] border border-white/10 bg-[#212121] px-1.5 py-1.5">
            <textarea
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              placeholder={t("agents.runInput")}
              rows={1}
              className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-base text-white outline-none placeholder:text-white/40"
            />
            <button
              type="submit"
              disabled={busy || !runInput.trim()}
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-full",
                busy || !runInput.trim()
                  ? "bg-white/15 text-white/40"
                  : "bg-white text-black",
              )}
              aria-label={t("agents.run")}
            >
              <Play className="h-5 w-5" fill="currentColor" />
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
