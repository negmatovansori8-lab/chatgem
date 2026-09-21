import { NextResponse } from "next/server";
import { getRequestUserId } from "@/server/session";
import { prefsRepository, type UserPrefs } from "@/repositories/prefs-repository";

export async function GET() {
  const userId = await getRequestUserId();
  const prefs = await prefsRepository.get(userId);
  return NextResponse.json({ prefs });
}

export async function PATCH(req: Request) {
  const userId = await getRequestUserId();
  let body: Partial<UserPrefs> = {};
  try {
    body = (await req.json()) as Partial<UserPrefs>;
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON" } },
      { status: 400 },
    );
  }

  const allowed: (keyof UserPrefs)[] = [
    "nickname",
    "profession",
    "aboutYou",
    "customStyle",
    "parentalOn",
    "familyMembers",
    "safetyStrict",
    "notificationsOn",
    "notifyEmail",
    "notifyPush",
    "voicePrefer",
    "adsOff",
    "remoteOff",
    "pluginLowRisk",
    "ageVerified",
    "accentId",
  ];

  const patch: Partial<UserPrefs> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const value = body[key];
      if (value !== undefined) {
        Object.assign(patch, { [key]: value });
      }
    }
  }

  const prefs = await prefsRepository.patch(userId, patch);
  return NextResponse.json({ prefs });
}
