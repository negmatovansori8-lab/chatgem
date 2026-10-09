"use client";

import dynamic from "next/dynamic";
import { Loader2, MapPin, Maximize2, Minimize2, X } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { useMediaQuery } from "@/features/maps/hooks";
import type { ChatMap } from "@/features/chat/use-chat-map";
import { cn } from "@/lib/utils";

const MapsWorkspace = dynamic(() => import("@/features/maps/maps-workspace").then((m) => m.MapsWorkspace), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-[var(--surface-2)] text-[var(--fg-subtle)]">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  ),
});

function HeaderBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
    >
      {children}
    </button>
  );
}

/**
 * The chat's map: right column on desktop; on phones a strip under the header
 * (chat stays usable) that expands to full screen. Once mounted it is only
 * hidden, never unmounted, so later questions update the same map.
 */
export function ChatMapPanel({ map }: { map: ChatMap }) {
  const { t } = useI18n();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  if (!map.mounted) return null;

  const compact = !isDesktop && !map.expanded;
  const actions = (
    <>
      {!isDesktop ? (
        map.expanded ? (
          <HeaderBtn label={t("chat.map.minimize")} onClick={() => map.setExpanded(false)}>
            <Minimize2 className="h-4 w-4" />
          </HeaderBtn>
        ) : (
          <HeaderBtn label={t("chat.map.expand")} onClick={() => map.setExpanded(true)}>
            <Maximize2 className="h-4 w-4" />
          </HeaderBtn>
        )
      ) : null}
      <HeaderBtn label={t("chat.map.close")} onClick={map.close}>
        <X className="h-4 w-4" />
      </HeaderBtn>
    </>
  );

  return (
    <section
      aria-label={t("chat.map.open")}
      className={cn(
        "relative min-h-0 overflow-hidden bg-[var(--bg)]",
        !map.open && "hidden",
        map.expanded && !isDesktop
          ? "fixed inset-0 z-[60] pt-[env(safe-area-inset-top)]"
          : "order-2 h-[46dvh] shrink-0 border-b border-[var(--border)] lg:order-none lg:h-auto lg:w-[min(48%,760px)] lg:border-b-0 lg:border-s",
      )}
    >
      <MapsWorkspace
        embedded
        compact={compact}
        headerActions={actions}
        onExpand={() => map.setExpanded(true)}
        command={map.command}
        onResult={map.handleResult}
        onSelectionChange={map.setSelection}
      />
    </section>
  );
}

/** Selected map place + one-tap follow-ups that reuse the chat's map context. */
export function ChatMapSelectionBar({
  map,
  disabled,
  onAsk,
}: {
  map: ChatMap;
  disabled: boolean;
  onAsk: (prompt: string) => void;
}) {
  const { t } = useI18n();
  if (!map.selection) return null;
  const prompts = [t("chat.map.askFar"), t("chat.map.askGo"), t("chat.map.askNear")];
  return (
    <div className="nj-chat-col mx-auto mb-2 flex flex-wrap items-center gap-1.5 px-0.5">
      <span className="inline-flex min-w-0 max-w-full items-center gap-1 truncate rounded-full bg-[var(--accent-muted)] px-2.5 py-1 text-[12px] font-medium text-[var(--fg)]">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
        <span className="truncate">
          {t("chat.map.selected")}: {map.selection.name}
        </span>
      </span>
      {prompts.map((p) => (
        <button
          key={p}
          type="button"
          disabled={disabled}
          onClick={() => onAsk(p)}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[12px] text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--fg)] disabled:opacity-40"
        >
          {p}
        </button>
      ))}
    </div>
  );
}
