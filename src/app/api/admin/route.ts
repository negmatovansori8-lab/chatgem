import { NextResponse } from "next/server";
import { buildAnalytics } from "@/repositories/business-analytics";
import { subscriptionRepository } from "@/repositories/subscription-repository";
import { getRequestUserId } from "@/server/session";
import { getSessionUser } from "@/server/auth/session";
import { isAdminRole, resolveRole } from "@/server/auth/roles";
import { PLANS } from "@/types/business";
import { featureFlags } from "@/config/site";
import { readJsonFile } from "@/lib/local-store";
import { isStripeConfigured } from "@/lib/stripe";

/**
 * Admin panel — only ADMIN / SUPER_ADMIN.
 */
export async function GET() {
  const session = await getSessionUser();
  const role = session ? resolveRole(session.email) : "USER";

  if (!session || !isAdminRole(role)) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message:
            "Танҳо админ дастрасӣ дорад. Бо почтаи админ ворид шавед (масалан negmatovansori8@gmail.com).",
        },
      },
      { status: 403 },
    );
  }

  const userId = await getRequestUserId();
  const analytics = await buildAnalytics(userId);
  const subscription = await subscriptionRepository.get(userId);

  const chatsStore = await readJsonFile<{ chats: unknown[] }>("chats.json", { chats: [] });
  const filesStore = await readJsonFile<{ files: unknown[] }>("files.json", { files: [] });
  const projectsStore = await readJsonFile<{ projects: unknown[] }>("projects.json", {
    projects: [],
  });
  const agentsStore = await readJsonFile<{ agents: unknown[] }>("agents.json", { agents: [] });
  const subsStore = await readJsonFile<{ subscriptions: unknown[] }>("subscriptions.json", {
    subscriptions: [],
  });

  return NextResponse.json({
    health: {
      status: "ok",
      timestamp: new Date().toISOString(),
      paymentsConfigured: featureFlags.paymentsConfigured || isStripeConfigured(),
      aiConfigured: featureFlags.aiProvidersConfigured || Boolean(process.env.OPENAI_API_KEY),
      stripeReady: isStripeConfigured(),
    },
    totals: {
      chats: chatsStore.chats.length,
      files: filesStore.files.length,
      projects: projectsStore.projects.length,
      agents: agentsStore.agents.length,
      subscriptions: subsStore.subscriptions.length,
    },
    currentUser: {
      userId,
      email: session.email,
      name: session.name,
      role,
      subscription,
      analytics,
    },
    plans: PLANS,
    note:
      role === "SUPER_ADMIN"
        ? "Шумо SUPER_ADMIN ҳастед — панели пурраи система."
        : "Шумо ADMIN ҳастед.",
  });
}
