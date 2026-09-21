import { readJsonFile, writeJsonFile } from "@/lib/local-store";
import type { MemoryRecord } from "@/types/knowledge";

type Store = { memories: MemoryRecord[]; memoryEnabledByUser: Record<string, boolean> };

async function load(): Promise<Store> {
  return readJsonFile<Store>("memory.json", {
    memories: [],
    memoryEnabledByUser: {},
  });
}

async function save(store: Store) {
  await writeJsonFile("memory.json", store);
}

function now() {
  return new Date().toISOString();
}

export const memoryRepository = {
  async list(userId: string) {
    const store = await load();
    return store.memories
      .filter((m) => m.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async isEnabled(userId: string) {
    const store = await load();
    return store.memoryEnabledByUser[userId] ?? true;
  },

  async setEnabled(userId: string, enabled: boolean) {
    const store = await load();
    store.memoryEnabledByUser[userId] = enabled;
    await save(store);
    return enabled;
  },

  async create(userId: string, input: { content: string; category?: string }) {
    const store = await load();
    const stamp = now();
    const memory: MemoryRecord = {
      id: crypto.randomUUID(),
      userId,
      content: input.content.trim(),
      category: input.category?.trim() || null,
      enabled: true,
      createdAt: stamp,
      updatedAt: stamp,
    };
    store.memories.unshift(memory);
    await save(store);
    return memory;
  },

  async update(
    userId: string,
    id: string,
    patch: Partial<Pick<MemoryRecord, "content" | "category" | "enabled">>,
  ) {
    const store = await load();
    const memory = store.memories.find((m) => m.id === id && m.userId === userId);
    if (!memory) return null;
    if (patch.content !== undefined) memory.content = patch.content;
    if (patch.category !== undefined) memory.category = patch.category;
    if (patch.enabled !== undefined) memory.enabled = patch.enabled;
    memory.updatedAt = now();
    await save(store);
    return memory;
  },

  async remove(userId: string, id: string) {
    const store = await load();
    const before = store.memories.length;
    store.memories = store.memories.filter((m) => !(m.id === id && m.userId === userId));
    await save(store);
    return store.memories.length < before;
  },

  async activeForPrompt(userId: string) {
    const enabled = await this.isEnabled(userId);
    if (!enabled) return [];
    const list = await this.list(userId);
    return list.filter((m) => m.enabled).slice(0, 20);
  },
};
