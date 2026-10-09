import Link from "next/link";
import { brand } from "@/config/site";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

/** Mark-to-wordmark gap and type size scale with the mark so the lockup keeps its proportions. */
const LOCKUP = {
  sm: { mark: "sm", gap: "gap-2", text: "text-[17px]" },
  md: { mark: "md", gap: "gap-2.5", text: "text-[19px]" },
  lg: { mark: "lg", gap: "gap-3.5", text: "text-[28px]" },
} as const;

export function Logo({
  className,
  href = "/",
  showWordmark = false,
  size = "md",
  animate = "none",
}: {
  className?: string;
  href?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
  animate?: "none" | "intro";
}) {
  const lockup = LOCKUP[size];

  return (
    <Link
      href={href}
      className={cn(
        "brand-hover group inline-flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--landing-bg,var(--bg))]",
        lockup.gap,
        className,
      )}
      aria-label={`${brand.name} home`}
    >
      <BrandMark size={lockup.mark} animate={animate} />
      {showWordmark ? <BrandWordmark className={lockup.text} /> : null}
    </Link>
  );
}
