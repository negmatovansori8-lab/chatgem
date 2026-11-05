import type { ChatRecord, MessageRecord } from "@/types/chat";

const KEY = "nj_chat_memory_v1";
const MAX_CHATS = 80;
const MAX_MESSAGES = 80;

type Bundle = {
  chats: ChatRecord[];
  messages: Record<string, MessageRecord[]>;
};

function empty(): Bundle {
  return { chats: [], messages: {} };
}

function read(): Bundle {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Bundle;
    return {
      chats: Array.isArray(parsed.chats) ? parsed.chats : [],
      messages: parsed.messages && typeof parsed.messages === "object" ? parsed.messages : {},
    };
  } catch {
    return empty();
  }
}

function write(bundle: Bundle) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(bundle));
  } catch {
    // The browser refused the write (private mode or a full disk). The server copy still applies.
  }
}

export function recallChats(): ChatRecord[] {
  return read().chats.filter((chat) => !chat.archived);
}

export function recallThread(chatId: string): { chat: ChatRecord; messages: MessageRecord[] } | null {
  const bundle = read();
  const chat = bundle.chats.find((item) => item.id === chatId);
  const messages = bundle.messages[chatId];
  if (!chat || !messages?.length) return null;
  return { chat, messages };
}

/** Keep every chat the browser has seen, and let a newer server copy win on the same id. */
export function mergeChats(server: ChatRecord[], local: ChatRecord[]): ChatRecord[] {
  const map = new Map<string, ChatRecord>();
  for (const chat of local) map.set(chat.id, chat);
  for (const chat of server) map.set(chat.id, chat);
  return [...map.values()]
    .filter((chat) => !chat.archived)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, MAX_CHATS);
}

export function rememberChats(chats: ChatRecord[]) {
  const bundle = read();
  const ids = new Set(chats.map((chat) => chat.id));
  const messages: Bundle["messages"] = {};
  for (const id of ids) {
    if (bundle.messages[id]) messages[id] = bundle.messages[id];
  }
  write({ chats: chats.slice(0, MAX_CHATS), messages });
}

export function rememberThread(chat: ChatRecord, messages: MessageRecord[]) {
  const bundle = read();
  const rest = bundle.chats.filter((item) => item.id !== chat.id);
  const kept = messages.slice(-MAX_MESSAGES).map((message) => ({
    ...message,
    content: message.content.slice(0, 8000),
  }));
  write({
    chats: [chat, ...rest].slice(0, MAX_CHATS),
    messages: { ...bundle.messages, [chat.id]: kept },
  });
}

export function forgetChat(chatId: string) {
  const bundle = read();
  const messages = { ...bundle.messages };
  delete messages[chatId];
  write({
    chats: bundle.chats.filter((chat) => chat.id !== chatId),
    messages,
  });
}
