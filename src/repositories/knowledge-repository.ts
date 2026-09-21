import { readJsonFile, writeJsonFile } from "@/lib/local-store";
import type { KnowledgeBaseRecord, KnowledgeItemRecord } from "@/types/knowledge";

type Store = {
  bases: KnowledgeBaseRecord[];
  items: KnowledgeItemRecord[];
};

async function load(): Promise<Store> {
  return readJsonFile<Store>("knowledge.json", { bases: [], items: [] });
}

async function save(store: Store) {
  await writeJsonFile("knowledge.json", store);
}

function now() {
  return new Date().toISOString();
}

export const knowledgeRepository = {
  async listBases(userId: string) {
    const store = await load();
    return store.bases
      .filter((b) => b.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getBase(userId: string, id: string) {
    const store = await load();
    const base = store.bases.find((b) => b.id === id && b.userId === userId);
    if (!base) return null;
    const items = store.items
      .filter((i) => i.knowledgeBaseId === id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { base, items };
  },

  async createBase(
    userId: string,
    input: { name: string; description?: string; projectId?: string | null },
  ) {
    const store = await load();
    const stamp = now();
    const base: KnowledgeBaseRecord = {
      id: crypto.randomUUID(),
      userId,
      projectId: input.projectId ?? null,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      itemIds: [],
      createdAt: stamp,
      updatedAt: stamp,
    };
    store.bases.unshift(base);
    await save(store);
    return base;
  },

  async removeBase(userId: string, id: string) {
    const store = await load();
    const before = store.bases.length;
    store.bases = store.bases.filter((b) => !(b.id === id && b.userId === userId));
    store.items = store.items.filter((i) => i.knowledgeBaseId !== id);
    await save(store);
    return store.bases.length < before;
  },

  async addItem(
    userId: string,
    knowledgeBaseId: string,
    input: { title: string; content: string; fileId?: string | null },
  ) {
    const store = await load();
    const base = store.bases.find((b) => b.id === knowledgeBaseId && b.userId === userId);
    if (!base) return null;
    const stamp = now();
    const item: KnowledgeItemRecord = {
      id: crypto.randomUUID(),
      knowledgeBaseId,
      fileId: input.fileId ?? null,
      title: input.title.trim(),
      content: input.content,
      createdAt: stamp,
      updatedAt: stamp,
    };
    store.items.unshift(item);
    base.itemIds.push(item.id);
    base.updatedAt = stamp;
    await save(store);
    return item;
  },

  async removeItem(userId: string, knowledgeBaseId: string, itemId: string) {
    const store = await load();
    const base = store.bases.find((b) => b.id === knowledgeBaseId && b.userId === userId);
    if (!base) return false;
    store.items = store.items.filter((i) => i.id !== itemId);
    base.itemIds = base.itemIds.filter((id) => id !== itemId);
    base.updatedAt = now();
    await save(store);
    return true;
  },

  async search(userId: string, knowledgeBaseId: string, query: string) {
    const bundle = await this.getBase(userId, knowledgeBaseId);
    if (!bundle) return [];
    const q = query.toLowerCase();
    return bundle.items.filter(
      (i) => i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q),
    );
  },
};
