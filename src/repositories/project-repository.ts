import { readJsonFile, writeJsonFile } from "@/lib/local-store";
import type { ProjectRecord } from "@/types/knowledge";

type Store = { projects: ProjectRecord[] };

async function load(): Promise<Store> {
  return readJsonFile<Store>("projects.json", { projects: [] });
}

async function save(store: Store) {
  await writeJsonFile("projects.json", store);
}

function now() {
  return new Date().toISOString();
}

export const projectRepository = {
  async list(userId: string) {
    const store = await load();
    return store.projects
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(userId: string, id: string) {
    const store = await load();
    return store.projects.find((p) => p.id === id && p.userId === userId) ?? null;
  },

  async create(
    userId: string,
    input: { name: string; description?: string; instructions?: string },
  ) {
    const store = await load();
    const stamp = now();
    const project: ProjectRecord = {
      id: crypto.randomUUID(),
      userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      fileIds: [],
      chatIds: [],
      knowledgeBaseIds: [],
      createdAt: stamp,
      updatedAt: stamp,
    };
    store.projects.unshift(project);
    await save(store);
    return project;
  },

  async update(
    userId: string,
    id: string,
    patch: Partial<Pick<ProjectRecord, "name" | "description" | "instructions">>,
  ) {
    const store = await load();
    const project = store.projects.find((p) => p.id === id && p.userId === userId);
    if (!project) return null;
    if (patch.name !== undefined) project.name = patch.name;
    if (patch.description !== undefined) project.description = patch.description;
    if (patch.instructions !== undefined) project.instructions = patch.instructions;
    project.updatedAt = now();
    await save(store);
    return project;
  },

  async remove(userId: string, id: string) {
    const store = await load();
    const before = store.projects.length;
    store.projects = store.projects.filter((p) => !(p.id === id && p.userId === userId));
    await save(store);
    return store.projects.length < before;
  },

  async attachFile(userId: string, projectId: string, fileId: string) {
    const store = await load();
    const project = store.projects.find((p) => p.id === projectId && p.userId === userId);
    if (!project) return null;
    if (!project.fileIds.includes(fileId)) project.fileIds.push(fileId);
    project.updatedAt = now();
    await save(store);
    return project;
  },
};
