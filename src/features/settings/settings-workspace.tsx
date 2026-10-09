"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { AlertCircle, ArrowLeft, Check, ChevronRight, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import { AppBackButton } from "@/components/layout/app-back-button";
import { cn } from "@/lib/utils";
import { SettingsDataProvider, useSettingsData } from "@/features/settings/settings-data";
import { SECTION_GROUPS, SECTIONS, toSectionId, type SectionId } from "@/features/settings/settings-nav";
import {
  AppearanceSection,
  GeneralSection,
  LanguageSection,
  NotificationsSection,
  ProfileSummary,
} from "@/features/settings/sections-preferences";
import { AiSection, ChatSection, MapsSection, VoiceSection } from "@/features/settings/sections-assistant";
import { AboutSection, AccountSection, PrivacySection, SecuritySection } from "@/features/settings/sections-account";
import { SectionHeader, Skeleton } from "@/features/settings/controls";

export function SettingsWorkspace() {
  return (
    <SettingsDataProvider>
      <SettingsScreen />
    </SettingsDataProvider>
  );
}

function SaveIndicator() {
  const { t } = useI18n();
  const { status } = useSettingsData();
  return (
    <span aria-live="polite" className="flex h-9 min-w-9 shrink-0 items-center justify-end text-[13px] font-medium">
      {status === "saving" ? (
        <span className="inline-flex items-center gap-1.5 text-[var(--fg-subtle)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="max-sm:sr-only">{t("settingsUi.status.saving")}</span>
        </span>
      ) : status === "saved" ? (
        <span className="inline-flex items-center gap-1.5 text-[var(--accent)]">
          <Check className="h-4 w-4" strokeWidth={2.5} />
          <span className="max-sm:sr-only">{t("settingsUi.status.saved")}</span>
        </span>
      ) : status === "error" ? (
        <span className="inline-flex items-center gap-1.5 text-[var(--danger)]">
          <AlertCircle className="h-4 w-4" />
          <span className="max-sm:sr-only">{t("settingsUi.status.error")}</span>
        </span>
      ) : null}
    </span>
  );
}

