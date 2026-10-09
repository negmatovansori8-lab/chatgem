import {
  FREE_DAILY_MESSAGES,
  dayKey,
  freeLimitApplies,
  nextDayReset,
} from "@/lib/access-policy";
import { usageRepository } from "@/repositories/usage-repository";
import { subscriptionRepository } from "@/repositories/subscription-repository";
import { getSessionUser } from "@/server/auth/session";

export type FreeTurn =
  | { ok: true }
  | { ok: false; resetAt: string; limit: number };

/** One chat or image counts. Admins and Pro are never counted. */
export async function consumeFreeTurn(fallbackUserId: string): Promise<FreeTurn> {
  const session = await getSessionUser();
  const userId = session?.id ?? fallbackUserId;
  const planId = session
    ? (await subscriptionRepository.get(session.id)).planId
    : "free";
  if (
    !freeLimitApplies({
      role: session?.role,
      planId,
      createdAt: session?.createdAt ?? null,
    })
  ) {
    return { ok: true };
  }

  const period = dayKey();
  const used = (await usageRepository.get(userId, "free-day", period)).amount;
  if (used >= FREE_DAILY_MESSAGES) {
    return { ok: false, resetAt: nextDayReset(), limit: FREE_DAILY_MESSAGES };
  }
  await usageRepository.increment(userId, "free-day", 1, period);
  return { ok: true };
}

export async function freeTurnStatus(fallbackUserId: string) {
  const session = await getSessionUser();
  const userId = session?.id ?? fallbackUserId;
  const planId = session
    ? (await subscriptionRepository.get(session.id)).planId
    : "free";
  const applies = freeLimitApplies({
    role: session?.role,
    planId,
    createdAt: session?.createdAt ?? null,
  });
  if (!applies) {
    return { limited: false, remaining: null as number | null, resetAt: null as string | null, limit: null as number | null };
  }
  const used = (await usageRepository.get(userId, "free-day", dayKey())).amount;
  return {
    limited: true,
    remaining: Math.max(0, FREE_DAILY_MESSAGES - used),
    resetAt: nextDayReset(),
    limit: FREE_DAILY_MESSAGES,
  };
}
