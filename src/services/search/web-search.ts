import type { SearchResult } from "@/types/knowledge";

export type WebSearchResponse =
  | { configured: false; message: string; results: []; answerHint?: string }
  | { configured: true; results: SearchResult[]; answerHint: string };

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("skip_disambig", "1");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`DuckDuckGo failed: ${res.status}`);
  const data = (await res.json()) as {
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    RelatedTopics?: Array<{
      Text?: string;
      FirstURL?: string;
      Topics?: Array<{ Text?: string; FirstURL?: string }>;
    }>;
  };

  const results: SearchResult[] = [];
  if (data.AbstractText && data.AbstractURL) {
    let domain = "";
    try {
      domain = new URL(data.AbstractURL).hostname;
    } catch {
      domain = "";
    }
    results.push({
      title: data.Heading || "Result",
      domain,
      url: data.AbstractURL,
      snippet: data.AbstractText,
    });
  }

  const flat = (data.RelatedTopics ?? []).flatMap((t) =>
    t.Topics?.length ? t.Topics : [t],
  );
  for (const topic of flat) {
    if (!topic.FirstURL || !topic.Text) continue;
    let domain = "";
    try {
      domain = new URL(topic.FirstURL).hostname;
    } catch {
      domain = "";
    }
    results.push({
      title: topic.Text.slice(0, 120),
      domain,
      url: topic.FirstURL,
      snippet: topic.Text,
    });
    if (results.length >= 6) break;
  }
  return results;
}

/**
 * Web Search — Tavily when keyed; otherwise free DuckDuckGo Instant Answer.
 * Never fabricates search hits.
 */
export async function webSearch(query: string): Promise<WebSearchResponse> {
  const tavily = process.env.TAVILY_API_KEY?.trim();

  if (tavily) {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavily,
        query,
        search_depth: "basic",
        max_results: 5,
      }),
    });
    if (!res.ok) {
      throw new Error(`Tavily search failed: ${res.status}`);
    }
    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    const results: SearchResult[] = (data.results ?? []).map((r) => {
      let domain = "";
      try {
        domain = r.url ? new URL(r.url).hostname : "";
      } catch {
        domain = "";
      }
      return {
        title: r.title ?? "Untitled",
        domain,
        url: r.url ?? "",
        snippet: r.content ?? "",
      };
    });
    return {
      configured: true,
      results,
      answerHint: "Sources from Tavily — listed separately from any AI answer.",
    };
  }

  try {
    const results = await searchDuckDuckGo(query);
    return {
      configured: true,
      results,
      answerHint:
        results.length > 0
          ? "Sources from DuckDuckGo Instant Answer (free)."
          : "No Instant Answer hits — try a more specific query.",
    };
  } catch (error) {
    return {
      configured: false,
      message:
        error instanceof Error
          ? error.message
          : "Web search unavailable right now.",
      results: [],
    };
  }
}
