"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calculator,
  ChevronRight,
  Code2,
  FileText,
  Globe,
  Plus,
  Search,
  Check,
} from "lucide-react";
import { useI18n } from "@/components/i18n/locale-provider";
import {
  PLUGIN_CATALOG,
  PLUGIN_SECTIONS,
  type PluginDef,
} from "@/features/tools/plugins-catalog";

type ToolCard = {
  slug: string;
  name: string;
  description: string;
  category: string;
  configured: boolean;
};

const STORE_KEY = "nj_plugins_installed_v1";

function toolIcon(slug: string) {
  if (slug === "calculator") return Calculator;
  if (slug === "web-search") return Globe;
  if (slug === "file-reader") return FileText;
  if (slug === "code-utils") return Code2;
  return Globe;
}

function loadInstalled(): string[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveInstalled(ids: string[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(ids));
}

export function ToolsHubWorkspace() {
  const { t } = useI18n();
  const router = useRouter();
  const [tools, setTools] = useState<ToolCard[]>([]);
  const [query, setQuery] = useState("");
  const [installed, setInstalled] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setInstalled(loadInstalled());
    void fetch("/api/tools")
      .then((r) => r.json())
      .then((data) => setTools(data.tools ?? []));
  }, []);

  const q = query.trim().toLowerCase();

  const catalog = useMemo(() => {
    if (!q) return PLUGIN_CATALOG;
    return PLUGIN_CATALOG.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.section.includes(q),
    );
  }, [q]);

  const installedPlugins = useMemo(
    () => PLUGIN_CATALOG.filter((p) => installed.includes(p.id)),
    [installed],
  );

  const builtInInstalled = tools.filter((x) => x.configured);

  function addPlugin(plugin: PluginDef) {
    setInstalled((prev) => {
      if (prev.includes(plugin.id)) return prev;
      const next = [...prev, plugin.id];
      saveInstalled(next);
      return next;
    });
    setNotice(`${plugin.name} — ${t("plugins.added")}`);
  }

  function openPlugin(plugin: PluginDef) {
    if (!installed.includes(plugin.id)) {
      addPlugin(plugin);
    }
    sessionStorage.setItem(
      "nj_active_plugin",
      JSON.stringify({ id: plugin.id, name: plugin.name }),
    );
    router.push(`/app/chat?plugin=${encodeURIComponent(plugin.id)}`);
  }

  function toggleSection(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="relative mx-auto flex min-h-full max-w-lg flex-col bg-[var(--bg)] px-3 pb-[max(7rem,calc(env(safe-area-inset-bottom)+5.5rem))] pt-2 text-[var(--fg)] sm:px-4">
      <header className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-3)] text-[var(--fg)]"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold text-[var(--fg)]">
          {t("plugins.title")}
        </h1>
        <div className="w-10" />
      </header>

      <p className="mb-4 rounded-2xl bg-[var(--surface)] px-4 py-3 text-[13px] leading-relaxed text-[var(--fg-muted)]">
        {t("plugins.howItWorks")}
      </p>

      {notice ? (
        <p className="mb-3 rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm text-[var(--fg-muted)]">
          {notice}
        </p>
      ) : null}

      <section className="mb-6">
        <h2 className="mb-3 px-1 text-[13px] font-semibold text-[var(--fg-subtle)]">
          {t("plugins.installed")}
        </h2>
        <div className="space-y-1">
          {builtInInstalled.map((tool) => {
            const Icon = toolIcon(tool.slug);
            return (
              <button
                key={tool.slug}
                type="button"
                onClick={() => router.push("/app/chat")}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-[var(--surface-2)]"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-[var(--fg)]">
                    {tool.name}
                  </p>
                  <p className="truncate text-xs text-[var(--fg-subtle)]">
                    {tool.description}
                  </p>
                </div>
                <Check className="h-4 w-4 text-emerald-500" />
              </button>
            );
          })}
          {installedPlugins.map((plugin) => (
            <button
              key={plugin.id}
              type="button"
              onClick={() => openPlugin(plugin)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-[var(--surface-2)]"
            >
              <div
                className="grid h-11 w-11 place-items-center rounded-xl text-sm font-bold text-white"
                style={{ background: plugin.color }}
              >
                {plugin.letter}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-[var(--fg)]">
                  {plugin.name}
                </p>
                <p className="truncate text-xs text-[var(--fg-subtle)]">
                  {plugin.description}
                </p>
              </div>
              <Check className="h-4 w-4 text-emerald-500" />
            </button>
          ))}
          {!builtInInstalled.length && !installedPlugins.length ? (
            <p className="px-2 text-sm text-[var(--fg-subtle)]">
              {t("plugins.noneInstalled")}
            </p>
          ) : null}
        </div>
      </section>

      {PLUGIN_SECTIONS.map((section) => {
        const items = catalog.filter((p) => p.section === section.id);
        if (!items.length) return null;
        const isCollapsed = collapsed[section.id];
        return (
          <section key={section.id} className="mb-5">
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="mb-2 flex w-full items-center gap-1 px-1 text-[13px] font-semibold text-[var(--fg-subtle)]"
            >
              {t(section.labelKey)}
              <ChevronRight
                className={`h-4 w-4 transition ${isCollapsed ? "" : "rotate-90"}`}
              />
            </button>
            {!isCollapsed ? (
              <div className="space-y-1">
                {items.map((plugin) => {
                  const isOn = installed.includes(plugin.id);
                  return (
                    <div
                      key={plugin.id}
                      className="flex items-center gap-3 rounded-2xl px-2 py-2.5"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => openPlugin(plugin)}
                      >
                        <div
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
                          style={{ background: plugin.color }}
                        >
                          {plugin.letter}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-[var(--fg)]">
                            {plugin.name}
                          </p>
                          <p className="truncate text-xs text-[var(--fg-subtle)]">
                            {plugin.description}
                          </p>
                          {plugin.needsOAuth ? (
                            <p className="mt-0.5 text-[11px] text-[var(--fg-subtle)]">
                              {t("plugins.skillOnly")}
                            </p>
                          ) : null}
                        </div>
                      </button>
                      {isOn ? (
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center text-emerald-500"
                          onClick={() => openPlugin(plugin)}
                          aria-label="Open"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center text-[var(--fg-subtle)]"
                          onClick={() => {
                            addPlugin(plugin);
                            setNotice(
                              `${plugin.name}: ${t("plugins.skillReady")}`,
                            );
                          }}
                          aria-label="Add"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--bg)]/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-2 rounded-2xl bg-[var(--surface)] px-3 py-2.5 shadow-sm">
          <Search className="h-4 w-4 text-[var(--fg-subtle)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("plugins.search")}
            className="w-full bg-transparent text-[15px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
          />
        </div>
      </div>
    </div>
  );
}
