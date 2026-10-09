"use client";

import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { useI18n } from "@/components/i18n/locale-provider";
import { ChatHistoryPanel } from "@/features/chat/chat-history-panel";

export default function ChatsPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col bg-[var(--bg)]">
      <WorkspaceHeader title={t("sidebar.chats")} />
      <div className="min-h-0 flex-1">
        <ChatHistoryPanel />
      </div>
    </div>
  );
}
