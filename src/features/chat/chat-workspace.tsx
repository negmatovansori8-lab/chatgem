"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Copy,
  Globe,
  ImageIcon,
  Mic,
  Pencil,
  Plus,
  RefreshCw,
  SpellCheck,
  Square,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { MarkdownMessage, TypingIndicator } from "@/features/chat/markdown-message";
import { AppMenuButton } from "@/components/layout/app-shell";
import { UserMenu } from "@/features/profile/profile-workspace";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  streamChatMessage,
  useModels,
  type MessageRecord,
} from "@/features/chat/use-chat-api";
import { getPlugin } from "@/features/tools/plugins-catalog";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";
import {
  extractImagePrompt,
  wantsImageGeneration,
} from "@/lib/image-prompt";

type Bubble = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  previewUrls?: string[];
  /** Generated image (data URL or https) — rendered outside markdown. */
  imageUrl?: string;
};

type LocalAttachment = {
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  previewUrl?: string;
};

async function fileToAttachment(file: File): Promise<LocalAttachment> {
  const base: LocalAttachment = {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };

  if (file.type.startsWith("image/")) {
    try {
      const dataUrl = await compressImageToDataUrl(file);
      return { ...base, dataUrl, previewUrl: dataUrl };
    } catch {
      const dataUrl = await readFileAsDataUrl(file);
      return { ...base, dataUrl, previewUrl: dataUrl };
    }
  }

  if (file.type.startsWith("video/")) {
    return { ...base, previewUrl: URL.createObjectURL(file) };
  }

  return base;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function compressImageToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1536;
      let { width, height } = img;
      const scale = Math.min(1, max / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load"));
    };
    img.src = url;
  });
}

