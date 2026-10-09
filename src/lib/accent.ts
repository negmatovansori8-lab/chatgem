export const ACCENT_STORAGE_KEY = "nj_accent_v2";

/** `teal` is the brand default: it clears the overrides so the theme tokens in globals.css apply. */
export const ACCENTS = [
  { id: "teal", labelKey: "settings.accentTeal", color: "#0d9488" },
  { id: "blue", labelKey: "settings.accentBlue", color: "#3b82f6" },
  { id: "violet", labelKey: "settings.accentViolet", color: "#8b5cf6" },
  { id: "emerald", labelKey: "settings.accentEmerald", color: "#10b981" },
  { id: "rose", labelKey: "settings.accentRose", color: "#f43f5e" },
  { id: "amber", labelKey: "settings.accentAmber", color: "#f59e0b" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export const DEFAULT_ACCENT: AccentId = "teal";

const ACCENT_VARS = ["--accent", "--accent-2", "--accent-fg", "--accent-muted", "--accent-glow", "--ring"] as const;

export function accentVars(color: string): Record<(typeof ACCENT_VARS)[number], string> {
  return {
    "--accent": color,
    "--accent-2": `color-mix(in oklab, ${color} 82%, black)`,
    "--accent-fg": "#ffffff",
    "--accent-muted": `color-mix(in oklab, ${color} 16%, transparent)`,
    "--accent-glow": `color-mix(in oklab, ${color} 40%, transparent)`,
    "--ring": color,
  };
}

export function isAccentId(value: unknown): value is AccentId {
  return ACCENTS.some((a) => a.id === value);
}

export function applyAccent(id: string) {
  const root = document.documentElement;
  const found = ACCENTS.find((a) => a.id === id);
  if (!found || found.id === DEFAULT_ACCENT) {
    for (const name of ACCENT_VARS) root.style.removeProperty(name);
    return;
  }
  for (const [name, value] of Object.entries(accentVars(found.color))) {
    root.style.setProperty(name, value);
  }
}

export function storeAccent(id: string) {
  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, id);
  } catch {
    // storage may be unavailable (private mode)
  }
  applyAccent(id);
}

export function storedAccent(): string {
  try {
    return window.localStorage.getItem(ACCENT_STORAGE_KEY) || DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}
