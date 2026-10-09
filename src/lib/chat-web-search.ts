import type { SearchResult } from "@/types/knowledge";
import { webSearch } from "@/services/search/web-search";

/** Detect questions that need fresh / external knowledge. */
export function needsWebSearch(text: string) {
  const t = text.trim();
  if (!t || t.length < 4 || t.length > 800) return false;
  // Skip pure coding / rewrite tasks
  if (
    /^(код|code|function|class|def\s|translate|тарҷума|перевед)/i.test(t) ||
    /```/.test(t)
  ) {
    return false;
  }
  return (
    /(?:ҳоло|имрӯз|дайес|сейчас|today|current|latest|news|хабар|новост|курс|price of|weather|обу\s*ҳаво|погода|who won|чемпион|president|президент|exchange rate|курс\s*доллар)/iu.test(
      t,
    ) ||
    /(?:чӣ\s*шуд|что\s*произошло|what\s*happened|who\s*is\s+the\s+current)/iu.test(t)
  );
}

export async function searchContextForChat(query: string): Promise<{
  block: string;
  results: SearchResult[];
}> {
  try {
    const res = await webSearch(query.slice(0, 400));
    if (!res.configured || !res.results.length) {
      return { block: "", results: [] };
    }
    const lines = res.results.slice(0, 5).map((r, i) => {
      const snip = (r.snippet || "").slice(0, 220).replace(/\s+/g, " ");
      return `${i + 1}. ${r.title} (${r.domain || "web"})\n   ${snip}\n   Source: ${r.url}`;
    });
    const block = [
      "LIVE WEB SEARCH RESULTS (use for current facts; cite sources by number):",
      ...lines,
      "Rules: Prefer these sources for current events. If results are weak/empty, say you may be outdated — do NOT invent URLs or headlines.",
      res.answerHint,
    ].join("\n");
    return { block, results: res.results };
  } catch {
    return { block: "", results: [] };
  }
}
