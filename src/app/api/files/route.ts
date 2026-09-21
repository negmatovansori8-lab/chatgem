import { NextResponse } from "next/server";
import { fileRepository } from "@/repositories/file-repository";
import { getRequestUserId } from "@/server/session";

export async function GET() {
  const userId = await getRequestUserId();
  const files = await fileRepository.list(userId);
  return NextResponse.json({ files });
}

export async function POST(request: Request) {
  const userId = await getRequestUserId();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "file is required" } },
      { status: 400 },
    );
  }
  try {
    const record = await fileRepository.createFromUpload(userId, file);
    return NextResponse.json({ file: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "UPLOAD_ERROR",
          message: error instanceof Error ? error.message : "Upload failed",
        },
      },
      { status: 400 },
    );
  }
}
