"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BookOpen,
  Clock,
  FolderKanban,
  ImageIcon,
  Menu,
  Pencil,
  Pin,
  Puzzle,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useChatList } from "@/features/chat/use-chat-api";
import { UserMenu } from "@/features/profile/profile-workspace";
import { useI18n } from "@/components/i18n/locale-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type SidebarCtx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarCtx | null>(null);

export function useAppSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useAppSidebar must be used within AppShell");
  return ctx;
}

const nav = [
  { href: "/app/gallery", labelKey: "sidebar.images", icon: ImageIcon },
  { href: "/app/knowledge", labelKey: "sidebar.library", icon: BookOpen },
  { href: "/app/projects", labelKey: "sidebar.projects", icon: FolderKanban },
  { href: "/app/agents", labelKey: "sidebar.scheduled", icon: Clock },
  { href: "/app/tools", labelKey: "sidebar.plugins", icon: Puzzle },
] as const;

function DrawerContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { setOpen } = useAppSidebar();
  const [query, setQuery] = useState("");
  const { chats, refresh, setChats } = useChatList(query);

  useEffect(() => {
    void refresh();
    const onChatsChanged = () => {
      void refresh();
    };
    window.addEventListener("nj:chats-changed", onChatsChanged);
    return () => window.removeEventListener("nj:chats-changed", onChatsChanged);
  }, [pathname, refresh]);

  async function deleteChat(id: string) {
    const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(t("chat.requestFailed"));
      return;
    }
    setChats((prev) => prev.filter((c) => c.id !== id));
    window.dispatchEvent(new Event("nj:chats-changed"));
    toast.success(t("chat.deleted"));
    if (pathname === `/app/chat/${id}`) {
      router.push("/app/chat");
      onNavigate?.();
    }
  }

  async function renameChat(id: string, current: string) {
    const next = window.prompt(t("chat.renamePrompt"), current)?.trim();
    if (!next || next === current) return;
    const res = await fetch(`/api/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next }),
    });
    if (!res.ok) {
      toast.error(t("chat.requestFailed"));
      return;
    }
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: next } : c)),
    );
    window.dispatchEvent(new Event("nj:chats-changed"));
    toast.success(t("chat.renamed"));
  }

  async function togglePin(id: string, pinned: boolean) {
    const res = await fetch(`/api/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !pinned }),
    });
    if (!res.ok) {
      toast.error(t("chat.requestFailed"));
      return;
    }
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !pinned } : c)),
    );
    window.dispatchEvent(new Event("nj:chats-changed"));
  }

  const sorted = [...chats].sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return 0;
  });

  return (
    <div className="flex h-full flex-col bg-[var(--surface)] text-[var(--fg)]">
      <div className="flex items-center justify-between gap-2 px-3 py-3 md:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--surface-3)] text-[var(--fg)] hover:bg-[var(--surface-2)]"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
          <p className="truncate text-[17px] font-semibold tracking-tight">ChatGem</p>
        </div>
      </div>

      <div className="px-3 pb-2">
        <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("chat.searchChats")}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
          />
        </label>
      </div>

      <nav className="space-y-0.5 px-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium",
                active
                  ? "bg-[var(--surface-3)] text-[var(--fg)]"
                  : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)]",
              )}
            >
              <Icon className="h-[18px] w-[18px] opacity-90" strokeWidth={1.75} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 my-3 h-px bg-[var(--border)]" />

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <ul className="space-y-0.5">
          {sorted.slice(0, 40).map((chat) => {
            const active = pathname === `/app/chat/${chat.id}`;
            return (
              <li key={chat.id} className="group flex items-center gap-0.5">
                <Link
                  href={`/app/chat/${chat.id}`}
                  onClick={onNavigate}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-xl px-3 py-2.5 text-[14px]",
                    active
                      ? "bg-[var(--surface-3)] text-[var(--fg)]"
                      : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)]",
                  )}
                >
                  {chat.pinned ? (
                    <Pin className="me-1.5 inline h-3 w-3 text-[var(--accent)]" />
                  ) : null}
                  {chat.title}
                </Link>
                <button
                  type="button"
                  title={t("chat.pin")}
                  aria-label={t("chat.pin")}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--fg-subtle)] opacity-100 hover:bg-[var(--surface-3)] hover:text-[var(--fg)] sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void togglePin(chat.id, Boolean(chat.pinned));
                  }}
                >
                  <Pin className={cn("h-3.5 w-3.5", chat.pinned && "text-[var(--accent)]")} />
                </button>
                <button
                  type="button"
                  title={t("chat.rename")}
                  aria-label={t("chat.rename")}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--fg-subtle)] opacity-100 hover:bg-[var(--surface-3)] hover:text-[var(--fg)] sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void renameChat(chat.id, chat.title);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={t("chat.delete")}
                  aria-label={t("chat.delete")}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--fg-subtle)] hover:bg-red-500/15 hover:text-red-400"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void deleteChat(chat.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
          {!sorted.length ? (
            <li className="px-3 py-2 text-xs text-[var(--fg-subtle)]">{t("chat.emptyChats")}</li>
          ) : null}
        </ul>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
        <Link
          href="/app/chat"
          onClick={() => onNavigate?.()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 text-[15px] font-semibold text-[var(--accent-fg)]"
        >
          <Pencil className="h-4 w-4" />
          {t("chat.chatBtn")}
        </Link>
        <ThemeToggle />
        <UserMenu compact />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);

  useEffect(() => {
    // Desktop: open once on first load (except image gallery — needs full width)
    if (window.matchMedia("(min-width: 768px)").matches) {
      const isGallery =
        window.location.pathname.startsWith("/app/gallery") ||
        window.location.pathname.startsWith("/app/images");
      setOpen(!isGallery);
    }
  }, []);

  useEffect(() => {
    // Mobile: close after route change. Gallery: keep closed on desktop too.
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const isGallery =
      pathname.startsWith("/app/gallery") || pathname.startsWith("/app/images");
    if (mobile || isGallery) {
      setOpen(false);
    }
  }, [pathname]);

  return (
    <SidebarContext.Provider value={value}>
      <div className="relative flex h-dvh max-h-dvh min-h-0 overflow-hidden bg-[var(--bg)] text-[var(--fg)] supports-[height:100dvh]:h-dvh">
        {/* Backdrop (mobile) */}
        <div
          className={cn(
            "fixed inset-0 z-[55] bg-black/55 transition-opacity md:hidden",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setOpen(false)}
          aria-hidden={!open}
        />

        {/* Меню — бе се хат */}
        <aside
          className={cn(
            "fixed inset-y-0 start-0 z-[60] flex w-[min(88vw,20rem)] flex-col border-e border-[var(--border)] bg-[var(--surface)] shadow-2xl transition-transform duration-300 ease-out pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <DrawerContent
            onNavigate={() => {
              if (window.matchMedia("(max-width: 767px)").matches) {
                setOpen(false);
              }
            }}
          />
        </aside>

        {/* Desktop spacer */}
        <div
          className={cn(
            "hidden shrink-0 transition-[width] duration-300 md:block",
            open ? "w-[19rem]" : "w-0",
          )}
          aria-hidden
        />

        <div
          className={cn(
            "flex h-full min-h-0 min-w-0 flex-1 flex-col overscroll-contain bg-[var(--bg)]",
            pathname.startsWith("/app/chat") ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          {children}
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

/**
 * ≡ on the page only when the sidebar is CLOSED.
 * When OPEN, close with X inside the sidebar (ChatGPT-style).
 */
export function AppMenuButton({ className }: { className?: string }) {
  const { open, setOpen } = useAppSidebar();

  if (open) {
    // Keep layout space so the title does not jump
    return <div className={cn("h-10 w-10 shrink-0", className)} aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "relative z-[70] grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--surface-3)] text-[var(--fg)] hover:bg-[var(--surface-2)]",
        className,
      )}
      aria-label="Open menu"
      aria-expanded={false}
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
