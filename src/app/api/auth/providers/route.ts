import { NextResponse } from "next/server";
import { getOAuthProviderStatus } from "@/server/auth/providers";

export async function GET() {
  return NextResponse.json({ providers: getOAuthProviderStatus() });
}
