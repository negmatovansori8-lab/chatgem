/**
 * Remembers which media were already saved on this device, so the button shows
 * «Downloaded» and asks before saving a second copy.
 */

const STORAGE_KEY = "nj_downloads_v1";
const MAX_ENTRIES = 300;
const EVENT = "nj-downloads-change";

type Entry = { name: string; at: number };
type Store = Record<string, Entry>;

let cache: Store | null = null;

function read(): Store {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    cache = parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    cache = {};
  }
  return cache;
}

/** Stable key for a media source; large data URLs are sampled instead of hashed whole. */
export function downloadKey(source: string): string {
  const sample =
    source.length > 8192 ? `${source.length}:${source.slice(0, 4096)}${source.slice(-4096)}` : source;
  let h = 0x811c9dc5;
  for (let i = 0; i < sample.length; i++) {
    h ^= sample.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function downloadedName(key: string): string | null {
  if (typeof window === "undefined") return null;
  return read()[key]?.name ?? null;
}

export function rememberDownload(key: string, name: string) {
  const next: Store = { ...read(), [key]: { name, at: Date.now() } };
  const keys = Object.keys(next);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => next[a]!.at - next[b]!.at)
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete next[k]);
  }
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or disabled — the in-memory cache still works this session.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeDownloads(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cache = null;
    onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