function dedupeBubbles(list: Bubble[]) {
  const seen = new Set<string>();
  const out: Bubble[] = [];
  for (const item of list) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function ChatWorkspace({ chatId }: { chatId?: string }) {
  const { locale, t } = useI18n();
  const searchParams = useSearchParams();
  const pluginFromUrl = searchParams.get("plugin") || undefined;
  const [pluginId, setPluginId] = useState<string | undefined>(pluginFromUrl);
  const plugin = pluginId ? getPlugin(pluginId) : null;
  const { models, configuredCount } = useModels();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [title, setTitle] = useState("ChatGem");
  const [modelId, setModelId] = useState<string>("");
  const [activeChatId, setActiveChatId] = useState<string | undefined>(chatId);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamChatIdRef = useRef<string | undefined>(chatId);
  const pluginIdRef = useRef<string | undefined>(pluginFromUrl);
  const agentInstructionsRef = useRef<string | undefined>(undefined);
  const [agentMode, setAgentMode] = useState(false);

  useEffect(() => {
    let id = pluginFromUrl;
    if (!id && typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem("nj_active_plugin");
        if (raw) {
          const parsed = JSON.parse(raw) as { id?: string };
          if (parsed?.id) id = parsed.id;
        }
      } catch {
        // ignore
      }
    }
    setPluginId(id);
    pluginIdRef.current = id;
    const p = id ? getPlugin(id) : null;
    if (p) {
      setTitle(p.name);
      setInput("");
      setAgentMode(false);
      agentInstructionsRef.current = undefined;
      return;
    }

    try {
      const agentPrompt = sessionStorage.getItem("nj_agent_prompt");
      if (agentPrompt?.trim()) {
        agentInstructionsRef.current = agentPrompt.trim();
        setAgentMode(true);
        setTitle(t("agents.title"));
        setInput("");
        return;
      }
    } catch {
      // ignore
    }

    try {
      const draft = sessionStorage.getItem("nj_draft_prompt");
      if (draft?.trim()) {
        sessionStorage.removeItem("nj_draft_prompt");
        setInput(draft);
        setAgentMode(false);
        agentInstructionsRef.current = undefined;
      }
    } catch {
      // ignore
    }
  }, [pluginFromUrl, t]);

  const configuredModels = useMemo(
    () => models.filter((m) => m.configured),
    [models],
  );

  useEffect(() => {
    setActiveChatId(chatId);
    streamChatIdRef.current = chatId;
    if (!chatId) {
      setMessages([]);
      setTitle("ChatGem");
      return;
    }
    let cancelled = false;
    void fetch(`/api/chats/${chatId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.chat) return;
        // Don't clobber an in-flight stream with a stale fetch.
        if (sendingRef.current && streamChatIdRef.current === chatId) return;
        setTitle(data.chat.title);
        if (data.chat.modelId) setModelId(data.chat.modelId);
        setMessages(
          dedupeBubbles(
            (data.messages as MessageRecord[]).map((m) => ({
              id: m.id,
              role: m.role === "USER" ? "user" : "assistant",
              content: m.content,
            })),
          ),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const selectedModelId = modelId;
  const modelForRequest = modelId || undefined;

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    sendingRef.current = false;
    setBusy(false);
  }

  async function sendPrompt(prompt: string, opts?: { regenerate?: boolean }) {
    const text = prompt.trim();
    const pendingAttachments = attachments;
    if ((!text && !pendingAttachments.length) || sendingRef.current) return;
    sendingRef.current = true;
    setBusy(true);
    setInput("");
    setAttachments([]);

    const displayText =
      text ||
      (pendingAttachments.some((a) => a.mimeType.startsWith("image/"))
        ? t("chat.mediaImageAsk")
        : pendingAttachments.some((a) => a.mimeType.startsWith("video/"))
          ? t("chat.mediaVideoAsk")
          : t("chat.mediaFileAsk"));
    const previewUrls = pendingAttachments
      .map((a) => a.previewUrl || a.dataUrl)
      .filter(Boolean) as string[];

    if (opts?.regenerate) {
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i]?.role === "assistant") {
            next.splice(i, 1);
            break;
          }
        }
        return next;
      });
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: displayText,
          previewUrls: previewUrls.length ? previewUrls : undefined,
        },
      ]);
    }

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", pending: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    let liveChatId = activeChatId ?? chatId;

    // Image generation in chat (DALL·E / Pollinations via /api/images).
    if (wantsImageGeneration(text) && !pendingAttachments.length) {
      try {
        const imagePrompt = extractImagePrompt(text);
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: imagePrompt }),
          signal: controller.signal,
        });
        const data = (await res.json()) as {
          url?: string;
          message?: string;
          error?: { message?: string };
        };
        if (!res.ok || typeof data.url !== "string") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    pending: false,
                    content:
                      data.error?.message ??
                      data.message ??
                      "Тасвир сохта нашуд. Gallery-ро ҳам санҷед: /app/gallery",
                  }
                : m,
            ),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    pending: false,
                    imageUrl: data.url,
                    content: data.message ?? "Тасвир омода.",
                  }
                : m,
            ),
          );
        }
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    pending: false,
                    content: "Хатои тасвирсозӣ. Бори дигар кӯшиш кунед.",
                  }
                : m,
            ),
          );
        }
      } finally {
        sendingRef.current = false;
        setBusy(false);
        abortRef.current = null;
      }
      return;
    }

    try {
      await streamChatMessage({
        chatId: liveChatId,
        content: text || displayText,
        modelId: modelForRequest,
        locale,
        pluginId: pluginIdRef.current,
        agentInstructions: agentInstructionsRef.current,
        attachments: pendingAttachments.length
          ? pendingAttachments.map(({ name, mimeType, size, dataUrl }) => ({
              name,
              mimeType,
              size,
              dataUrl,
            }))
          : undefined,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "meta" && typeof event.chatId === "string") {
            liveChatId = event.chatId;
            streamChatIdRef.current = event.chatId;
            setActiveChatId(event.chatId);
            // Update URL without remounting this component (avoids duplicate bubbles).
            if (typeof window !== "undefined") {
              const next = `/app/chat/${event.chatId}`;
              if (window.location.pathname !== next) {
                window.history.replaceState(null, "", next);
              }
              window.dispatchEvent(new Event("nj:chats-changed"));
            }
            if (typeof event.modelId === "string" && event.modelId) {
              setModelId(event.modelId);
            }
          }

          if (event.type === "token" && typeof event.content === "string") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + event.content, pending: true }
                  : m,
              ),
            );
          }

          if (event.type === "replace" && typeof event.content === "string") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: event.content as string, pending: true }
                  : m,
              ),
            );
          }

          if (event.type === "error") {
            const message =
              typeof event.message === "string"
                ? event.message
                : t("chat.requestFailed");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: message, pending: false } : m,
              ),
            );
          }

          if (event.type === "done") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      pending: false,
                      content:
                        m.content.trim() ||
                        "Ҷавоб наомад. Regenerate-ро пахш кунед.",
                    }
                  : m,
              ),
            );
            setAttachments([]);
            if (liveChatId) {
              void fetch(`/api/chats/${liveChatId}`)
                .then((r) => r.json())
                .then((data) => {
                  if (data.chat?.title) setTitle(data.chat.title);
                  // Sync from server so a remount/race can't leave a blank reply.
                  if (Array.isArray(data.messages) && data.messages.length) {
                    setMessages(
                      dedupeBubbles(
                        (data.messages as MessageRecord[]).map((m) => ({
                          id: m.id,
                          role: m.role === "USER" ? "user" : "assistant",
                          content: m.content,
                        })),
                      ),
                    );
                  }
                });
            }
          }
        },
      });
    } finally {
      abortRef.current = null;
      sendingRef.current = false;
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await sendPrompt(input);
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const empty = messages.length === 0;
  const showTitle = title && title !== "ChatGem" && title !== lastUser?.content;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-1.5 border-b border-[var(--border)] px-2 pb-1 pe-2 pt-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <AppMenuButton className="shrink-0" />
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:justify-center">
          <LanguageSwitcher compact />
          <ThemeToggle />
          <Link
            href="/app/billing"
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--accent-fg)] shadow-[0_0_20px_var(--accent-glow)] sm:gap-1.5 sm:px-3.5 sm:text-[13px]"
          >
            <span className="text-sm leading-none">✦</span>
            <span className="max-sm:hidden">{t("chat.upgradePro")}</span>
            <span className="sm:hidden">Pro</span>
          </Link>
        </div>
        <UserMenu compact />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:px-4">
        {empty ? (
          <div className="flex min-h-full flex-col items-center justify-end gap-6 pb-4">
            {plugin ? (
              <div className="mb-auto mt-10 flex w-full max-w-md flex-col items-center gap-3 px-2 text-center">
                <div
                  className="grid h-14 w-14 place-items-center rounded-2xl text-lg font-bold text-white"
                  style={{ background: plugin.color }}
                >
                  {plugin.letter}
                </div>
                <p className="text-lg font-semibold text-[var(--fg)]">{plugin.name}</p>
                <p className="text-sm text-[var(--fg-muted)]">{plugin.description}</p>
                <p className="text-xs text-[var(--fg-subtle)]">
                  {t("plugins.skillReady")}
                </p>
              </div>
            ) : agentMode ? (
              <div className="mb-auto mt-10 flex w-full max-w-md flex-col items-center gap-3 px-2 text-center">
                <p className="text-lg font-semibold text-[var(--fg)]">{t("agents.title")}</p>
                <p className="text-sm text-[var(--fg-muted)]">{t("agents.openChat")}</p>
                <p className="text-xs text-[var(--fg-subtle)]">{t("plugins.skillReady")}</p>
              </div>
            ) : (
              <div className="flex w-full max-w-md flex-col gap-5">
                <button
                  type="button"
                  className="flex items-center gap-3 text-left text-[15px] text-[var(--fg-muted)] transition hover:text-[var(--fg)]"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImageIcon className="h-5 w-5 shrink-0 opacity-80" strokeWidth={1.75} />
                  {t("chat.mediaHelper")}
                </button>
                <button
                  type="button"
                  className="flex items-center gap-3 text-left text-[15px] text-[var(--fg-muted)] transition hover:text-[var(--fg)]"
                  onClick={() => {
                    setInput(t("chat.createImagePrompt"));
                    window.setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                >
                  <ImageIcon className="h-5 w-5 shrink-0 opacity-80" strokeWidth={1.75} />
                  {t("chat.createImage")}
                </button>
                <button
                  type="button"
                  className="flex items-center gap-3 text-left text-[15px] text-[var(--fg-muted)] transition hover:text-[var(--fg)]"
                  onClick={() => {
                    setInput(t("chat.fixWritingPrompt"));
                    window.setTimeout(() => {
                      const el = inputRef.current;
                      if (!el) return;
                      el.focus();
                      const len = el.value.length;
                      el.setSelectionRange(len, len);
                    }, 0);
                  }}
                >
                  <SpellCheck className="h-5 w-5 shrink-0 opacity-80" strokeWidth={1.75} />
                  {t("chat.fixWriting")}
                </button>
                <button
                  type="button"
                  className="flex items-center gap-3 text-left text-[15px] text-[var(--fg-muted)] transition hover:text-[var(--fg)]"
                  onClick={() => {
                    setInput(t("chat.writeEditPrompt"));
                    window.setTimeout(() => {
                      const el = inputRef.current;
                      if (!el) return;
                      el.focus();
                      const len = el.value.length;
                      el.setSelectionRange(len, len);
                    }, 0);
                  }}
                >
                  <Pencil className="h-5 w-5 shrink-0 opacity-80" strokeWidth={1.75} />
                  {t("chat.writeEdit")}
                </button>
                <Link
                  href="/app/search"
                  className="flex items-center gap-3 text-[15px] text-[var(--fg-muted)] transition hover:text-[var(--fg)]"
                >
                  <Globe className="h-5 w-5 shrink-0 opacity-80" strokeWidth={1.75} />
                  {t("chat.searchWeb")}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6 pb-8">
            {showTitle ? (
              <p className="text-center text-xs text-[var(--fg-subtle)]">{title}</p>
            ) : null}
            {messages.map((message, index) => {
              const isLastAssistant =
                message.role === "assistant" && index === messages.length - 1;
              return (
                <div
                  key={message.id}
                  className={cn(
                    "group max-w-[92%] text-[15px] leading-7",
                    message.role === "user"
                      ? "ml-auto rounded-[1.5rem] bg-[var(--surface-3)] px-4 py-3 text-[var(--fg)]"
                      : "text-[var(--fg)]",
                  )}
                >
                  {message.role === "assistant" ? (
                    <>
                      {message.pending && !message.content.trim() && !message.imageUrl ? (
                        <TypingIndicator />
                      ) : (
                        <div className="space-y-3">
                          {message.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={message.imageUrl}
                              alt=""
                              className="max-h-[min(70vh,560px)] w-full rounded-2xl border border-[var(--border)] object-contain bg-[var(--surface)]"
                            />
                          ) : null}
                          {message.content.trim() ? (
                            <MarkdownMessage content={message.content} />
                          ) : null}
                        </div>
                      )}
                      {!message.pending && (message.content.trim() || message.imageUrl) ? (
                        <div className="mt-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
                            onClick={() =>
                              void navigator.clipboard.writeText(message.content)
                            }
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {t("chat.copy")}
                          </button>
                          {isLastAssistant && lastUser && !busy ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
                              onClick={() =>
                                void sendPrompt(lastUser.content, {
                                  regenerate: true,
                                })
                              }
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              {t("chat.regenerate")}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="space-y-2">
                      {message.previewUrls?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {message.previewUrls.map((url) =>
                            url.startsWith("blob:") ||
                            url.startsWith("data:video") ? (
                              <video
                                key={url}
                                src={url}
                                className="max-h-40 max-w-[220px] rounded-xl object-cover"
                                muted
                                playsInline
                                controls
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={url}
                                src={url}
                                alt=""
                                className="max-h-40 max-w-[220px] rounded-xl object-cover"
                              />
                            ),
                          )}
                        </div>
                      ) : null}
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="relative z-20 shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-3 pt-2 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))]"
      >
        {attachments.length ? (
          <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
            {attachments.map((file) => (
              <div
                key={`${file.name}-${file.size}`}
                className="relative overflow-hidden rounded-xl bg-[var(--surface-3)]"
              >
                {file.previewUrl && file.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.previewUrl}
                    alt={file.name}
                    className="h-16 w-16 object-cover"
                  />
                ) : file.previewUrl && file.mimeType.startsWith("video/") ? (
                  <video
                    src={file.previewUrl}
                    className="h-16 w-16 object-cover"
                    muted
                  />
                ) : (
                  <span className="block max-w-[140px] truncate px-2 py-3 text-[11px] text-[var(--fg-muted)]">
                    {file.name}
                  </span>
                )}
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--bg)]/80 text-[10px] text-[var(--fg)]"
                  aria-label="Remove"
                  onClick={() =>
                    setAttachments((prev) =>
                      prev.filter(
                        (a) => !(a.name === file.name && a.size === file.size),
                      ),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mx-auto flex max-w-3xl items-end gap-1 rounded-[1.75rem] border border-[var(--border)] bg-[var(--composer)] px-1.5 py-1.5 shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,video/*,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov"
            onChange={(e) => {
              const files = e.target.files;
              if (!files?.length) return;
              void (async () => {
                const next = await Promise.all(
                  Array.from(files).slice(0, 5).map(fileToAttachment),
                );
                setAttachments(next);
                if (fileRef.current) fileRef.current.value = "";
              })();
            }}
          />
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--fg)] hover:bg-[var(--surface-3)]"
            aria-label="Attach"
            onClick={() => fileRef.current?.click()}
          >
            <Plus className="h-5 w-5" />
          </button>
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("chat.placeholder")}
            rows={1}
            disabled={busy}
            className="max-h-32 min-h-[44px] flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-base text-[var(--fg)] shadow-none placeholder:text-[var(--fg-subtle)] focus-visible:ring-0 md:text-[15px]"
            aria-label="Message"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy) void sendPrompt(input);
              }
            }}
          />
          {!input.trim() && !attachments.length && !busy ? (
            <>
              <button
                type="button"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--fg-subtle)]"
                aria-label="Voice"
                disabled
              >
                <Mic className="h-5 w-5" />
              </button>
              <Link
                href="/app/voice"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)]"
                aria-label="Voice mode"
              >
                <span className="flex h-3.5 items-end gap-0.5">
                  <span className="h-2 w-0.5 rounded-full bg-white" />
                  <span className="h-3.5 w-0.5 rounded-full bg-white" />
                  <span className="h-2.5 w-0.5 rounded-full bg-white" />
                  <span className="h-3 w-0.5 rounded-full bg-white" />
                </span>
              </Link>
            </>
          ) : busy ? (
            <button
              type="button"
              onClick={stopGeneration}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--pill)] text-[var(--pill-fg)]"
              aria-label="Stop"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() && !attachments.length}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--pill)] text-[var(--pill-fg)] disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="mx-auto mt-1 max-w-3xl px-2 pb-0.5">
          <select
            value={selectedModelId}
            onChange={(e) => setModelId(e.target.value)}
            className="mx-auto block max-w-[12rem] truncate bg-transparent text-center text-[10px] text-[var(--fg-subtle)] outline-none"
            aria-label="Model"
          >
            <option value="">Auto</option>
            {models.map((model) => (
              <option key={model.id} value={model.id} disabled={!model.configured}>
                {model.name}
                {!model.configured ? " (off)" : ""}
              </option>
            ))}
          </select>
        </div>
      </form>
    </div>
  );
}
