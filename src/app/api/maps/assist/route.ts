import { NextResponse } from "next/server";
import { z } from "zod";
import { mapsError, parseLocale, rateLimited, readJson } from "@/lib/maps/api-helpers";
import { buildMapAssist } from "@/lib/maps/assist";
import { replyLocaleFor } from "@/lib/i18n/reply-language";
import { resolveMapAssist } from "@/lib/maps/assist-server";
import { mapContextSchema } from "@/lib/maps/context";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(500),
  locale: z.string().optional(),
  mapContext: mapContextSchema.nullish(),
  tzOffsetMinutes: z.number().min(-900).max(900).optional(),
});

/** Voice → Maps: same intent detection and server-side resolution as the chat. */
export async function POST(req: Request) {
  if (rateLimited(req)) return mapsError("rate_limit");
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return mapsError("bad_request");
  const { text, mapContext, tzOffsetMinutes } = parsed.data;
  const locale = replyLocaleFor(text, parseLocale(parsed.data.locale));
  const detected = buildMapAssist({ text, locale, context: mapContext ?? undefined });
  if (!detected) return NextResponse.json({ assist: null });
  const assist = await resolveMapAssist(detected, locale, {
    tzOffsetMinutes: tzOffsetMinutes ?? mapContext?.tzOffsetMinutes,
  });
  return NextResponse.json({
    assist: { kind: assist.kind, reply: assist.reply, href: assist.href ?? null, action: assist.action ?? null },
  });
}
