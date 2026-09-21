import { NextResponse } from "next/server";
import { buildAnalytics } from "@/repositories/business-analytics";
import { getRequestUserId } from "@/server/session";

export async function GET() {
  const userId = await getRequestUserId();
  const analytics = await buildAnalytics(userId);
  return NextResponse.json({ analytics });
}
