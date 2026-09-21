import { readJsonFile, writeJsonFile } from "@/lib/local-store";
import type { PlanId, SubscriptionRecord } from "@/types/business";

type Store = { subscriptions: SubscriptionRecord[] };

async function load(): Promise<Store> {
  return readJsonFile<Store>("subscriptions.json", { subscriptions: [] });
}

async function save(store: Store) {
  await writeJsonFile("subscriptions.json", store);
}

function isExpired(sub: SubscriptionRecord) {
  if (!sub.periodEnd) return false;
  return new Date(sub.periodEnd).getTime() < Date.now();
}

function normalize(sub: SubscriptionRecord): SubscriptionRecord {
  if (sub.planId !== "free" && isExpired(sub)) {
    return {
      ...sub,
      planId: "free",
      status: "EXPIRED",
      periodEnd: sub.periodEnd,
    };
  }
  return sub;
}

export const subscriptionRepository = {
  async get(userId: string): Promise<SubscriptionRecord> {
    const store = await load();
    const existing = store.subscriptions.find((s) => s.userId === userId);
    if (!existing) {
      return {
        userId,
        planId: "free",
        status: "ACTIVE",
        updatedAt: new Date().toISOString(),
        periodEnd: null,
        cardLast4: null,
      };
    }
    const normalized = normalize(existing);
    if (normalized.planId !== existing.planId || normalized.status !== existing.status) {
      existing.planId = normalized.planId;
      existing.status = normalized.status;
      existing.updatedAt = new Date().toISOString();
      await save(store);
    }
    return normalized;
  },

  async setPlan(userId: string, planId: PlanId, extras?: Partial<SubscriptionRecord>) {
    const store = await load();
    const existing = store.subscriptions.find((s) => s.userId === userId);
    const record: SubscriptionRecord = {
      userId,
      planId,
      status: "ACTIVE",
      updatedAt: new Date().toISOString(),
      periodEnd: extras?.periodEnd ?? null,
      cardLast4: extras?.cardLast4 ?? null,
    };
    if (existing) {
      Object.assign(existing, record);
      await save(store);
      return existing;
    }
    store.subscriptions.push(record);
    await save(store);
    return record;
  },

  /** Activate Pro (or Business) for exactly 1 month after Visa checkout. */
  async activatePaidMonth(
    userId: string,
    planId: Extract<PlanId, "pro" | "business">,
    cardLast4: string,
  ) {
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    return this.setPlan(userId, planId, {
      periodEnd: periodEnd.toISOString(),
      cardLast4,
      status: "ACTIVE",
    });
  },

  async isProOrBetter(userId: string) {
    const sub = await this.get(userId);
    return sub.planId === "pro" || sub.planId === "business";
  },
};
