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
  AudioLines,
  FolderOpen,
  ImageIcon,
  Menu,
  MessageSquarePlus,
  Pencil,
  Pin,
  BookOpen,
  Puzzle,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useChatList } from "@/features/chat/use-chat-api";
import { UserMenu } from "@/features/profile/profile-workspace";
import { BrandMark } from "@/components/brand/brand-mark";
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

function useDebounced(value: string, ms = 220) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

function DrawerContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { setOpen } = useAppSidebar();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query);
  const { chats, loading, refresh, setChats } = useChatList(debouncedQuery);

  useEffect(() => {
    const onChatsChanged = () => {
      void refresh();
    };
    window.addEventListener("nj:chats-changed", onChatsChanged);
    return () => window.removeEventListener("nj:chats-changed", onChatsChanged);
  }, [refresh]);

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

  const sorted = useMemo(() => {
    return [...chats].sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return 0;
    });
  }, [chats]);

  return (
    <div className="flex h-full flex-col bg-[var(--surface)] text-[var(--fg)]">
      {/* Brand + close */}
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)] md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        <Link
          href="/app/chat"
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1"
        >
          <BrandMark size="sm" className="rounded-xl" />
          <span className="truncate text-[15px] font-semibold tracking-tight">
            ChatGem
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)] md:grid"
          aria-label="Collapse sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* New chat — primary */}
      <div className="px-2 pb-2">
        <Link
          href="/app/chat"
          onClick={onNavigate}
          className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[14px] font-medium text-[var(--fg)] transition hover:bg-[var(--surface-3)]"
        >
          <MessageSquarePlus className="h-[18px] w-[18px] text-[var(--fg-muted)]" strokeWidth={1.75} />
          {t("sidebar.newChat")}
        </Link>
      </div>

      {/* Search chats */}
      <div className="px-2 pb-2">
        <label className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("chat.searchChats")}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
          />
        </label>
      </div>

      {/* Compact tools */}
      <nav className="space-y-0.5 px-2 pb-2">
        {(
          [
            { href: "/app/gallery", labelKey: "sidebar.images", icon: ImageIcon },
            { href: "/app/files", labelKey: "sidebar.files", icon: FolderOpen },
            { href: "/app/knowledge", labelKey: "sidebar.library", icon: BookOpen },
            { href: "/app/voice", labelKey: "sidebar.voice", icon: AudioLines },
            { href: "/app/tools", labelKey: "sidebar.plugins", icon: Puzzle },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-medium transition",
                active
                  ? "bg-[var(--surface-3)] text-[var(--fg)]"
                  : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-1 h-px bg-[var(--border)]" />

      <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-subtle)]">
        {t("sidebar.chats")}
      </p>

      {/* Real history */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading && !sorted.length ? (
          <div className="space-y-2 px-1 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded-xl bg-[var(--surface-2)]"
              />
            ))}
          </div>
        ) : null}

        <ul className="space-y-0.5">
          {sorted.slice(0, 50).map((chat) => {
            const active = pathname === `/app/chat/${chat.id}`;
            return (
              <li key={chat.id} className="group relative flex items-center">
                <Link
                  href={`/app/chat/${chat.id}`}
                  onClick={onNavigate}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-xl py-2 pe-20 ps-3 text-[13.5px] leading-snug transition",
                    active
                      ? "bg-[var(--surface-3)] text-[var(--fg)]"
                      : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
                  )}
                >
                  {chat.pinned ? (
                    <Pin className="me-1.5 inline h-3 w-3 -translate-y-px text-[var(--accent)]" />
                  ) : null}
                  {chat.title || t("chat.newChat")}
                </Link>
                <div className="absolute end-1 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    title={t("chat.pin")}
                    aria-label={t("chat.pin")}
                    className="grid h-7 w-7 place-items-center rounded-md text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void togglePin(chat.id, Boolean(chat.pinned));
                    }}
                  >
                    <Pin
                      className={cn(
                        "h-3.5 w-3.5",
                        chat.pinned && "fill-[var(--accent)] text-[var(--accent)]",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    title={t("chat.rename")}
                    aria-label={t("chat.rename")}
                    className="grid h-7 w-7 place-items-center rounded-md text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
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
                    className="grid h-7 w-7 place-items-center rounded-md text-[var(--fg-subtle)] hover:bg-red-500/15 hover:text-red-400"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void deleteChat(chat.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
          {!loading && !sorted.length ? (
            <li className="px-3 py-6 text-center text-xs leading-relaxed text-[var(--fg-subtle)]">
              {t("chat.emptyChats")}
            </li>
          ) : null}
        </ul>
      </div>

      {/* Settings + profile — ChatGPT bottom bar */}
      <div className="space-y-1 border-t border-[var(--border)] p-2">
        <Link
          href="/app/profile"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-medium transition",
            pathname.startsWith("/app/profile") || pathname.startsWith("/app/settings")
              ? "bg-[var(--surface-3)] text-[var(--fg)]"
              : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
          )}
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {t("sidebar.settings")}
        </Link>
        <div className="flex items-center gap-1 rounded-xl px-1 py-1">
          <div className="min-w-0 flex-1">
            <UserMenu />
          </div>
          <ThemeToggle />
        </div>
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
    try {
      const saved = localStorage.getItem("nj_sidebar_open");
      if (saved === "0" || saved === "1") {
        if (window.matchMedia("(min-width: 768px)").matches) {
          setOpen(saved === "1");
          return;
        }
      }
    } catch {
      // ignore
    }
    if (window.matchMedia("(min-width: 768px)").matches) {
      const isGallery =
        window.location.pathname.startsWith("/app/gallery") ||
        window.location.pathname.startsWith("/app/images");
      setOpen(!isGallery);
    }
  }, []);

  useEffect(() => {
    try {
      if (window.matchMedia("(min-width: 768px)").matches) {
        localStorage.setItem("nj_sidebar_open", open ? "1" : "0");
      }
    } catch {
      // ignore
    }
  }, [open]);

  useEffect(() => {
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
        <div
          className={cn(
            "fixed inset-0 z-[55] bg-black/50 transition-opacity md:hidden",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setOpen(false)}
          aria-hidden={!open}
        />

        <aside
          className={cn(
            "fixed inset-y-0 start-0 z-[60] flex w-[min(86vw,17.5rem)] flex-col border-e border-[var(--border)] bg-[var(--surface)] transition-transform duration-250 ease-out pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:w-[17.5rem]",
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

        <div
          className={cn(
            "hidden shrink-0 transition-[width] duration-250 md:block",
            open ? "w-[17.5rem]" : "w-0",
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

export function AppMenuButton({ className }: { className?: string }) {
  const { open, setOpen } = useAppSidebar();

  if (open) {
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
