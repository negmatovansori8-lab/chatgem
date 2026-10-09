"use client";

import { Children, isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { normalizeMath } from "@/lib/markdown-math";
import { cn } from "@/lib/utils";
import { DownloadButton } from "@/components/media/download-button";
import { mediaKindOf, mimeFromUrl } from "@/lib/downloads/filename";
import { isDownloadable } from "@/lib/downloads/policy";
import { pageOrigin } from "@/lib/downloads/client";
import { splitMediaBlocks } from "@/lib/media/chat-block";
import { MediaResults } from "@/features/media-search/media-results";
import "highlight.js/styles/github-dark.min.css";
import "katex/dist/katex.min.css";

function nodeText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isValidElement<{ children?: ReactNode }>(child)
          ? nodeText(child.props.children)
          : "",
    )
    .join("");
}

/** Direct link to an allowed video/audio file → inline player + Download (phrasing content only: it sits inside <p>). */
function MediaLink({ href, children }: { href: string; children: ReactNode }) {
  const mime = mimeFromUrl(href);
  const kind = mediaKindOf(mime);
  const label = nodeText(children).trim();
  const title = label && label !== href ? label : undefined;
  const [artist, song] = kind === "audio" && title?.includes(" - ") ? title.split(" - ", 2) : [undefined, title];
  return (
    <span className="my-2 block space-y-2">
      {kind === "video" ? (
        <video
          src={href}
          controls
          playsInline
          preload="metadata"
          className="block max-h-[min(70vh,520px)] w-full rounded-2xl border border-[var(--border)] bg-black"
        />
      ) : (
        <audio src={href} controls preload="metadata" className="block w-full" />
      )}
      <span className="flex flex-wrap items-center gap-2">
        {title ? <span className="min-w-0 truncate text-sm text-[var(--fg-muted)]">{title}</span> : null}
        <DownloadButton source={{ url: href }} meta={{ title: song, artist, mimeType: mime }} />
      </span>
    </span>
  );
}

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
  onMapLink,
  onPrompt,
}: {
  content: string;
  className?: string;
  /** In-app map links (`/app/maps?…`) open the chat's map instead of a new tab. */
  onMapLink?: (href: string) => void;
  /** Media search suggestions send a new chat message. */
  onPrompt?: (text: string) => void;
}) {
  const text =
    typeof content === "string"
      ? content
      : content == null
        ? ""
        : JSON.stringify(content);
  const segments = splitMediaBlocks(text);
  if (segments.length === 1 && segments[0]!.type === "markdown") {
    return <MarkdownBody text={text} className={className} onMapLink={onMapLink} />;
  }
  return (
    <div className="space-y-3">
      {segments.map((segment, i) =>
        segment.type === "media" ? (
          <MediaResults key={i} result={segment.result} onPrompt={onPrompt} />
        ) : (
          <MarkdownBody key={i} text={segment.text} className={className} onMapLink={onMapLink} />
        ),
      )}
    </div>
  );
}

function MarkdownBody({
  text,
  className,
  onMapLink,
}: {
  text: string;
  className?: string;
  onMapLink?: (href: string) => void;
}) {
  return (
    <div
      data-markdown
      className={cn(
        "prose-chat space-y-3 break-words text-[15px] leading-7 text-[var(--fg)]",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }], rehypeHighlight]}
        urlTransform={(url) => {
          const value = String(url || "");
          if (
            value.startsWith("data:image/") ||
            value.startsWith("blob:") ||
            value.startsWith("https:") ||
            value.startsWith("http:") ||
            value.startsWith("/")
          ) {
            return value;
          }
          return "";
        }}
        components={{
          a: ({ href, children }) =>
            href &&
            /^(?:video|audio)$/.test(mediaKindOf(mimeFromUrl(href))) &&
            isDownloadable(href, pageOrigin()) ? (
              <MediaLink href={href}>{children}</MediaLink>
            ) : onMapLink && href?.startsWith("/app/maps") ? (
              <a
                href={href}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onMapLink(href);
                }}
                className="font-medium text-[var(--accent-2)] underline underline-offset-2"
              >
                {children}
              </a>
            ) : (
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
          img: ({ src, alt }) =>
            typeof src === "string" && src ? (
              <span className="my-2 block space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt || ""}
                  className="block max-h-[min(70vh,520px)] w-full rounded-2xl border border-[var(--border)] object-contain bg-[var(--surface)]"
                />
                {isDownloadable(src, pageOrigin()) ? (
                  <DownloadButton source={{ url: src }} meta={{ title: alt || undefined }} />
                ) : null}
              </span>
            ) : null,
        }}
      >
        {normalizeMath(text)}
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
