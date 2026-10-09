"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, ExternalLink, Search } from "lucide-react";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { useI18n } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HttpError, jsonInit, requestJson } from "@/lib/http";
import type { SearchResult } from "@/types/knowledge";

type SearchResponse = { results?: SearchResult[]; message?: string; answerHint?: string };

export function SearchWorkspace() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const data = await requestJson<SearchResponse>("/api/search", jsonInit("POST", { query: query.trim() }));
      setMessage(data.message ?? data.answerHint ?? null);
      setResults(data.results ?? []);
    } catch (e) {
      setResults([]);
      setMessage(
        e instanceof HttpError && e.offline ? t("common.offline") : e instanceof HttpError ? e.message : t("search.failed"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col bg-[var(--bg)] text-[var(--fg)] md:max-w-xl lg:max-w-2xl">
      <WorkspaceHeader title={t("search.title")} />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
        <p className="mb-4 text-center text-sm text-[var(--fg-muted)]">{t("search.subtitle")}</p>

        <form onSubmit={onSearch} role="search" className="mb-5 flex gap-2">
          <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 focus-within:ring-2 focus-within:ring-[var(--ring)]">
            <Search className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search.placeholder")}
              enterKeyHint="search"
              className="w-full min-w-0 bg-transparent py-3 text-[15px] outline-none placeholder:text-[var(--fg-subtle)]"
            />
          </label>
          <Button type="submit" size="lg" className="h-12 shrink-0" disabled={loading || !query.trim()}>
            {loading ? "…" : t("search.button")}
          </Button>
        </form>

        {message ? (
          <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-lg)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--fg-muted)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <p className="break-words">{message}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-2)]" />
            ))}
          </div>
        ) : !results.length && !message ? (
          <EmptyState icon={<Search className="h-6 w-6" />} title={t("search.empty")} className="py-10" />
        ) : (
          <ul className="space-y-3">
            {results.map((result) => (
              <li
                key={result.url + result.title}
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-start gap-1.5 font-semibold text-[var(--accent-2)] hover:underline"
                >
                  <span className="break-words">{result.title}</span>
                  <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" />
                </a>
                <p className="mt-1 truncate text-xs text-[var(--fg-subtle)]">{result.domain}</p>
                <p className="mt-2 break-words text-sm text-[var(--fg-muted)]">{result.snippet}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
