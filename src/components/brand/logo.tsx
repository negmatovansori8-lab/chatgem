import Image from "next/image";
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
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-[0_8px_24px_-10px_var(--accent-glow)]">
        <Image
          src="/chatgem-logo.png"
          alt=""
          width={72}
          height={72}
          className="h-full w-full object-contain"
          priority
        />
      </span>
      {showWordmark ? (
        <span className="font-[family-name:var(--font-display)] text-[15px] font-bold tracking-tight text-[var(--fg)]">
          <span className="text-[var(--fg)]">CHAT</span>
          <span className="bg-gradient-to-r from-[#2563EB] to-[#7C3AED] bg-clip-text text-transparent">
            GEM
          </span>
        </span>
      ) : null}
    </Link>
  );
}