function SectionBody({ id, go }: { id: SectionId; go: (id: SectionId) => void }) {
  const { loading } = useSettingsData();
  if (loading && id !== "language" && id !== "voice") {
    return (
      <div className="flex flex-col gap-6" aria-busy>
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  }
  switch (id) {
    case "general":
      return <GeneralSection go={go} />;
    case "appearance":
      return <AppearanceSection />;
    case "language":
      return <LanguageSection />;
    case "notifications":
      return <NotificationsSection />;
    case "chat":
      return <ChatSection />;
    case "ai":
      return <AiSection />;
    case "voice":
      return <VoiceSection />;
    case "maps":
      return <MapsSection />;
    case "account":
      return <AccountSection />;
    case "privacy":
      return <PrivacySection go={go} />;
    case "security":
      return <SecuritySection />;
    case "about":
      return <AboutSection />;
  }
}

function SettingsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { loading } = useSettingsData();
  const topRef = useRef<HTMLDivElement>(null);
  const pushedRef = useRef(false);

  const requested = toSectionId(params.get("section"));
  const active: SectionId = requested ?? "general";

  function go(id: SectionId) {
    const href = `${pathname}?section=${id}`;
    if (window.matchMedia("(max-width: 767px)").matches) {
      pushedRef.current = true;
      router.push(href, { scroll: false });
    } else {
      router.replace(href, { scroll: false });
    }
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
  }

  function backToList() {
    if (pushedRef.current) {
      pushedRef.current = false;
      router.back();
    } else {
      router.replace(pathname, { scroll: false });
    }
  }

  const activeMeta = SECTIONS[active];

  return (
    <div ref={topRef} className="min-h-full bg-[var(--bg)] text-[var(--fg)]">
      {/* Phone header: list → "Settings"; inside a section → back to the list + section title. */}
      <header className="sticky top-0 z-20 grid grid-cols-[5.25rem_minmax(0,1fr)_5.25rem] items-center border-b border-[var(--border)] bg-[var(--bg)]/90 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md md:hidden">
        {requested ? (
          <button
            type="button"
            onClick={backToList}
            className="nj-icon-btn !h-11 !w-11 text-[var(--fg)]"
            aria-label={t("common.back")}
          >
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" strokeWidth={1.75} />
          </button>
        ) : (
          <AppBackButton />
        )}
        <h1 className="truncate text-center text-[17px] font-semibold">
          {requested ? t(activeMeta.labelKey) : t("settings.title")}
        </h1>
        <span className="flex justify-end pe-1">
          <SaveIndicator />
        </span>
      </header>

      <div className="mx-auto w-full max-w-[72rem] px-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] min-[400px]:px-4 md:px-6 lg:px-10">
        <div className="hidden items-center gap-3 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] md:flex">
          <AppBackButton />
          <h1 className="min-w-0 flex-1 truncate font-display text-[1.625rem] font-semibold tracking-tight">
            {t("settings.title")}
          </h1>
          <SaveIndicator />
        </div>

        <div className="md:grid md:grid-cols-[13.5rem_minmax(0,1fr)] md:gap-8 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-12">
          {/* Navigation: the whole screen on phones, a sticky sidebar from tablet up. */}
          <nav
            aria-label={t("settings.title")}
            className={cn(
              "pt-4 md:sticky md:top-4 md:self-start md:pt-0",
              requested ? "hidden md:block" : "block",
            )}
          >
            <div className="mb-6 md:hidden">
              {loading ? <Skeleton className="h-[5.5rem] w-full rounded-2xl" /> : <ProfileSummary onManage={() => go("account")} />}
            </div>
            <div className="flex flex-col gap-6 md:gap-5">
              {SECTION_GROUPS.map((group) => (
                <div key={group.labelKey}>
                  <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-subtle)] md:px-3">
                    {t(group.labelKey)}
                  </p>
                  <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] md:divide-y-0 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent">
                    {group.ids.map((id) => {
                      const meta = SECTIONS[id];
                      const Icon = meta.icon;
                      const current = id === active;
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => go(id)}
                            aria-current={current ? "page" : undefined}
                            className={cn(
                              "group flex w-full items-center gap-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]",
                              "min-h-[3.75rem] px-4 py-3 hover:bg-[var(--surface-2)] active:bg-[var(--surface-3)]",
                              "md:min-h-10 md:rounded-xl md:px-3 md:py-2",
                              current &&
                                "md:bg-[var(--surface-2)] md:text-[var(--fg)] md:shadow-[inset_0_0_0_1px_var(--border)]",
                            )}
                          >
                            <span
                              className={cn(
                                "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--fg-muted)] md:h-7 md:w-7 md:rounded-lg md:bg-transparent",
                                current && "md:bg-[var(--accent-muted)] md:text-[var(--accent)]",
                              )}
                            >
                              <Icon className="h-[18px] w-[18px] md:h-4 md:w-4" strokeWidth={1.75} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  "block truncate text-[15px] font-medium text-[var(--fg)] md:text-[14px]",
                                  !current && "md:text-[var(--fg-muted)] md:group-hover:text-[var(--fg)]",
                                )}
                              >
                                {t(meta.labelKey)}
                              </span>
                              <span className="mt-0.5 block truncate text-[13px] text-[var(--fg-subtle)] md:hidden">
                                {t(meta.descKey)}
                              </span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--fg-subtle)] rtl:rotate-180 md:hidden" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          <main className={cn("min-w-0 pt-4 md:pt-0", requested ? "block" : "hidden md:block")}>
            <div className="mx-auto w-full max-w-[50rem] md:mx-0">
              <SectionHeader title={t(activeMeta.labelKey)} description={t(activeMeta.descKey)} />
              <p className="mb-4 px-1 text-[13px] leading-snug text-[var(--fg-subtle)] md:hidden">{t(activeMeta.descKey)}</p>
              <SectionBody key={active} id={active} go={go} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
