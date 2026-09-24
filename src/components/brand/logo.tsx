import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/site";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
  /** Extra text beside logo — off by default (PNG already says ChatGem). */
  showWordmark = false,
  size = "md",
}: {
  className?: string;
  href?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const box =
    size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-9 w-9";

  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-lg",
        className,
      )}
      aria-label={`${brand.name} home`}
    >
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl bg-black shadow-[0_8px_24px_-10px_var(--accent-glow)]",
          box,
        )}
      >
        <Image
          src="/chatgem-logo.png"
          alt={brand.name}
          width={96}
          height={96}
          className="h-full w-full object-cover object-top"
          priority
        />
      </span>
      {showWordmark ? (
        <span className="font-[family-name:var(--font-display)] text-[15px] font-bold tracking-tight text-[var(--fg)]">
          <span className="text-[var(--fg)]">Chat</span>
          <span className="bg-gradient-to-r from-[#0f766e] via-[#0e7490] to-[#0369a1] bg-clip-text text-transparent">
            Gem
          </span>
        </span>
      ) : null}
    </Link>
  );
}
