"use client";

/**
 * Recent searches and saved places — kept only in this browser (localStorage),
 * never sent to the server. The user's own GPS position is never stored.
 */
import { useSyncExternalStore } from "react";
import type { MapCategoryKey } from "@/lib/maps/intent";

export type RecentSearch = { label: string; q?: string; cat?: MapCategoryKey; at: number };

export type SavedKind = "home" | "work" | "favorite";

export type SavedPlace = {
  id: string;
  kind: SavedKind;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  category?: string;
  savedAt: number;
};

const RECENT_KEY = "chatgem:maps:recent";
const SAVED_KEY = "chatgem:maps:saved";
const MAX_RECENT = 8;
const MAX_SAVED = 50;

type Store<T> = { key: string; value: T[]; listeners: Set<() => void>; loaded: boolean };

const recentStore: Store<RecentSearch> = { key: RECENT_KEY, value: [], listeners: new Set(), loaded: false };
const savedStore: Store<SavedPlace> = { key: SAVED_KEY, value: [], listeners: new Set(), loaded: false };
const EMPTY: never[] = [];

function load<T>(store: Store<T>, valid: (v: unknown) => v is T): T[] {
  if (!store.loaded && typeof window !== "undefined") {
    store.loaded = true;
    try {
      const raw = JSON.parse(localStorage.getItem(store.key) ?? "[]") as unknown;
      store.value = Array.isArray(raw) ? raw.filter(valid) : [];
    } catch {
      store.value = [];
    }
  }
  return store.value;
}

function save<T>(store: Store<T>, next: T[]) {
  store.value = next;
  try {
    localStorage.setItem(store.key, JSON.stringify(next));
  } catch {
    // storage full / private mode — keep in memory for this tab
  }
  store.listeners.forEach((l) => l());
}

function subscribe<T>(store: Store<T>) {
  return (cb: () => void) => {
    store.listeners.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== store.key) return;
      store.loaded = false;
      cb();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      store.listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  };
}

function isRecent(v: unknown): v is RecentSearch {
  const o = v as RecentSearch;
  return Boolean(o && typeof o.label === "string" && typeof o.at === "number");
}

function isSaved(v: unknown): v is SavedPlace {
  const o = v as SavedPlace;
  return Boolean(
    o &&
      typeof o.id === "string" &&
      typeof o.name === "string" &&
      Number.isFinite(o.lat) &&
      Number.isFinite(o.lng) &&
      (o.kind === "home" || o.kind === "work" || o.kind === "favorite"),
  );
}

const subscribeRecent = subscribe(recentStore);
const subscribeSaved = subscribe(savedStore);

export function useRecentSearches(): RecentSearch[] {
  return useSyncExternalStore(subscribeRecent, () => load(recentStore, isRecent), () => EMPTY);
}

export function useSavedPlaces(): SavedPlace[] {
  return useSyncExternalStore(subscribeSaved, () => load(savedStore, isSaved), () => EMPTY);
}

export function addRecentSearch(entry: Omit<RecentSearch, "at">) {
  const label = entry.label.trim().slice(0, 120);
  if (!label) return;
  const list = load(recentStore, isRecent).filter((r) => r.label.toLowerCase() !== label.toLowerCase());
  save(recentStore, [{ ...entry, label, at: Date.now() }, ...list].slice(0, MAX_RECENT));
}

export function clearRecentSearches() {
  save(recentStore, []);
}

function sameSpot(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5;
}

export function findSaved(list: SavedPlace[], place: { lat: number; lng: number }): SavedPlace | undefined {
  return list.find((s) => sameSpot(s, place));
}

/** Home/Work are unique: saving a new Home replaces the old one. */
export function savePlace(place: Omit<SavedPlace, "savedAt" | "id">) {
  const list = load(savedStore, isSaved).filter(
    (s) => !sameSpot(s, place) && (place.kind === "favorite" || s.kind !== place.kind),
  );
  const entry: SavedPlace = {
    ...place,
    name: place.name.slice(0, 120),
    address: place.address?.slice(0, 300),
    id: `${place.lat.toFixed(6)},${place.lng.toFixed(6)}`,
    savedAt: Date.now(),
  };
  save(savedStore, [entry, ...list].slice(0, MAX_SAVED));
}

export function removeSavedPlace(id: string) {
  save(
    savedStore,
    load(savedStore, isSaved).filter((s) => s.id !== id),
  );
}
