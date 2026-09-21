import { NextResponse } from "next/server";
import {
  FREE_LIMITS,
  isUsageLimited,
  usageRepository,
} from "@/repositories/usage-repository";
import { getRequestUserId } from "@/server/session";

export async function GET() {
  const userId = await getRequestUserId();
  const records = await usageRepository.summary(userId);
  const messages = records.find((r) => r.metric === "messages")?.amount ?? 0;
  const limited = isUsageLimited(FREE_LIMITS.messages);

  return NextResponse.json({
    period: records[0]?.periodKey ?? null,
    usage: records,
    limits: FREE_LIMITS,
    unlimited: !limited,
    remaining: {
      messages: limited ? Math.max(0, FREE_LIMITS.messages! - messages) : null,
    },
  });
}
