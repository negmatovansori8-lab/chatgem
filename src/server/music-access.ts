import { musicSearchAllowed } from "@/lib/music-access";
import { subscriptionRepository } from "@/repositories/subscription-repository";
import { getSessionUser } from "@/server/auth/session";

export async function canUseProMusic() {
  const session = await getSessionUser();
  if (!session) return false;
  if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") return true;
  const planId = (await subscriptionRepository.get(session.id)).planId;
  return musicSearchAllowed({ role: session.role, planId });
}
