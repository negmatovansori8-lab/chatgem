"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Pin, Pencil, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatList } from "@/features/chat/use-chat-api";
import { cn } from "@/lib/utils";

export function ChatHistoryPanel({
  activeId,
  compact = false,
}: {
  activeId?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const { chats, loading, refresh } = useChatList(query);
  const router = useRouter();

  const empty = useMemo(() => !loading && chats.length === 0, [loading, chats.length]);

  async function patchChat(id: string, body: Record<string, unknown>) {
    await fetch(`/api/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await refresh();
  }

  async function removeChat(id: string) {
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    await refresh();
    if (activeId === id) router.push("/app/chat");
  }

  async function renameChat(id: string, current: string) {
    const next = window.prompt("Rename chat", current);
    if (!next?.trim()) return;
    await patchChat(id, { title: next.trim() });
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", compact && "border-r border-[var(--border)]")}>
      <div className="space-y-3 border-b border-[var(--border)] p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="pl-9"
            aria-label="Search chats"
          />
        </div>
        <Link href="/app/chat">
          <Button className="w-full" size="sm">
            New chat
          </Button>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <p className="px-2 py-4 text-xs text-[var(--fg-subtle)]">Loading chats…</p>
        ) : null}
        {empty ? (
          <p className="px-2 py-4 text-xs text-[var(--fg-subtle)]">No chats yet.</p>
        ) : null}
        <ul className="space-y-1">
          {chats.map((chat) => (
            <li
              key={chat.id}
              className={cn(
                "group rounded-xl border border-transparent px-2 py-2 hover:border-[var(--border)] hover:bg-[var(--surface-2)]",
                activeId === chat.id && "border-[var(--border)] bg-[var(--surface-2)]",
              )}
            >
              <div className="flex items-start gap-2">
                <Link href={`/app/chat/${chat.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--fg)]">
                    {chat.pinned ? "📌 " : ""}
                    {chat.title}
                  </p>
                  <p className="text-[10px] text-[var(--fg-subtle)]">
                    {new Date(chat.updatedAt).toLocaleString()}
                  </p>
                </Link>
                <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
                    aria-label="Pin chat"
                    onClick={() => void patchChat(chat.id, { pinned: !chat.pinned })}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
                    aria-label="Rename chat"
                    onClick={() => void renameChat(chat.id, chat.title)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
                    aria-label="Archive chat"
                    onClick={() => void patchChat(chat.id, { archived: true })}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--danger)]"
                    aria-label="Delete chat"
                    onClick={() => void removeChat(chat.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
