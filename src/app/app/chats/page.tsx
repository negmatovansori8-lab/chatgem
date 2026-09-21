import { ChatHistoryPanel } from "@/features/chat/chat-history-panel";

export default function ChatsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[var(--border)] px-4 py-4 sm:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--fg)]">
          Chats
        </h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Search, rename, pin, archive, and delete conversations.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ChatHistoryPanel />
      </div>
    </div>
  );
}
