import { readJsonFile, writeJsonFile } from "@/lib/local-store";
import type { ReferralRecord } from "@/types/business";
import { chatRepository } from "@/repositories/chat-repository";
import { projectRepository } from "@/repositories/project-repository";
import { fileRepository } from "@/repositories/file-repository";
import { agentRepository } from "@/repositories/agent-repository";
import { usageRepository } from "@/repositories/usage-repository";

type Store = { referrals: ReferralRecord[] };

async function load(): Promise<Store> {
  return readJsonFile<Store>("referrals.json", { referrals: [] });
}

async function save(store: Store) {
  await writeJsonFile("referrals.json", store);
}

function codeFor(userId: string) {
  return `NJ-${userId.slice(-6).toUpperCase()}`;
}

export const referralRepository = {
  async getOrCreate(userId: string) {
    const store = await load();
    let existing = store.referrals.find((r) => r.userId === userId);
    if (!existing) {
      existing = {
        id: crypto.randomUUID(),
        userId,
        code: codeFor(userId),
        invites: 0,
        conversions: 0,
        createdAt: new Date().toISOString(),
      };
      store.referrals.push(existing);
      await save(store);
    }
    return existing;
  },

  async trackInvite(userId: string) {
    const record = await this.getOrCreate(userId);
    const store = await load();
    const target = store.referrals.find((r) => r.id === record.id);
    if (!target) return record;
    target.invites += 1;
    await save(store);
    return target;
  },
};

export async function buildAnalytics(userId: string) {
  const [chats, projects, files, agents, usage] = await Promise.all([
    chatRepository.listByUser(userId, { includeArchived: true }),
    projectRepository.list(userId),
    fileRepository.list(userId),
    agentRepository.list(userId),
    usageRepository.summary(userId),
  ]);
  const messages = usage.find((u) => u.metric === "messages")?.amount ?? 0;
  return {
    userId,
    chats: chats.length,
    messages,
    projects: projects.length,
    files: files.length,
    agents: agents.length,
    periodKey: usage[0]?.periodKey ?? new Date().toISOString().slice(0, 7),
  };
}
