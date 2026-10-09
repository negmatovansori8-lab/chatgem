"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, MessageSquarePlus, Pencil, Pin, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/locale-provider";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useChatList } from "@/features/chat/use-chat-api";
import { HttpError, jsonInit, requestJson } from "@/lib/http";
import { cn } from "@/lib/utils";

const ACTION_BTN =
  "grid h-9 w-9 place-items-center rounded-[var(--radius-md)] text-[var(--fg-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

export function ChatHistoryPanel({ activeId }: { activeId?: string }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const { chats, loading, refresh } = useChatList(query);
  const router = useRouter();

  const empty = useMemo(() => !loading && chats.length === 0, [loading, chats.length]);
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );

  async function mutate(url: string, init: RequestInit) {
    try {
      await requestJson(url, init);
      window.dispatchEvent(new Event("nj:chats-changed"));
      await refresh();
      return true;
    } catch (e) {
      toast.error(e instanceof HttpError && e.offline ? t("common.offline") : t("chat.requestFailed"));
      return false;
    }
  }

  async function removeChat(id: string) {
    if (!(await mutate(`/api/chats/${id}`, jsonInit("DELETE")))) return;
    toast.success(t("chat.deleted"));
    if (activeId === id) router.push("/app/chat");
  }

  async function renameChat(id: string, current: string) {
    const next = window.prompt(t("chat.renamePrompt"), current)?.trim();
    if (!next || next === current) return;
    await mutate(`/api/chats/${id}`, jsonInit("PATCH", { title: next }));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-2 border-b border-[var(--border)] p-3">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)]" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("chat.searchChats")}
            className="ps-9"
            aria-label={t("chat.searchChats")}
            enterKeyHint="search"
          />
        </label>
        <Link href="/app/chat" className={cn(buttonVariants({ size: "lg" }), "shrink-0 px-3.5")}>
          <MessageSquarePlus className="h-4 w-4" />
          <span className="max-[379px]:sr-only">{t("sidebar.newChat")}</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {loading && !chats.length ? (
          <div className="space-y-1.5 p-1" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-2)]" />
            ))}
          </div>
        ) : null}
        {empty ? <EmptyState icon={<MessageSquarePlus className="h-6 w-6" />} title={t("chat.emptyChats")} /> : null}
        <ul className="space-y-1">
          {chats.map((chat) => (
            <li
              key={chat.id}
              className={cn(
                "group flex items-center gap-1 rounded-[var(--radius-md)] border border-transparent ps-3 pe-1 transition hover:border-[var(--border)] hover:bg-[var(--surface-2)]",
                activeId === chat.id && "border-[var(--border)] bg-[var(--surface-2)]",
              )}
            >
              <Link href={`/app/chat/${chat.id}`} className="min-w-0 flex-1 py-2.5">
                <p className="flex items-center gap-1.5 truncate text-[15px] font-medium text-[var(--fg)]">
                  {chat.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 fill-[var(--accent)] text-[var(--accent)]" /> : null}
                  <span className="truncate">{chat.title || t("chat.newChat")}</span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">{dateFormat.format(new Date(chat.updatedAt))}</p>
              </Link>
              <div className="flex shrink-0 items-center opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <button
                  type="button"
                  className={ACTION_BTN}
                  aria-label={t("chat.pin")}
                  aria-pressed={Boolean(chat.pinned)}
                  onClick={() => void mutate(`/api/chats/${chat.id}`, jsonInit("PATCH", { pinned: !chat.pinned }))}
                >
                  <Pin className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={ACTION_BTN}
                  aria-label={t("chat.rename")}
                  onClick={() => void renameChat(chat.id, chat.title)}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={cn(ACTION_BTN, "max-[359px]:hidden")}
                  aria-label={t("chat.archive")}
                  onClick={() => void mutate(`/api/chats/${chat.id}`, jsonInit("PATCH", { archived: true }))}
                >
                  <Archive className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={cn(ACTION_BTN, "hover:text-[var(--danger)]")}
                  aria-label={t("chat.delete")}
                  onClick={() => void removeChat(chat.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}





