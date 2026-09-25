"use client";

import { useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppBackButton } from "@/components/layout/app-back-button";
import { useI18n } from "@/components/i18n/locale-provider";
import { useToast } from "@/components/ui/toast";
import { streamChatMessage } from "@/features/chat/use-chat-api";
import { MarkdownMessage } from "@/features/chat/markdown-message";
import { cn } from "@/lib/utils";

const SUBJECTS = [
  "Mathematics",
  "English",
  "Programming",
  "Science",
  "History",
  "Languages",
  "General",
] as const;

const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

export function LearnWorkspace() {
  const { locale, t } = useI18n();
  const toast = useToast();
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>("Mathematics");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("Beginner");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function askTutor() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setAnswer("");
    let text = "";
    try {
      await streamChatMessage({
        content: `You are ChatGem Learn — a patient tutor. Subject: ${subject}. Level: ${level}. Teach clearly with examples. Question: ${q}`,
        locale,
        onEvent: (event) => {
          if (event.type === "token" && typeof event.content === "string") {
            text += event.content;
            setAnswer(text);
          }
          if (event.type === "error") {
            const msg =
              typeof event.message === "string"
                ? event.message
                : t("chat.requestFailed");
            setAnswer(msg);
            toast.error(msg);
          }
        },
      });
    } catch {
      toast.error(t("chat.requestFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col bg-[var(--bg)] text-[var(--fg)]">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <AppBackButton className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-[16px] font-semibold">
            <GraduationCap className="h-4 w-4 text-[var(--accent)]" />
            {t("learn.title")}
          </h1>
          <p className="truncate text-xs text-[var(--fg-subtle)]">{t("learn.subtitle")}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSubject(item)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                subject === item
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {LEVELS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLevel(item)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                level === item
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("learn.questionPh")}
          rows={4}
        />
        <Button
          type="button"
          disabled={busy || !question.trim()}
          onClick={() => void askTutor()}
          className="w-full sm:w-auto"
        >
          {busy ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t("common.loading")}
            </>
          ) : (
            t("learn.ask")
          )}
        </Button>

        {answer ? (
          <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4">
            <MarkdownMessage content={answer} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
