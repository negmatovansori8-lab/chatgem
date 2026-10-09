"use client";

import { CATEGORY_ORDER, type MapCategoryKey } from "@/lib/maps/intent";
import { cn } from "@/lib/utils";

export function CategoryBar({
  active,
  onPick,
  onOther,
  t,
}: {
  active: MapCategoryKey | null;
  onPick: (key: MapCategoryKey) => void;
  onOther: () => void;
  t: (key: string) => string;
}) {
  return (
    <nav
      aria-label={t("maps.categories")}
      className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {CATEGORY_ORDER.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onPick(key)}
          aria-pressed={active === key}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
            active === key
              ? "border-transparent bg-[var(--pill)] text-[var(--pill-fg)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-2)]",
          )}
        >
          {t(`maps.cat.${key}`)}
        </button>
      ))}
      <button
        type="button"
        onClick={onOther}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-[var(--border-strong)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
      >
        {t("maps.other")}
      </button>
    </nav>
  );
}
