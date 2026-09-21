import { readJsonFile, writeJsonFile } from "@/lib/local-store";
import {
  DEFAULT_PREFS,
  type UserPrefs,
  prefsToSystemBlock,
} from "@/lib/prefs-types";

export type { UserPrefs };
export { DEFAULT_PREFS, prefsToSystemBlock };

type Store = Record<string, UserPrefs>;

export const prefsRepository = {
  async get(userId: string): Promise<UserPrefs> {
    const store = await readJsonFile<Store>("user-prefs.json", {});
    return { ...DEFAULT_PREFS, ...(store[userId] ?? {}) };
  },

  async patch(userId: string, patch: Partial<UserPrefs>): Promise<UserPrefs> {
    const store = await readJsonFile<Store>("user-prefs.json", {});
    const next = { ...DEFAULT_PREFS, ...(store[userId] ?? {}), ...patch };
    store[userId] = next;
    await writeJsonFile("user-prefs.json", store);
    return next;
  },
};
