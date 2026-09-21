import { readJsonFile, writeJsonFile } from "@/lib/local-store";
import type { ChatRecord, MessageRecord } from "@/types/chat";

type ChatStore = {
  chats: ChatRecord[];
  messages: MessageRecord[];
};

async function load(): Promise<ChatStore> {
  return readJsonFile<ChatStore>("chats.json", { chats: [], messages: [] });
}

async function save(store: ChatStore) {
  await writeJsonFile("chats.json", store);
}

function now() {
  return new Date().toISOString();
}

export const chatRepository = {
  async listByUser(userId: string, opts?: { q?: string; includeArchived?: boolean }) {
    const store = await load();
    let chats = store.chats.filter((c) => c.userId === userId);
    if (!opts?.includeArchived) {
      chats = chats.filter((c) => !c.archived);
    }
    if (opts?.q) {
      const q = opts.q.toLowerCase();
      chats = chats.filter((c) => c.title.toLowerCase().includes(q));
    }
    return chats.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  },

  async get(userId: string, chatId: string) {
    const store = await load();
    const chat = store.chats.find((c) => c.id === chatId && c.userId === userId);
    if (!chat) return null;
    const messages = store.messages
      .filter((m) => m.chatId === chatId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { chat, messages };
  },

  async create(userId: string, input?: { title?: string; modelId?: string | null }) {
    const store = await load();
    const stamp = now();
    const chat: ChatRecord = {
      id: crypto.randomUUID(),
      userId,
      title: input?.title?.trim() || "New chat",
      modelId: input?.modelId ?? null,
      pinned: false,
      archived: false,
      createdAt: stamp,
      updatedAt: stamp,
    };
    store.chats.unshift(chat);
    await save(store);
    return chat;
  },

  async update(
    userId: string,
    chatId: string,
    patch: Partial<Pick<ChatRecord, "title" | "pinned" | "archived" | "modelId">>,
  ) {
    const store = await load();
    const chat = store.chats.find((c) => c.id === chatId && c.userId === userId);
    if (!chat) return null;
    if (patch.title !== undefined) chat.title = patch.title;
    if (patch.pinned !== undefined) chat.pinned = patch.pinned;
    if (patch.archived !== undefined) chat.archived = patch.archived;
    if (patch.modelId !== undefined) chat.modelId = patch.modelId;
    chat.updatedAt = now();
    await save(store);
    return chat;
  },

  async remove(userId: string, chatId: string) {
    const store = await load();
    const before = store.chats.length;
    store.chats = store.chats.filter((c) => !(c.id === chatId && c.userId === userId));
    store.messages = store.messages.filter((m) => m.chatId !== chatId);
    await save(store);
    return store.chats.length < before;
  },

  async addMessage(
    userId: string,
    chatId: string,
    message: Omit<MessageRecord, "id" | "chatId" | "createdAt">,
  ) {
    const store = await load();
    const chat = store.chats.find((c) => c.id === chatId && c.userId === userId);
    if (!chat) return null;

    const record: MessageRecord = {
      id: crypto.randomUUID(),
      chatId,
      createdAt: now(),
      ...message,
    };
    store.messages.push(record);
    chat.updatedAt = record.createdAt;
    if (chat.title === "New chat" && message.role === "USER") {
      chat.title = message.content.slice(0, 60).trim() || "New chat";
    }
    await save(store);
    return record;
  },
};
