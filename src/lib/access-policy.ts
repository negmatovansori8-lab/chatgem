import { proNudgeDue } from "@/lib/pro-nudge";

/** Free chats after the first month. Admins and paid plans are not capped. */
export const FREE_DAILY_MESSAGES = 10;

export function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Next UTC midnight, when the free daily count starts again. */
export function nextDayReset(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  ).toISOString();
}

/**
 * A limit applies when the person is not an admin, has not bought Pro,
 * and the first free month is over. Guests have no trial date, so they are limited.
 */
export function freeLimitApplies(input: {
  role?: string | null;
  planId?: string | null;
  createdAt?: string | null;
  now?: Date;
}) {
  if (input.role === "ADMIN" || input.role === "SUPER_ADMIN") return false;
  if (input.planId === "pro" || input.planId === "business") return false;
  if (input.createdAt && !proNudgeDue(input.createdAt, input.now)) return false;
  return true;
}
