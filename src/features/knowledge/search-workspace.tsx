"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, Search } from "lucide-react";
import { AppBackButton } from "@/components/layout/app-back-button";
import { useI18n } from "@/components/i18n/locale-provider";
import type { SearchResult } from "@/types/knowledge";

export function SearchWorkspace() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error?.message ?? t("search.failed"));
      setResults([]);
      return;
    }
    setMessage(data.message ?? data.answerHint ?? null);
    setResults(data.results ?? []);
  }

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-lg flex-col bg-black text-white">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <AppBackButton className="max-w-[7rem]" />
        <h1 className="flex-1 text-center text-[17px] font-semibold">{t("search.title")}</h1>
        <div className="w-10" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        <p className="mb-4 text-center text-sm text-white/45">{t("search.subtitle")}</p>

        <form onSubmit={onSearch} className="mb-5 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl bg-[#1a1a1a] px-3">
            <Search className="h-4 w-4 shrink-0 text-white/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search.placeholder")}
              className="w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-white/35"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-[#3b82f6] px-4 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "…" : t("search.button")}
          </button>
        </form>

        {message ? (
          <div className="mb-4 flex items-start gap-2 rounded-2xl bg-[#1a1a1a] px-4 py-3 text-sm text-white/55">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#60a5fa]" />
            <p>{message}</p>
          </div>
        ) : null}

        {!results.length && !loading && !message ? (
          <p className="py-10 text-center text-sm text-white/35">{t("search.empty")}</p>
        ) : null}

        <ul className="space-y-3">
          {results.map((result) => (
            <li key={result.url + result.title} className="rounded-2xl bg-[#1a1a1a] p-4">
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#60a5fa] hover:underline"
              >
                {result.title}
              </a>
              <p className="mt-1 text-xs text-white/35">{result.domain}</p>
              <p className="mt-2 text-sm text-white/60">{result.snippet}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
