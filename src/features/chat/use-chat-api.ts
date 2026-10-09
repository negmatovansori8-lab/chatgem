"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatRecord, MessageRecord } from "@/types/chat";
import type { MapContext } from "@/lib/maps/context";
import { requestJson } from "@/lib/http";

export type ChatModelOption = {
  id: string;
  name: string;
  kind: string;
  providerName: string;
  configured: boolean;
};

const fetchOpts: RequestInit = { credentials: "include" };

function fetchChats(query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  return requestJson<{ chats?: ChatRecord[] }>(`/api/chats?${params.toString()}`, fetchOpts);
}

export function useChatList(query = "") {
  const [chats, setChats] = useState<ChatRecord[]>([]);
  // Offline / server errors keep the last list instead of throwing.
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      fetchChats(query)
        .then((data) => setChats(data.chats ?? []))
        .catch(() => {})
        .finally(() => setLoadedQuery(query)),
    [query],
  );

  useEffect(() => {
    let cancelled = false;
    fetchChats(query)
      .then((data) => {
        if (!cancelled) setChats(data.chats ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadedQuery(query);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return { chats, loading: loadedQuery !== query, refresh, setChats };
}

export function useModels() {
  const [models, setModels] = useState<ChatModelOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    requestJson<{ models?: ChatModelOption[] }>("/api/models", fetchOpts)
      .then((data) => {
        if (!cancelled) setModels(data.models ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return { models };
}

async function readSseStream(
  res: Response,
  onEvent: (event: Record<string, unknown>) => void,
) {
  if (!res.body) {
    onEvent({
      type: "error",
      code: "NO_STREAM",
      message: "Streaming response body missing",
    });
    return { sawContent: false, sawError: true, notFound: false };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawContent = false;
  let sawError = false;
  let notFound = false;

  const handle = (json: Record<string, unknown>) => {
    if (json.type === "token" || json.type === "replace" || json.type === "image") {
      sawContent = true;
    }
    if (json.type === "error") {
      sawError = true;
      if (json.code === "NOT_FOUND") notFound = true;
    }
    onEvent(json);
  };

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
        handle(JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
      } catch {
        // ignore
      }
    }
  }

  if (buffer.trim().startsWith("data:")) {
    try {
      handle(
        JSON.parse(buffer.trim().slice(5).trim()) as Record<string, unknown>,
      );
    } catch {
      // ignore
    }
  }

  return { sawContent, sawError, notFound };
}

export async function streamChatMessage(input: {
  chatId?: string;
  content: string;
  modelId?: string;
  locale?: string;
  pluginId?: string;
  agentInstructions?: string;
  forceImage?: boolean;
  regenerate?: boolean;
  editMessageId?: string;
  webSearch?: boolean;
  attachments?: Array<{
    name: string;
    mimeType: string;
    size: number;
    dataUrl?: string;
  }>;
  mapContext?: MapContext | null;
  tzOffsetMinutes?: number;
  /** Voice Mode turn — the server answers briefly, in the spoken language, for TTS. */
  voice?: { language?: string; speaker?: "woman" | "man" };
  signal?: AbortSignal;
  onEvent: (event: Record<string, unknown>) => void;
}) {
  async function post(chatId?: string) {
    return fetch("/api/chat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(chatId ? { chatId } : {}),
        content: input.content,
        ...(input.modelId ? { modelId: input.modelId } : {}),
        ...(input.locale ? { locale: input.locale } : {}),
        ...(input.pluginId ? { pluginId: input.pluginId } : {}),
        ...(input.agentInstructions
          ? { agentInstructions: input.agentInstructions }
          : {}),
        ...(input.forceImage ? { forceImage: true } : {}),
        ...(input.regenerate ? { regenerate: true } : {}),
        ...(input.editMessageId ? { editMessageId: input.editMessageId } : {}),
        ...(input.webSearch ? { webSearch: true } : {}),
        ...(input.mapContext ? { mapContext: input.mapContext } : {}),
        ...(input.tzOffsetMinutes != null ? { tzOffsetMinutes: input.tzOffsetMinutes } : {}),
        ...(input.voice ? { voice: input.voice } : {}),
        attachments: input.attachments,
      }),
      signal: input.signal,
    });
  }

  let res: Response;
  try {
    res = await post(input.chatId);
  } catch (error) {
    if (input.signal?.aborted) {
      input.onEvent({ type: "error", code: "ABORTED", message: "Stopped." });
      return;
    }
    input.onEvent({
      type: "error",
      code: "NETWORK",
      message:
        error instanceof Error
          ? error.message
          : "Network error — could not reach the server.",
    });
    return;
  }

  let result: Awaited<ReturnType<typeof readSseStream>>;
  try {
    result = await readSseStream(res, input.onEvent);
  } catch (error) {
    input.onEvent(
      input.signal?.aborted
        ? { type: "error", code: "ABORTED", message: "Stopped." }
        : {
            type: "error",
            code: "NETWORK",
            message: error instanceof Error ? error.message : "Connection lost.",
          },
    );
    return;
  }

  // Legacy servers may still 404 — retry once as a brand-new chat.
  if (result.notFound && input.chatId && !input.signal?.aborted) {
    try {
      res = await post(undefined);
      result = await readSseStream(res, input.onEvent);
    } catch {
      // already reported
    }
  }

  if (!result.sawContent && !result.sawError) {
    input.onEvent({
      type: "error",
      code: "EMPTY_REPLY",
      message: "Ҷавоб наомад. Бори дигар кӯшиш кунед / No reply — try again.",
    });
  }
}

export type { MessageRecord };
