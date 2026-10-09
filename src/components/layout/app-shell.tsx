"use client";

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
  FolderOpen,
  ImageIcon,
  Map,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  BookOpen,
  Puzzle,
  Settings,
  Trash2,
} from "lucide-react";
import { useChatList } from "@/features/chat/use-chat-api";
import { UserMenu } from "@/features/profile/profile-workspace";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-mark";
import { ProMonthNotice } from "@/components/layout/pro-month-notice";
import { useI18n } from "@/components/i18n/locale-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { HttpError, jsonInit, requestJson } from "@/lib/http";
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

function DrawerContent({
  closeSidebar,
}: {
  closeSidebar: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { chats, loading, refresh, setChats } = useChatList("");
  const onChatRoute =
    pathname.startsWith("/app/chat") || pathname.startsWith("/app/chats");

  useEffect(() => {
    const onChatsChanged = () => {
      void refresh();
    };
    window.addEventListener("nj:chats-changed", onChatsChanged);
    return () => window.removeEventListener("nj:chats-changed", onChatsChanged);
  }, [refresh]);

  function go(href: string, opts?: { keepSidebarOnDesktop?: boolean }) {
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    // Tool pages always close the drawer so the destination is visible.
    if (!opts?.keepSidebarOnDesktop || mobile) {
      closeSidebar();
    }
    router.push(href);
  }

  async function patchChat(id: string, init: RequestInit) {
    try {
      await requestJson(`/api/chats/${id}`, init);
      return true;
    } catch (e) {
      toast.error(e instanceof HttpError && e.offline ? t("common.offline") : t("chat.requestFailed"));
      return false;
    }
  }

  async function deleteChat(id: string) {
    if (!(await patchChat(id, jsonInit("DELETE")))) return;
    setChats((prev) => prev.filter((c) => c.id !== id));
    window.dispatchEvent(new Event("nj:chats-changed"));
    toast.success(t("chat.deleted"));
    if (pathname === `/app/chat/${id}`) {
      router.push("/app/chat");
      if (window.matchMedia("(max-width: 1023px)").matches) closeSidebar();
    }
  }

  async function renameChat(id: string, current: string) {
    const next = window.prompt(t("chat.renamePrompt"), current)?.trim();
    if (!next || next === current) return;
    if (!(await patchChat(id, jsonInit("PATCH", { title: next })))) return;
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: next } : c)),
    );
    window.dispatchEvent(new Event("nj:chats-changed"));
    toast.success(t("chat.renamed"));
  }

  async function togglePin(id: string, pinned: boolean) {
    if (!(await patchChat(id, jsonInit("PATCH", { pinned: !pinned })))) return;
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
      {/* Brand: logo + ChatGem; exit lives in main header (AppMenuButton) */}
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          onClick={() => go("/app/chat", { keepSidebarOnDesktop: true })}
          className="brand-hover flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] py-0.5 text-start transition hover:opacity-90"
        >
          <BrandMark size="sm" />
          <BrandWordmark className="text-[17px]" />
        </button>
        {/* Mobile: exit sidebar with same ChatGPT-style icon */}
        <button
          type="button"
          onClick={() => closeSidebar()}
          className="nj-panel-btn grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--fg)] transition hover:bg-[var(--surface-2)] lg:hidden"
          aria-label="Close menu"
          title="Баромадан"
        >
          <PanelLeftClose className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* New chat — primary */}
      <div className="px-2.5 pb-2">
        <button
          type="button"
          onClick={() => go("/app/chat", { keepSidebarOnDesktop: true })}
          className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] bg-[var(--fg)] px-3 py-2.5 text-[13.5px] font-semibold text-[var(--bg)] transition hover:opacity-90 active:scale-[0.99]"
        >
          <MessageSquarePlus className="h-[17px] w-[17px]" strokeWidth={2} />
          {t("sidebar.newChat")}
        </button>
      </div>

      {/* Compact tools */}
      <nav className="space-y-0.5 px-2.5 pb-2">
        {(
          [
            { href: "/app/gallery", labelKey: "sidebar.images", icon: ImageIcon },
            { href: "/app/files", labelKey: "sidebar.files", icon: FolderOpen },
            { href: "/app/knowledge", labelKey: "sidebar.library", icon: BookOpen },
            { href: "/app/tools", labelKey: "sidebar.plugins", icon: Puzzle },
            { href: "/app/maps", labelKey: "sidebar.maps", icon: Map },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => go(item.href)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-start text-[13.5px] font-medium transition",
                active
                  ? "bg-[var(--accent-muted)] text-[var(--accent-2)]"
                  : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
              )}
            >
              <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
              {t(item.labelKey)}
            </button>
          );
        })}
      </nav>

      <div className="mx-3 mb-1 h-px bg-[var(--border)]" />

      {/* Chat history — only on chat routes (avoids “stuck on empty chats” confusion) */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-1">
        {!onChatRoute ? (
          <div className="px-2 py-4 text-center">
            <p className="text-[12px] leading-relaxed text-[var(--fg-subtle)]">
              {t("sidebar.sectionOpen")}
            </p>
            <button
              type="button"
              onClick={() => go("/app/chat", { keepSidebarOnDesktop: true })}
              className="mt-3 inline-flex rounded-full border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            >
              {t("sidebar.newChat")}
            </button>
          </div>
        ) : loading && !sorted.length ? (
          <div className="space-y-2 px-1 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded-xl bg-[var(--surface-2)]"
              />
            ))}
          </div>
        ) : (
        <ul className="space-y-0.5">
          {sorted.slice(0, 50).map((chat) => {
            const active = pathname === `/app/chat/${chat.id}`;
            return (
              <li key={chat.id} className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() =>
                    go(`/app/chat/${chat.id}`, { keepSidebarOnDesktop: true })
                  }
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-xl py-2.5 pe-[5.5rem] ps-3 text-start text-[13.5px] leading-snug transition",
                    active
                      ? "bg-[var(--surface-3)] text-[var(--fg)]"
                      : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
                  )}
                >
                  {chat.pinned ? (
                    <Pin className="me-1.5 inline h-3 w-3 -translate-y-px text-[var(--accent)]" />
                  ) : null}
                  {chat.title || t("chat.newChat")}
                </button>
                <div className="absolute end-0.5 flex items-center gap-0.5 rounded-lg bg-[var(--surface)]/95 opacity-100 backdrop-blur-sm sm:bg-transparent sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button
                    type="button"
                    title={t("chat.pin")}
                    aria-label={t("chat.pin")}
                    className="grid h-8 w-8 place-items-center rounded-md text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
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
                    className="grid h-8 w-8 place-items-center rounded-md text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
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
                    className="grid h-8 w-8 place-items-center rounded-md text-[var(--fg-subtle)] hover:bg-red-500/15 hover:text-red-400"
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
        )}
      </div>

      {/* Settings + profile */}
      <div className="space-y-1 border-t border-[var(--border)] p-2.5">
        <button
          type="button"
          onClick={() => go("/app/settings")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-start text-[13.5px] font-medium transition",
            pathname.startsWith("/app/profile") || pathname.startsWith("/app/settings")
              ? "bg-[var(--accent-muted)] text-[var(--accent-2)]"
              : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
          )}
        >
          <Settings className="h-[17px] w-[17px]" strokeWidth={1.75} />
          {t("sidebar.settings")}
        </button>
        <div className="flex items-center gap-1 rounded-[var(--radius-md)] px-0.5 py-0.5">
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
    const mq = window.matchMedia("(min-width: 1024px)");

    function applyDesktopDefault() {
      try {
        const saved = localStorage.getItem("nj_sidebar_open");
        if (saved === "0" || saved === "1") {
          if (mq.matches) {
            setOpen(saved === "1");
            return;
          }
        }
      } catch {
        // ignore
      }
      if (mq.matches) {
        const isGallery =
          window.location.pathname.startsWith("/app/gallery") ||
          window.location.pathname.startsWith("/app/images");
        setOpen(!isGallery);
      } else {
        setOpen(false);
      }
    }

    applyDesktopDefault();

    function onChange() {
      if (!mq.matches) {
        setOpen(false);
        return;
      }
      try {
        const saved = localStorage.getItem("nj_sidebar_open");
        if (saved === "0" || saved === "1") {
          setOpen(saved === "1");
          return;
        }
      } catch {
        // ignore
      }
      setOpen(true);
    }

    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    try {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        localStorage.setItem("nj_sidebar_open", open ? "1" : "0");
      }
    } catch {
      // ignore
    }
  }, [open]);

  useEffect(() => {
    // Close drawer after navigation so destination pages are visible.
    const overlay = window.matchMedia("(max-width: 1023px)").matches;
    const isToolPage =
      pathname.startsWith("/app/gallery") ||
      pathname.startsWith("/app/images") ||
      pathname.startsWith("/app/files") ||
      pathname.startsWith("/app/knowledge") ||
      pathname.startsWith("/app/tools") ||
      pathname.startsWith("/app/maps") ||
      pathname.startsWith("/app/profile") ||
      pathname.startsWith("/app/settings") ||
      pathname.startsWith("/app/voice") ||
      pathname.startsWith("/app/billing");
    if (overlay || isToolPage) {
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    if (!mq.matches || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <SidebarContext.Provider value={value}>
      <div className="nj-app-shell relative flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden bg-[var(--bg)] text-[var(--fg)] supports-[height:100dvh]:h-dvh">
        <div
          className={cn(
            "fixed inset-0 z-[55] bg-black/50 transition-opacity lg:hidden",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setOpen(false)}
          aria-hidden={!open}
        />

        <aside
          className={cn(
            "nj-sidebar fixed inset-y-0 start-0 z-[60] flex flex-col border-e border-[var(--border)] bg-[var(--surface)] transition-transform duration-200 ease-out pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            open
              ? "translate-x-0"
              : "-translate-x-full rtl:translate-x-full",
          )}
        >
          <DrawerContent closeSidebar={() => setOpen(false)} />
        </aside>

        <div
          className={cn(
            "nj-sidebar-spacer hidden shrink-0 transition-[width] duration-200 lg:block",
            open ? "nj-sidebar-spacer-open" : "w-0",
          )}
          aria-hidden
        />

        <div
          className={cn(
            "relative flex h-full min-h-0 min-w-0 flex-1 flex-col overscroll-contain bg-[var(--bg)]",
            pathname.startsWith("/app/chat")
              ? "overflow-hidden"
              : "overflow-x-hidden overflow-y-auto",
          )}
        >
          <ProMonthNotice />
          {children}
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

export function AppMenuButton({ className }: { className?: string }) {
  const { open, toggle } = useAppSidebar();

  /** Exit (close sidebar) — icon like ChatGPT PanelLeftClose */
  if (open) {
    return (
      <button
        type="button"
        onClick={() => toggle()}
        className={cn(
          "nj-panel-btn relative z-[70] grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--fg)] transition hover:bg-[var(--surface-2)] active:scale-[0.96]",
          className,
        )}
        aria-label="Close menu"
        aria-expanded
        title="Баромадан / Close"
      >
        <PanelLeftClose className="h-5 w-5" strokeWidth={1.5} />
      </button>
    );
  }

  /** Enter (open sidebar) — mirrored PanelLeftOpen */
  return (
    <button
      type="button"
      onClick={() => toggle()}
      className={cn(
        "nj-panel-btn relative z-[70] grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--fg)] transition hover:bg-[var(--surface-2)] active:scale-[0.96]",
        className,
      )}
      aria-label="Open menu"
      aria-expanded={false}
      title="Даромадан / Open"
    >
      <PanelLeftOpen className="h-5 w-5" strokeWidth={1.5} />
    </button>
  );
}
