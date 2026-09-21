import { promises as fs } from "node:fs";
import path from "node:path";
import { readJsonFile, writeJsonFile } from "@/lib/local-store";
import type { FileRecord } from "@/types/knowledge";

type Store = { files: FileRecord[] };

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

async function load(): Promise<Store> {
  return readJsonFile<Store>("files.json", { files: [] });
}

async function save(store: Store) {
  await writeJsonFile("files.json", store);
}

function now() {
  return new Date().toISOString();
}

const ALLOWED = new Set([
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export function isAllowedMime(mime: string) {
  return ALLOWED.has(mime) || mime.startsWith("text/");
}

async function extractText(buffer: Buffer, mimeType: string, name: string) {
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return buffer.toString("utf8").slice(0, 200_000);
  }
  if (mimeType === "application/pdf") {
    return `[PDF uploaded: ${name}] Text extraction requires a PDF parser package. File is stored; full extract lands when parser is enabled.`;
  }
  if (mimeType.includes("wordprocessingml") || mimeType.includes("spreadsheetml")) {
    return `[Office file uploaded: ${name}] Binary parse not configured yet. Metadata saved.`;
  }
  if (mimeType.startsWith("image/")) {
    return `[Image uploaded: ${name}] Vision analysis available when an image provider is configured.`;
  }
  return `[File stored: ${name}]`;
}

export const fileRepository = {
  async list(userId: string) {
    const store = await load();
    return store.files
      .filter((f) => f.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async get(userId: string, id: string) {
    const store = await load();
    return store.files.find((f) => f.id === id && f.userId === userId) ?? null;
  },

  async createFromUpload(userId: string, file: File) {
    if (file.size > 25 * 1024 * 1024) {
      throw new Error("File too large (max 25MB)");
    }
    const mimeType = file.type || "application/octet-stream";
    if (!isAllowedMime(mimeType)) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const id = crypto.randomUUID();
    const storageKey = `${userId}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const abs = path.join(UPLOAD_DIR, storageKey);
    await fs.mkdir(path.dirname(abs), { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(abs, buffer);

    let extractedText: string | null = null;
    let status: FileRecord["status"] = "uploaded";
    try {
      extractedText = await extractText(buffer, mimeType, file.name);
      status = "extracted";
    } catch {
      status = "failed";
    }

    const stamp = now();
    const record: FileRecord = {
      id,
      userId,
      name: file.name,
      mimeType,
      size: file.size,
      storageKey,
      status,
      extractedText,
      createdAt: stamp,
      updatedAt: stamp,
    };

    const store = await load();
    store.files.unshift(record);
    await save(store);
    return record;
  },

  async remove(userId: string, id: string) {
    const store = await load();
    const file = store.files.find((f) => f.id === id && f.userId === userId);
    if (!file) return false;
    store.files = store.files.filter((f) => f.id !== id);
    await save(store);
    try {
      await fs.unlink(path.join(UPLOAD_DIR, file.storageKey));
    } catch {
      // ignore missing file on disk
    }
    return true;
  },
};
