"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MapReportKind } from "@/lib/maps/map-action";
import type { MapCommand, MapResult } from "@/lib/maps/map-result";
import { mapResultMarkdown } from "@/lib/maps/chat-summary";

/** The chat bubble waiting for the map's real result. */
export type MapTurn = {
  /** Client bubble id while streaming; replaced by `serverId` after the history sync. */
  bubbleId: string;
  serverId?: string;
  chatId?: string;
  locale: string;
  href: string;
};

export type ChatMapSelection = { id: string; name: string };

/**
 * Chat ⇄ map state: the map is mounted once (never reloaded), commands are
 * numbered so a newer question always wins, and the map's report is turned
 * into the reply of the bubble that asked for it.
 */
export function useChatMap(onSummary: (turn: MapTurn, markdown: string) => void) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [command, setCommand] = useState<MapCommand | null>(null);
  const [selection, setSelection] = useState<ChatMapSelection | null>(null);
  const seqRef = useRef(0);
  const turnRef = useRef<(MapTurn & { commandId: number }) | null>(null);
  /** Server message id → map summary; survives the post-stream history sync. */
  const summariesRef = useRef(new Map<string, string>());
  const onSummaryRef = useRef(onSummary);
  useEffect(() => {
    onSummaryRef.current = onSummary;
  }, [onSummary]);

  const run = useCallback((href: string, report?: MapReportKind, turn?: MapTurn) => {
    const id = ++seqRef.current;
    turnRef.current = report && turn ? { ...turn, commandId: id } : null;
    setCommand({ id, href, report });
    setMounted(true);
    setOpen(true);
  }, []);

  const handleResult = useCallback((result: MapResult) => {
    const turn = turnRef.current;
    if (!turn || turn.commandId !== result.commandId) return;
    turnRef.current = null;
    const markdown = mapResultMarkdown(result, turn.locale, { href: turn.href });
    if (turn.serverId) summariesRef.current.set(turn.serverId, markdown);
    onSummaryRef.current(turn, markdown);
    // Where the user is stays in this tab only — never written to chat history.
    if (result.kind === "locate" || !turn.chatId || !turn.serverId) return;
    void fetch(`/api/chats/${turn.chatId}/messages/${turn.serverId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: markdown }),
    }).catch(() => undefined);
  }, []);

  /** Content for a synced server message, preferring a map summary not yet persisted. */
  const contentFor = useCallback((id: string, content: string) => summariesRef.current.get(id) ?? content, []);

  const close = useCallback(() => {
    setOpen(false);
    setExpanded(false);
  }, []);

  return {
    mounted,
    open,
    expanded,
    command,
    selection: open ? selection : null,
    run,
    handleResult,
    contentFor,
    setSelection,
    setExpanded,
    reopen: useCallback(() => setOpen(true), []),
    close,
  };
}

export type ChatMap = ReturnType<typeof useChatMap>;
