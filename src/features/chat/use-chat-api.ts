"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatRecord, MessageRecord } from "@/types/chat";

export type ChatModelOption = {
  id: string;
  name: string;
  kind: string;
  providerName: string;
  configured: boolean;
};

export function useChatList(query = "") {
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const res = await fetch(`/api/chats?${params.toString()}`);
    const data = await res.json();
    setChats(data.chats ?? []);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const res = await fetch(`/api/chats?${params.toString()}`);
      const data = await res.json();
      if (cancelled) return;
      setChats(data.chats ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [query]);

  return { chats, loading, refresh, setChats };
}

export function useModels() {
  const [models, setModels] = useState<ChatModelOption[]>([]);
  const [configuredCount, setConfiguredCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setModels(data.models ?? []);
        setConfiguredCount(data.configuredCount ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { models, configuredCount };
}

export async function streamChatMessage(input: {
  chatId?: string;
  content: string;
  modelId?: string;
  locale?: string;
  pluginId?: string;
  agentInstructions?: string;
  attachments?: Array<{
    name: string;
    mimeType: string;
    size: number;
    dataUrl?: string;
  }>;
  signal?: AbortSignal;
  onEvent: (event: Record<string, unknown>) => void;
}) {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: input.chatId,
        content: input.content,
        ...(input.modelId ? { modelId: input.modelId } : {}),
        ...(input.locale ? { locale: input.locale } : {}),
        ...(input.pluginId ? { pluginId: input.pluginId } : {}),
        ...(input.agentInstructions
          ? { agentInstructions: input.agentInstructions }
          : {}),
        attachments: input.attachments,
      }),
      signal: input.signal,
    });
  } catch (error) {
    if (input.signal?.aborted) {
      input.onEvent({ type: "error", code: "ABORTED", message: "Stopped." });
      return;
    }
    input.onEvent({
      type: "error",
      code: "NETWORK",
      message:
        error instanceof Error ? error.message : "Network error — could not reach the server.",
    });
    return;
  }

  if (!res.body) {
    input.onEvent({
      type: "error",
      code: "NO_STREAM",
      message: "Streaming response body missing",
    });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawContent = false;
  let sawError = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      try {
        const json = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
        // `replace` is a full reply (rewrite path) — must count as content
        if (json.type === "token" || json.type === "replace" || json.type === "image")
          sawContent = true;
        if (json.type === "error") sawError = true;
        input.onEvent(json);
      } catch {
        // ignore
      }
    }
  }

  // Flush trailing SSE frame if the stream ended without a final blank line
  if (buffer.trim().startsWith("data:")) {
    try {
      const json = JSON.parse(buffer.trim().slice(5).trim()) as Record<
        string,
        unknown
      >;
      if (json.type === "token" || json.type === "replace" || json.type === "image")
        sawContent = true;
      if (json.type === "error") sawError = true;
      input.onEvent(json);
    } catch {
      // ignore
    }
  }

  if (!sawContent && !sawError) {
    input.onEvent({
      type: "error",
      code: "EMPTY_REPLY",
      message: "Ҷавоб наомад. Бори дигар кӯшиш кунед / No reply — try again.",
    });
  }
}

export type { MessageRecord };
