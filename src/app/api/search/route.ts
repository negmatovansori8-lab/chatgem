import { NextResponse } from "next/server";
import { webSearch } from "@/services/search/web-search";
import { searchSchema } from "@/types/knowledge";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }

  try {
    const result = await webSearch(parsed.data.query);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "SEARCH_ERROR",
          message: error instanceof Error ? error.message : "Search failed",
        },
      },
      { status: 502 },
    );
  }
}
