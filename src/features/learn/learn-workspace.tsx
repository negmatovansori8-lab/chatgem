"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/i18n/locale-provider";
import { streamChatMessage } from "@/features/chat/use-chat-api";

const subjects = [
  "Mathematics",
  "English",
  "Programming",
  "Science",
  "History",
  "Languages",
  "General Knowledge",
] as const;

const levels = ["Beginner", "Intermediate", "Advanced"] as const;

export function LearnWorkspace() {
  const { locale } = useI18n();
  const [subject, setSubject] = useState<(typeof subjects)[number]>("Mathematics");
  const [level, setLevel] = useState<(typeof levels)[number]>("Beginner");
  const [question, setQuestion] = useState("Explain fractions with a simple example");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function askTutor() {
    setBusy(true);
    setAnswer("");
    let text = "";
    await streamChatMessage({
      content: `You are ChatGem Learn tutor. Subject: ${subject}. Level: ${level}. Question: ${question}`,
      locale,
      onEvent: (event) => {
        if (event.type === "token" && typeof event.content === "string") {
          text += event.content;
          setAnswer(text);
        }
        if (event.type === "error" || event.type === "status") {
          setAnswer(typeof event.message === "string" ? event.message : "Provider not configured");
        }
      },
    });
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          <GraduationCap className="h-3.5 w-3.5" />
          ChatGem Learn
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--fg)]">
          AI Tutor
        </h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Explanations, exercises, and quizzes — live with your AI key.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {subjects.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSubject(item)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              subject === item
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--fg-muted)]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {levels.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setLevel(item)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              level === item
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--fg-muted)]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} />
      <Button type="button" disabled={busy} onClick={() => void askTutor()}>
        Ask tutor
      </Button>
      <pre className="min-h-[200px] whitespace-pre-wrap rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--fg-muted)]">
        {answer || "Tutor response will appear here."}
      </pre>
    </div>
  );
}
