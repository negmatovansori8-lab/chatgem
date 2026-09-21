"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  Home,
  MessageSquare,
  UserRound,
  Wrench,
} from "lucide-react";
import { navigation } from "@/config/site";
import { useI18n } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

const icons = {
  home: Home,
  message: MessageSquare,
  wrench: Wrench,
  folder: FolderKanban,
  user: UserRound,
} as const;

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] backdrop-blur-xl md:hidden"
      aria-label="Mobile"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-2 py-2">
        {navigation.mobile.map((item) => {
          const Icon = icons[item.icon as keyof typeof icons] ?? Home;
          const active =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(item.href));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold",
                  active ? "text-[var(--accent)]" : "text-[var(--fg-subtle)]",
                )}
              >
                <Icon className="h-5 w-5" />
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
