"use client";

import { ArrowLeft } from "lucide-react";
import { AppBackButton } from "@/components/layout/app-back-button";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

/**
 * Page header shared by workspace screens: menu + back, centred title, optional action.
 * `onBack` switches the leading control to an in-page back arrow (detail → list).
 */
export function WorkspaceHeader({
  title,
  onBack,
  action,
  bordered = true,
}: {
  title: string;
  onBack?: () => void;
  action?: React.ReactNode;
  bordered?: boolean;
}) {
  const { t } = useI18n();
  return (
    <header
      className={cn(
        "flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]",
        bordered && "border-b border-[var(--border)]",
      )}
    >
      {onBack ? (
        <button type="button" onClick={onBack} className="nj-icon-btn text-[var(--fg)]" aria-label={t("common.back")}>
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>
      ) : (
        <AppBackButton />
      )}
      <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold text-[var(--fg)]">{title}</h1>
      <div className={cn("flex shrink-0 items-center justify-end", onBack ? "w-10" : "min-w-[5rem]")}>{action}</div>
    </header>
  );
}
