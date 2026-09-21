import { ChatWorkspace } from "@/features/chat/chat-workspace";

type Props = { params: Promise<{ id: string }> };

export default async function ChatByIdPage({ params }: Props) {
  const { id } = await params;
  return <ChatWorkspace chatId={id} />;
}
