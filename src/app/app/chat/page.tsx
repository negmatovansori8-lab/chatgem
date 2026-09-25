import { Suspense } from "react";
import { ChatWorkspace } from "@/features/chat/chat-workspace";

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-0 flex-1 animate-pulse bg-[var(--bg)]" />}>
      <ChatWorkspace />
    </Suspense>
  );
}
