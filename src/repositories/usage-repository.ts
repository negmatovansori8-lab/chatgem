import { readJsonFile, writeJsonFile } from "@/lib/local-store";
import type { UsageRecord } from "@/types/chat";

function periodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const usageRepository = {
  async get(userId: string, metric: string) {
    const records = await readJsonFile<UsageRecord[]>("usage.json", []);
    const key = periodKey();
    return (
      records.find((r) => r.userId === userId && r.metric === metric && r.periodKey === key) ?? {
        userId,
        metric,
        amount: 0,
        periodKey: key,
      }
    );
  },

  async increment(userId: string, metric: string, amount = 1) {
    const records = await readJsonFile<UsageRecord[]>("usage.json", []);
    const key = periodKey();
    const existing = records.find(
      (r) => r.userId === userId && r.metric === metric && r.periodKey === key,
    );
    if (existing) {
      existing.amount += amount;
    } else {
      records.push({ userId, metric, amount, periodKey: key });
    }
    await writeJsonFile("usage.json", records);
    return existing ?? records[records.length - 1];
  },

  async summary(userId: string) {
    const records = await readJsonFile<UsageRecord[]>("usage.json", []);
    const key = periodKey();
    return records.filter((r) => r.userId === userId && r.periodKey === key);
  },
};

/** null = unlimited (no hard cap enforced) */
export const FREE_LIMITS = {
  messages: null as number | null,
  tokens: null as number | null,
};

export function isUsageLimited(limit: number | null) {
  return typeof limit === "number" && Number.isFinite(limit) && limit >= 0;
}
