import { NextResponse } from "next/server";
import {
  FREE_LIMITS,
  isUsageLimited,
  usageRepository,
} from "@/repositories/usage-repository";
import { freeTurnStatus } from "@/server/free-limit";
import { getRequestUserId } from "@/server/session";

export async function GET() {
  const userId = await getRequestUserId();
  const records = await usageRepository.summary(userId);
  const messages = records.find((r) => r.metric === "messages")?.amount ?? 0;
  const limited = isUsageLimited(FREE_LIMITS.messages);

  const free = await freeTurnStatus(userId);

  return NextResponse.json({
    period: records[0]?.periodKey ?? null,
    usage: records,
    limits: FREE_LIMITS,
    unlimited: !limited && !free.limited,
    remaining: {
      messages: free.limited ? free.remaining : limited ? Math.max(0, FREE_LIMITS.messages! - messages) : null,
    },
    free,
  });
}
