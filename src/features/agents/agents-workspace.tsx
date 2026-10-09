"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Bot, MessageSquare, Play, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { useI18n } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { HttpError, jsonInit, requestJson } from "@/lib/http";
import { cn } from "@/lib/utils";
import type { AgentRecord, AgentRunRecord } from "@/types/agents";

export function AgentsWorkspace() {
  const { t } = useI18n();
  const toast = useToast();
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
  const [loadError, setLoadError] = useState(false);

  const fail = useCallback(
    (e: unknown) => toast.error(e instanceof HttpError && e.offline ? t("common.offline") : t("common.requestFailed")),
    [t, toast],
  );

  const refresh = useCallback(
    () =>
      requestJson<{ agents?: AgentRecord[] }>("/api/agents")
        .then((data) => {
          setAgents(data.agents ?? []);
          setLoadError(false);
        })
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function openAgent(id: string) {
    setBusy(true);
    try {
      const data = await requestJson<{ agent?: AgentRecord; runs?: AgentRunRecord[] }>(`/api/agents/${id}`);
      setSelected(data.agent ?? null);
      setRuns(data.runs ?? []);
      setCreating(false);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !instructions.trim() || busy) return;
    setBusy(true);
    try {
      const data = await requestJson<{ agent?: AgentRecord }>(
        "/api/agents",
        jsonInit("POST", { name: name.trim(), instructions: instructions.trim(), tools: ["calculator", "web-search"] }),
      );
      setName("");
      setInstructions("");
      setCreating(false);
      await refresh();
      if (data.agent) void openAgent(data.agent.id);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function onRun(event: FormEvent) {
    event.preventDefault();
    if (!selected || !runInput.trim() || busy) return;
    setBusy(true);
    try {
      await requestJson(`/api/agents/${selected.id}`, jsonInit("POST", { input: runInput.trim() }));
      setRunInput("");
      await openAgent(selected.id);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await requestJson(`/api/agents/${id}`, jsonInit("DELETE"));
      if (selected?.id === id) {
        setSelected(null);
        setRuns([]);
      }
      await refresh();
    } catch (e) {
      fail(e);
    }
  }

  const inDetail = Boolean(selected || creating);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col bg-[var(--bg)] text-[var(--fg)] md:max-w-xl">
      <WorkspaceHeader
        title={creating ? t("agents.create") : selected ? selected.name : t("agents.title")}
        onBack={
          inDetail
            ? () => {
                setSelected(null);
                setCreating(false);
                setRuns([]);
              }
            : undefined
        }
        action={
          !inDetail ? (
            <Button variant="ghost" size="icon" aria-label={t("agents.create")} onClick={() => setCreating(true)}>
              <Plus className="h-5 w-5" />
            </Button>
          ) : null
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
        {creating ? (
          <form onSubmit={onCreate} className="space-y-3">
            <p className="text-sm text-[var(--fg-muted)]">{t("agents.subtitle")}</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("agents.name")} required />
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t("agents.instructions")}
              rows={5}
              className="resize-none"
              required
            />
            <Button type="submit" size="lg" className="w-full" disabled={busy || !name.trim() || !instructions.trim()}>
              {t("agents.create")}
            </Button>
          </form>
        ) : selected ? (
          <div className="space-y-4">
            <p className="whitespace-pre-wrap break-words rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--fg-muted)]">
              {selected.instructions}
            </p>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => {
                sessionStorage.setItem("nj_agent_prompt", selected.instructions);
                router.push("/app/chat");
              }}
            >
              <MessageSquare className="h-4 w-4" />
              {t("agents.openChat")}
            </Button>

            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-[var(--fg-subtle)]">{t("agents.runs")}</p>
              {!runs.length ? (
                <p className="text-sm text-[var(--fg-subtle)]">{t("agents.noRuns")}</p>
              ) : (
                runs.map((run) => (
                  <article
                    key={run.id}
                    className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <p className="text-[11px] uppercase tracking-wide text-[var(--fg-subtle)]">{run.status}</p>
                    <p className="mt-1 break-words text-sm text-[var(--fg)]">{run.input}</p>
                    {run.output ? (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--fg-muted)]">{run.output}</p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
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
        ) : !agents.length ? (
          <EmptyState
            icon={<Bot className="h-6 w-6" />}
            title={t("agents.empty")}
            description={t("agents.subtitle")}
            actions={<Button onClick={() => setCreating(true)}>{t("agents.create")}</Button>}
          />
        ) : (
          <div className="space-y-2">
            <p className="mb-3 text-center text-sm text-[var(--fg-muted)]">{t("agents.subtitle")}</p>
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-1.5"
              >
                <button
                  type="button"
                  onClick={() => void openAgent(agent.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-start transition hover:bg-[var(--surface-2)]"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent-2)]">
                    <Bot className="h-5 w-5" />
                  </div>
                  <span className="truncate text-[15px] font-medium">{agent.name}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.delete")}
                  className="hover:text-[var(--danger)]"
                  onClick={() => void onDelete(agent.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <form
          onSubmit={onRun}
          className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
        >
          <div className="flex items-end gap-1 rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1.5">
            <textarea
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              placeholder={t("agents.runInput")}
              rows={1}
              className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-base text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
            />
            <button
              type="submit"
              disabled={busy || !runInput.trim()}
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-full transition",
                busy || !runInput.trim()
                  ? "bg-[var(--surface-3)] text-[var(--fg-subtle)]"
                  : "bg-[var(--fg)] text-[var(--bg)]",
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
