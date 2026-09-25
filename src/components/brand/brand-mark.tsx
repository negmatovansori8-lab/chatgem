"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/** ChatGem mark from /chatgem-logo.png — use everywhere instead of letter "C". */
export function BrandMark({
  size = "md",
  className,
  priority,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
}) {
  const box =
    size === "xl"
      ? "h-16 w-16"
      : size === "lg"
        ? "h-14 w-14"
        : size === "sm"
          ? "h-8 w-8"
          : "h-9 w-9";

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 overflow-hidden rounded-xl bg-black",
        box,
        className,
      )}
    >
      <Image
        src="/chatgem-logo.png"
        alt="ChatGem"
        width={128}
        height={128}
        className="h-full w-full object-cover object-top"
        priority={priority}
      />
    </span>
  );
}
