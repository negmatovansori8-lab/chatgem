"use client";

import { useState } from "react";
import { Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/i18n/locale-provider";
import { streamChatMessage } from "@/features/chat/use-chat-api";

const actions = [
  "Generate code",
  "Explain code",
  "Debug",
  "Refactor",
  "Optimize",
  "Code review",
  "Convert code",
] as const;

export function CodeWorkspace() {
  const { locale } = useI18n();
  const [code, setCode] = useState(`function hello(name) {\n  return "Hello " + name\n}`);
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(
    "Sandbox execution is architected but disabled until a secure sandbox provider is configured.",
  );

  async function runAction(action: (typeof actions)[number]) {
    setBusy(true);
    setOutput("");
    let text = "";
    await streamChatMessage({
      content: `${action} for this code:\n\n\`\`\`\n${code}\n\`\`\``,
      locale,
      onEvent: (event) => {
        if (event.type === "token" && typeof event.content === "string") {
          text += event.content;
          setOutput(text);
        }
        if (event.type === "error" || event.type === "status") {
          setNotice(typeof event.message === "string" ? event.message : "Provider not configured");
          setOutput(typeof event.message === "string" ? event.message : "");
        }
      },
    });
    setBusy(false);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 lg:grid-cols-[220px_1fr_1fr] sm:px-6">
      <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Code2 className="h-4 w-4 text-[var(--accent)]" />
          ChatGem Code
        </p>
        <p className="mb-3 text-xs text-[var(--fg-subtle)]">File tree (demo)</p>
        <ul className="space-y-1 text-sm text-[var(--fg-muted)]">
          <li>src/app</li>
          <li>src/features</li>
          <li>src/lib</li>
        </ul>
        <div className="mt-4 space-y-2">
          {actions.map((action) => (
            <Button
              key={action}
              type="button"
              size="sm"
              variant="secondary"
              className="w-full justify-start"
              disabled={busy}
              onClick={() => void runAction(action)}
            >
              {action}
            </Button>
          ))}
        </div>
      </aside>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
          Editor
        </p>
        <Textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="min-h-[420px] font-[family-name:var(--font-mono)] text-xs"
        />
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
          AI output
        </p>
        <pre className="min-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--bg)] p-3 text-xs text-[var(--fg-muted)]">
          {output || notice}
        </pre>
      </div>
    </div>
  );
}
