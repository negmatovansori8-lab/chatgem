import {
  Bell,
  Bot,
  Info,
  Languages,
  Lock,
  Map as MapIcon,
  MessageSquare,
  Mic,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";

export const SECTION_IDS = [
  "general",
  "appearance",
  "language",
  "notifications",
  "chat",
  "ai",
  "voice",
  "maps",
  "account",
  "privacy",
  "security",
  "about",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;

export const SECTIONS: Record<SectionId, { icon: IconType; labelKey: string; descKey: string }> = {
  general: { icon: SlidersHorizontal, labelKey: "settings.general", descKey: "settingsUi.desc.general" },
  appearance: { icon: Palette, labelKey: "settings.appearance", descKey: "settingsUi.desc.appearance" },
  language: { icon: Languages, labelKey: "nav.language", descKey: "settingsUi.desc.language" },
  notifications: { icon: Bell, labelKey: "settings.notifications", descKey: "settingsUi.desc.notifications" },
  chat: { icon: MessageSquare, labelKey: "settingsUi.nav.chat", descKey: "settingsUi.desc.chat" },
  ai: { icon: Bot, labelKey: "settingsUi.nav.ai", descKey: "settingsUi.desc.ai" },
  voice: { icon: Mic, labelKey: "settings.voice", descKey: "settingsUi.desc.voice" },
  maps: { icon: MapIcon, labelKey: "sidebar.maps", descKey: "settingsUi.desc.maps" },
  account: { icon: UserRound, labelKey: "settings.account", descKey: "settingsUi.desc.account" },
  privacy: { icon: Lock, labelKey: "settingsUi.nav.privacy", descKey: "settingsUi.desc.privacy" },
  security: { icon: ShieldCheck, labelKey: "settings.security", descKey: "settingsUi.desc.security" },
  about: { icon: Info, labelKey: "settingsUi.nav.about", descKey: "settingsUi.desc.about" },
};

export const SECTION_GROUPS: { labelKey: string; ids: SectionId[] }[] = [
  { labelKey: "settingsUi.group.preferences", ids: ["general", "appearance", "language", "notifications"] },
  { labelKey: "settingsUi.group.assistant", ids: ["chat", "ai", "voice", "maps"] },
  { labelKey: "settingsUi.group.account", ids: ["account", "privacy", "security"] },
  { labelKey: "settingsUi.group.app", ids: ["about"] },
];

/** Panel names used by the previous settings screen, so old links still land somewhere sensible. */
const LEGACY: Record<string, SectionId> = {
  personalization: "ai",
  memory: "ai",
  plugins: "chat",
  parental: "security",
  age: "security",
  safety: "security",
  email: "account",
  plan: "account",
  usage: "account",
  workspace: "account",
  remote: "privacy",
  storage: "privacy",
  data: "privacy",
  ads: "privacy",
  bug: "about",
  info: "about",
};

export function toSectionId(value: string | null | undefined): SectionId | null {
  if (!value) return null;
  if ((SECTION_IDS as readonly string[]).includes(value)) return value as SectionId;
  return LEGACY[value] ?? null;
}
