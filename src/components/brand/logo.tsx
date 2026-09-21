import Link from "next/link";
import { brand } from "@/config/site";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
  showWordmark = true,
}: {
  className?: string;
  href?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-lg",
        className,
      )}
      aria-label={`${brand.name} home`}
    >
      <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(145deg,var(--accent),var(--accent-2))] shadow-[0_8px_24px_-10px_var(--accent-glow)]">
        <span className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_20%,white,transparent_55%)]" />
        <span className="relative font-[family-name:var(--font-display)] text-sm font-bold tracking-tight text-[var(--accent-fg)]">
          C
        </span>
      </span>
      {showWordmark ? (
        <span className="font-[family-name:var(--font-display)] text-[15px] font-bold tracking-tight text-[var(--fg)]">
          {brand.shortName}
        </span>
      ) : null}
    </Link>
  );
}
