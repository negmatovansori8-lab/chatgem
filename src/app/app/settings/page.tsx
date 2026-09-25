"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Settings lives on /app/profile (ChatGPT-style account panels). */
export default function Page() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/profile");
  }, [router]);
  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-muted)]">
      {/** Intentionally minimal redirect splash */}
      <span className="animate-pulse">Settings…</span>
    </div>
  );
}
