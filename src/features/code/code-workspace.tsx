"use client";

import { useState } from "react";
import { Code2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppBackButton } from "@/components/layout/app-back-button";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/components/i18n/locale-provider";
import { useToast } from "@/components/ui/toast";
import { streamChatMessage } from "@/features/chat/use-chat-api";
import { MarkdownMessage } from "@/features/chat/markdown-message";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { id: "generate", labelKey: "code.generate" as const, prompt: "Generate clean working code for this request" },
  { id: "explain", labelKey: "code.explain" as const, prompt: "Explain this code clearly" },
  { id: "debug", labelKey: "code.debug" as const, prompt: "Find bugs and fix this code" },
  { id: "refactor", labelKey: "code.refactor" as const, prompt: "Refactor this code for clarity and quality" },
  { id: "review", labelKey: "code.review" as const, prompt: "Review this code and suggest improvements" },
] as const;

export function CodeWorkspace() {
  const { locale, t } = useI18n();
  const toast = useToast();
  const [code, setCode] = useState(
    `function hello(name) {\n  return "Hello " + name;\n}`,
  );
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  async function runAction(action: (typeof ACTIONS)[number]) {
    if (busy) return;
    setBusy(true);
    setActive(action.id);
    setOutput("");
    let text = "";
    try {
      await streamChatMessage({
        content: `${action.prompt}:\n\n\`\`\`\n${code}\n\`\`\``,
        locale,
        onEvent: (event) => {
          if (event.type === "token" && typeof event.content === "string") {
            text += event.content;
            setOutput(text);
          }
          if (event.type === "error") {
            const msg =
              typeof event.message === "string"
                ? event.message
                : t("chat.requestFailed");
            setOutput(msg);
            toast.error(msg);
          }
        },
      });
    } catch {
      toast.error(t("chat.requestFailed"));
    } finally {
      setBusy(false);
      setActive(null);
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col bg-[var(--bg)] text-[var(--fg)]">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
        <AppBackButton className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-semibold">{t("code.title")}</h1>
          <p className="truncate text-xs text-[var(--fg-subtle)]">{t("code.subtitle")}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr_1fr]">
          <aside className="space-y-2 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Code2 className="h-4 w-4 text-[var(--accent)]" />
              {t("code.actions")}
            </p>
            {ACTIONS.map((action) => (
              <Button
                key={action.id}
                type="button"
                size="sm"
                variant="secondary"
                className={cn(
                  "w-full justify-start",
                  active === action.id && "ring-1 ring-[var(--accent)]",
                )}
                disabled={busy}
                onClick={() => void runAction(action)}
              >
                {busy && active === action.id ? (
                  <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="me-1.5 h-3.5 w-3.5" />
                )}
                {t(action.labelKey)}
              </Button>
            ))}
          </aside>

          <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
              {t("code.editor")}
            </p>
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={16}
              className="min-h-[280px] font-[family-name:var(--font-mono)] text-[13px]"
              spellCheck={false}
            />
          </div>

          <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
              {t("code.result")}
            </p>
            {busy && !output ? (
              <div className="flex items-center gap-2 py-8 text-sm text-[var(--fg-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.loading")}
              </div>
            ) : output ? (
              <div className="max-h-[min(60vh,520px)] overflow-y-auto">
                <MarkdownMessage content={output} />
              </div>
            ) : (
              <EmptyState
                title={t("code.emptyTitle")}
                description={t("code.emptyBody")}
                className="py-8"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
