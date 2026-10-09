"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Clock, Loader2, MapPin, Search, X } from "lucide-react";
import { CATEGORY_EMOJI, CATEGORY_ORDER, detectCategory, type MapCategoryKey } from "@/lib/maps/intent";
import { categoryLabel } from "@/lib/maps/labels";
import { suggestPlaces } from "@/lib/maps/client";
import type { RecentSearch, SavedPlace } from "@/lib/maps/storage";
import type { LatLng, MapPlace } from "@/providers/maps/types";
import { cn } from "@/lib/utils";

const SUGGEST_DEBOUNCE_MS = 250;

type Item =
  | { kind: "category"; key: MapCategoryKey; label: string }
  | { kind: "saved"; saved: SavedPlace }
  | { kind: "recent"; recent: RecentSearch }
  | { kind: "place"; place: MapPlace };

const SAVED_EMOJI: Record<SavedPlace["kind"], string> = { home: "🏠", work: "💼", favorite: "⭐" };

export function SearchBox({
  value,
  loading,
  near,
  locale,
  recent,
  saved,
  t,
  onChange,
  onSubmit,
  onClear,
  onPickCategory,
  onPickPlace,
  inputRef,
}: {
  value: string;
  loading: boolean;
  near: LatLng | null;
  locale: string;
  recent: RecentSearch[];
  saved: SavedPlace[];
  t: (key: string) => string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onClear: () => void;
  onPickCategory: (key: MapCategoryKey) => void;
  onPickPlace: (place: MapPlace) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [remote, setRemote] = useState<{ q: string; places: MapPlace[] }>({ q: "", places: [] });
  const [fetching, setFetching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef(near);
  useEffect(() => {
    nearRef.current = near;
  }, [near]);

  const q = value.trim();

  // Live suggestions from the autocomplete provider (debounced, previous request cancelled).
  useEffect(() => {
    if (!open || q.length < 2) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      setFetching(true);
      suggestPlaces({ q, near: nearRef.current, locale }, ctrl.signal)
        .then((res) => setRemote({ q, places: res.places }))
        .catch(() => setRemote({ q, places: [] }))
        .finally(() => {
          if (!ctrl.signal.aborted) setFetching(false);
        });
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [locale, open, q]);

  const items = useMemo<Item[]>(() => {
    const lower = q.toLowerCase();
    if (!lower) {
      const pinned = [...saved].sort((a, b) => rank(a.kind) - rank(b.kind)).slice(0, 4);
      return [
        ...pinned.map((s) => ({ kind: "saved" as const, saved: s })),
        ...recent.slice(0, 5).map((r) => ({ kind: "recent" as const, recent: r })),
      ];
    }
    const detected = detectCategory(q);
    const cats = CATEGORY_ORDER.filter((key) => {
      const label = categoryLabel(key, locale).toLowerCase();
      return key === detected || (lower.length >= 2 && label.startsWith(lower));
    })
      .slice(0, 2)
      .map((key) => ({ kind: "category" as const, key, label: categoryLabel(key, locale) }));
    const savedHits = saved
      .filter((s) => s.name.toLowerCase().includes(lower))
      .slice(0, 2)
      .map((s) => ({ kind: "saved" as const, saved: s }));
    const recentHits = recent
      .filter((r) => r.label.toLowerCase().includes(lower) && r.label.toLowerCase() !== lower)
      .slice(0, 2)
      .map((r) => ({ kind: "recent" as const, recent: r }));
    const places = remote.q === q ? remote.places.map((p) => ({ kind: "place" as const, place: p })) : [];
    return [...cats, ...savedHits, ...recentHits, ...places];
  }, [locale, q, recent, remote, saved]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  function pick(item: Item) {
    setOpen(false);
    setActive(-1);
    switch (item.kind) {
      case "category":
        onPickCategory(item.key);
        break;
      case "recent":
        if (item.recent.cat) onPickCategory(item.recent.cat);
        else onSubmit(item.recent.q ?? item.recent.label);
        break;
      case "saved":
        onPickPlace({
          id: `saved:${item.saved.id}`,
          name: item.saved.name,
          address: item.saved.address ?? "",
          location: { lat: item.saved.lat, lng: item.saved.lng },
          category: item.saved.category,
          source: "saved",
        });
        break;
      case "place":
        onPickPlace(item.place);
        break;
    }
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (items.length ? (i + 1) % items.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (items.length ? (i <= 0 ? items.length - 1 : i - 1) : -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Enter" && open && active >= 0 && items[active]) {
      e.preventDefault();
      pick(items[active]!);
    }
  }

  const showList = open && (items.length > 0 || (fetching && q.length >= 2));

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1">
      <form
        role="search"
        className="flex min-w-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 transition-colors focus-within:border-[var(--ring)] focus-within:bg-[var(--surface)]"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
          if (q) onSubmit(q);
          inputRef.current?.blur();
        }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--fg-subtle)]" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("maps.searchPlaceholder")}
          aria-label={t("maps.searchPlaceholder")}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          enterKeyHint="search"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--fg-subtle)] sm:text-[14px]"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            aria-label={t("maps.clear")}
            className="grid h-6 w-6 place-items-center rounded-full text-[var(--fg-subtle)] hover:bg-[var(--surface-3)]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </form>

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-[1200] max-h-[min(60vh,420px)] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-lg)] [animation:njRise_160ms_ease-out]"
        >
          {!q && items.length ? (
            <li className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
              {t("maps.quickAccess")}
            </li>
          ) : null}
          {items.map((item, i) => (
            <li
              key={keyOf(item, i)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(item)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px]",
                i === active ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]",
              )}
            >
              <ItemIcon item={item} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[var(--fg)]">{titleOf(item, t)}</span>
                {subtitleOf(item, t) ? (
                  <span className="block truncate text-[12px] text-[var(--fg-muted)]">{subtitleOf(item, t)}</span>
                ) : null}
              </span>
            </li>
          ))}
          {fetching && q.length >= 2 && remote.q !== q ? (
            <li className="flex items-center gap-2 px-2.5 py-2 text-[12.5px] text-[var(--fg-subtle)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("maps.loading.search")}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function rank(kind: SavedPlace["kind"]) {
  return kind === "home" ? 0 : kind === "work" ? 1 : 2;
}

function keyOf(item: Item, i: number) {
  switch (item.kind) {
    case "category":
      return `c:${item.key}`;
    case "saved":
      return `s:${item.saved.id}`;
    case "recent":
      return `r:${item.recent.label}:${i}`;
    case "place":
      return `p:${item.place.id}:${i}`;
  }
}

function ItemIcon({ item }: { item: Item }) {
  const cls = "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-[15px]";
  switch (item.kind) {
    case "category":
      return <span className={cls}>{CATEGORY_EMOJI[item.key]}</span>;
    case "saved":
      return <span className={cls}>{SAVED_EMOJI[item.saved.kind]}</span>;
    case "recent":
      return (
        <span className={cls}>
          <Clock className="h-4 w-4 text-[var(--fg-subtle)]" />
        </span>
      );
    case "place":
      return (
        <span className={cls}>
          {CATEGORY_EMOJI[item.place.category as MapCategoryKey] ?? <MapPin className="h-4 w-4 text-[var(--accent)]" />}
        </span>
      );
  }
}

function titleOf(item: Item, t: (key: string) => string): string {
  switch (item.kind) {
    case "category":
      return `${item.label} — ${t("maps.nearMe")}`;
    case "saved":
      return item.saved.kind === "favorite" ? item.saved.name : t(`maps.saved.${item.saved.kind}`);
    case "recent":
      return item.recent.label;
    case "place":
      return item.place.name;
  }
}

function subtitleOf(item: Item, t: (key: string) => string): string {
  switch (item.kind) {
    case "category":
      return t("maps.categorySearch");
    case "saved":
      return item.saved.kind === "favorite" ? (item.saved.address ?? "") : item.saved.name;
    case "recent":
      return t("maps.recentSearch");
    case "place":
      return item.place.address;
  }
}