"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function ChatPreviewSection({ embedded = false }: { embedded?: boolean }) {
  const { t } = useI18n();

  return (
    <div
      className={cn(
        !embedded && "mx-auto max-w-6xl px-4 pb-16 sm:px-6",
      )}
    >
      <Link
        href="/app/chat"
        className={cn(
          "group block overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0c0c0e] shadow-[0_40px_100px_-50px_rgba(0,0,0,0.9)] transition hover:border-white/20 sm:rounded-[1.75rem]",
          embedded && "ring-1 ring-white/10",
        )}
        aria-label={t("hero.ctaPrimary")}
      >
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3 sm:px-5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" aria-hidden />
          <p className="ms-3 truncate text-xs font-medium text-white/40">
            ChatGem · {t("chat.chatBtn")}
          </p>
          <span className="ms-auto text-[11px] font-medium text-[#60a5fa] opacity-0 transition group-hover:opacity-100">
            {t("hero.ctaPrimary")} →
          </span>
        </div>

        <div className="grid lg:grid-cols-[200px_1fr]">
          <aside className="hidden border-e border-white/8 bg-black/40 p-4 lg:block" aria-hidden>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
              {t("sidebar.chats")}
            </p>
            <ul className="space-y-1.5 text-[13px] text-white/50">
              <li className="rounded-xl bg-white/8 px-3 py-2.5 text-white">
                {t("landing.preview.chat1")}
              </li>
              <li className="rounded-xl px-3 py-2.5">{t("landing.preview.chat2")}</li>
              <li className="rounded-xl px-3 py-2.5">{t("landing.preview.chat3")}</li>
            </ul>
          </aside>

          <div className="flex min-h-[220px] flex-col justify-end gap-4 bg-black p-4 sm:min-h-[300px] sm:p-6">
            <div className="ms-auto max-w-[88%] rounded-2xl bg-[#2f2f2f] px-4 py-3 text-left text-[14px] leading-relaxed text-white sm:text-[15px]">
              {t("landing.preview.user")}
            </div>
            <div className="max-w-[92%] text-left text-[14px] leading-relaxed text-white/70 sm:text-[15px]">
              {t("landing.preview.ai")}
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-full border border-white/10 bg-[#212121] px-3 py-2.5">
              <span className="flex-1 truncate text-sm text-white/35">
                {t("chat.placeholder")}
              </span>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-black">
                ↑
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
