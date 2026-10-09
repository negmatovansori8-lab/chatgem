"use client";

import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand/brand-mark";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type ProfileUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  provider: string;
  planId: string;
  role?: string;
};

export function Avatar({
  user,
  size = "lg",
}: {
  user: ProfileUser | null;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const dim =
    size === "xl"
      ? "h-20 w-20"
      : size === "lg"
        ? "h-14 w-14"
        : size === "md"
          ? "h-11 w-11"
          : "h-9 w-9";
  if (user?.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt={user.name || "ChatGem"}
        className={cn("shrink-0 rounded-full object-cover", dim)}
      />
    );
  }
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#0b1312] ring-1 ring-[var(--border)]",
        dim,
      )}
    >
      <BrandMark title="ChatGem" className="h-full w-full" />
    </span>
  );
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => router.push("/app/settings")}
        className="relative z-20 grid h-10 w-10 shrink-0 place-items-center rounded-full"
        aria-label="Profile"
      >
        <Avatar user={user} size="sm" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.push("/app/settings")}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[var(--surface-2)]"
    >
      <Avatar user={user} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{user?.name || "Guest"}</span>
        <span className="block truncate text-[11px] text-[var(--fg-subtle)]">
          {user?.email || "Sign in"}
        </span>
      </span>
    </button>
  );
}
