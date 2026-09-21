"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  Building2,
  Code2,
  CreditCard,
  FileText,
  FolderKanban,
  GraduationCap,
  History,
  Home,
  ImageIcon,
  MessageSquarePlus,
  Mic,
  Search,
  Settings,
  Shield,
  UserRound,
  Wrench,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useI18n } from "@/components/i18n/locale-provider";
import { UserMenu } from "@/features/profile/profile-workspace";
import { navigation } from "@/config/site";
import { cn } from "@/lib/utils";

const iconMap = {
  home: Home,
  message: MessageSquarePlus,
  history: History,
  wrench: Wrench,
  folder: FolderKanban,
  file: FileText,
  book: BookOpen,
  search: Search,
  graduation: GraduationCap,
  code: Code2,
  image: ImageIcon,
  mic: Mic,
  bot: Bot,
  brain: Brain,
  credit: CreditCard,
  users: Building2,
  chart: BarChart3,
  shield: Shield,
  settings: Settings,
  user: UserRound,
} as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] md:flex">
      <div className="flex h-16 items-center justify-between gap-1 border-b border-[var(--border)] px-3">
        <Logo href="/app" />
        <div className="flex items-center">
          <ThemeToggle />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3" aria-label="App">
        <ul className="space-y-1">
          {navigation.app.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap] ?? Home;
            const active =
              pathname === item.href ||
              (item.href !== "/app" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-[var(--accent)]/12 text-[var(--accent)]"
                      : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <UserMenu />
    </aside>
  );
}
