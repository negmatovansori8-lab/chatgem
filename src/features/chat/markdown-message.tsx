"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";
import "highlight.js/styles/github-dark.min.css";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function MarkdownMessage({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose-chat space-y-3 text-[15px] leading-7 text-[var(--fg)]",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-[var(--accent-2)] underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ className: cls, children, ...props }) => {
            const isBlock = Boolean(cls?.includes("language-") || cls?.includes("hljs"));
            if (!isBlock) {
              return (
                <code
                  className="rounded bg-[var(--surface-3)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[0.85em]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={cn("font-[family-name:var(--font-mono)] text-xs", cls)} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => {
            const child = children as React.ReactElement<{ children?: React.ReactNode; className?: string }>;
            const codeText =
              typeof child?.props?.children === "string"
                ? child.props.children
                : Array.isArray(child?.props?.children)
                  ? child.props.children.join("")
                  : String(child?.props?.children ?? "");
            const lang =
              /language-([\w-]+)/.exec(child?.props?.className || "")?.[1] || "code";
            return (
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-center justify-between bg-[var(--surface-2)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
                  <span>{lang}</span>
                  <CopyBtn text={codeText} />
                </div>
                <pre className="overflow-x-auto p-3 text-[var(--fg-muted)]">{children}</pre>
              </div>
            );
          },
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 ps-5 text-[var(--fg)]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 ps-5 text-[var(--fg)]">{children}</ol>
          ),
          h1: ({ children }) => (
            <h3 className="text-lg font-semibold text-[var(--fg)]">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="text-base font-semibold text-[var(--fg)]">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-[15px] font-semibold text-[var(--fg)]">{children}</h4>
          ),
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-left text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[var(--border)] px-3 py-2">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-s-2 border-[var(--accent)] ps-3 text-[var(--fg-muted)]">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1" aria-label="AI is typing">
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--fg-subtle)] [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--fg-subtle)] [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--fg-subtle)] [animation-delay:300ms]" />
    </div>
  );
}
