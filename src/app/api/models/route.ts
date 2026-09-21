import { NextResponse } from "next/server";
import { listSelectableModels } from "@/providers/ai/registry";

export async function GET() {
  const models = listSelectableModels();
  return NextResponse.json({
    models,
    configuredCount: models.filter((m) => m.configured).length,
  });
}
