import { NextResponse } from "next/server";
import { WORLD_LOCALES } from "@/lib/i18n";
import { listSelectableModels, bootstrapProviders } from "@/providers/ai/registry";
import { getOAuthProviderStatus } from "@/server/auth/providers";

export async function GET() {
  bootstrapProviders();
  const models = listSelectableModels().filter((m) => m.configured);
  const oauth = getOAuthProviderStatus().filter((p) => p.configured);

  return NextResponse.json({
    status: "ok",
    service: "chatgem",
    timestamp: new Date().toISOString(),
    locales: WORLD_LOCALES.length,
    uptimeSec: Math.round(process.uptime()),
    ai: {
      configured: models.length > 0,
      models: models.map((m) => m.id),
      flag: process.env.AI_PROVIDERS_CONFIGURED === "true",
    },
    auth: {
      google: oauth.some((p) => p.id === "google"),
      github: oauth.some((p) => p.id === "github"),
    },
  });
}
