"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

/** Back arrow for settings / secondary pages (ChatGPT-style). */
export function AppBackButton({ className }: { className?: string }) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--fg)] transition hover:bg-[var(--surface-2)]",
        className,
      )}
      aria-label={t("common.back")}
    >
      <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
    </button>
  );
}
