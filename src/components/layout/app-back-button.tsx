"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppMenuButton } from "@/components/layout/app-shell";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

/**
 * Section header controls: open sidebar + back to chat.
 * Fixes mobile: without menu button, users could not leave Image Studio etc.
 */
export function AppBackButton({ className }: { className?: string }) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      <AppMenuButton />
      <button
        type="button"
        onClick={() => router.push("/app/chat")}
        className="nj-icon-btn text-[var(--fg)]"
        aria-label={t("common.back")}
        title={t("common.back")}
      >
        <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
      </button>
    </div>
  );
}
