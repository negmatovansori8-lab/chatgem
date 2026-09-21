export type UserPrefs = {
  nickname: string;
  profession: string;
  aboutYou: string;
  customStyle: string;
  parentalOn: boolean;
  familyMembers: string[];
  safetyStrict: boolean;
  notificationsOn: boolean;
  notifyEmail: boolean;
  notifyPush: boolean;
  voicePrefer: boolean;
  adsOff: boolean;
  remoteOff: boolean;
  pluginLowRisk: boolean;
  ageVerified: boolean;
  accentId: string;
};

export const DEFAULT_PREFS: UserPrefs = {
  nickname: "",
  profession: "",
  aboutYou: "",
  customStyle: "",
  parentalOn: false,
  familyMembers: [],
  safetyStrict: false,
  notificationsOn: true,
  notifyEmail: true,
  notifyPush: false,
  voicePrefer: false,
  adsOff: false,
  remoteOff: true,
  pluginLowRisk: true,
  ageVerified: false,
  accentId: "blue",
};

export function prefsToSystemBlock(prefs: UserPrefs): string | null {
  const lines: string[] = [];
  if (prefs.nickname.trim()) lines.push(`- Nickname: ${prefs.nickname.trim()}`);
  if (prefs.profession.trim())
    lines.push(`- Profession: ${prefs.profession.trim()}`);
  if (prefs.aboutYou.trim()) lines.push(`- About user: ${prefs.aboutYou.trim()}`);
  if (prefs.customStyle.trim())
    lines.push(`- Custom instructions (always follow): ${prefs.customStyle.trim()}`);
  if (prefs.parentalOn || prefs.safetyStrict) {
    lines.push(
      "- SAFETY: Prefer safer, simpler answers; avoid adult/violent topics.",
    );
  }
  if (prefs.voicePrefer) {
    lines.push("- Prefer concise answers suitable for reading aloud.");
  }
  if (!lines.length) return null;
  return "User personalization settings:\n" + lines.join("\n");
}
