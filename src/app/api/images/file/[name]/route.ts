import { NextResponse } from "next/server";
import { readStoredImage } from "@/lib/stored-image";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  const file = await readStoredImage(name);
  if (!file) {
    return NextResponse.json({ error: { message: "Image not found" } }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
