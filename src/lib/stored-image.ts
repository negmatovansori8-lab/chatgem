import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), ".data", "images");
const NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp)$/i;

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** Keep a generated picture on disk and return a short URL the chat can store. */
export async function storeDataUrl(dataUrl: string): Promise<string | null> {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  const id = randomUUID();
  const name = `${id}.${ext}`;
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, name), Buffer.from(match[2].replace(/\s/g, ""), "base64"));
  return `/api/images/file/${name}`;
}

export async function readStoredImage(name: string): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!NAME_RE.test(name)) return null;
  try {
    const bytes = await fs.readFile(path.join(DIR, name));
    const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
    return { bytes, mime: MIME[ext] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
