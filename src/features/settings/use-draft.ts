"use client";

import { useState } from "react";
import type { UserPrefs } from "@/lib/prefs-types";
import { useSettingsData } from "@/features/settings/settings-data";

type StringKey = { [K in keyof UserPrefs]: UserPrefs[K] extends string ? K : never }[keyof UserPrefs];

/** Unsaved text edits layered over the saved prefs; nothing is sent until `save()`. */
export function usePrefsDraft<K extends StringKey>(keys: readonly K[]) {
  const { prefs, savePrefs } = useSettingsData();
  const [edits, setEdits] = useState<Partial<Record<K, string>>>({});
  const [saving, setSaving] = useState(false);

  const value = (key: K) => edits[key] ?? prefs[key];
  const changed = keys.filter((k) => edits[k] !== undefined && edits[k] !== prefs[k]);

  return {
    value,
    set: (key: K, next: string) => setEdits((e) => ({ ...e, [key]: next })),
    dirty: changed.length > 0,
    saving,
    reset: () => setEdits({}),
    save: async () => {
      if (!changed.length) return;
      setSaving(true);
      const patch = Object.fromEntries(changed.map((k) => [k, (edits[k] ?? "").trim()])) as Partial<UserPrefs>;
      const ok = await savePrefs(patch);
      setSaving(false);
      if (ok) setEdits({});
    },
  };
}
