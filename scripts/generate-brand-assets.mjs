/**
 * Renders every ChatGem icon from the master artwork public/brand/chatgem-logo-source.png.
 * Run after replacing the artwork: `npm run brand:assets`.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const out = (...parts) => path.join(root, ...parts);
const SOURCE = out("public", "brand", "chatgem-logo-source.png");

/** The artwork is a disc on a dark square — keep only the disc, transparent outside it. */
async function disc(size) {
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`,
  );
  return sharp(SOURCE)
    .resize(size, size)
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Full square artwork (iOS / Android apply their own mask). */
async function square(size, scale = 1) {
  const inner = Math.round(size * scale);
  const { data } = await sharp(SOURCE).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  const background = { r: data[0], g: data[1], b: data[2], alpha: 1 };
  const art = await sharp(SOURCE).resize(inner, inner).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: art, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** ICO container holding PNG frames (supported by every current browser and Windows). */
function ico(frames) {
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, data }, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...frames.map((f) => f.data)]);
}

async function main() {
  await mkdir(out("public", "icons"), { recursive: true });

  await writeFile(out("public", "chatgem-logo.png"), await disc(512));
  await writeFile(out("src", "app", "icon.png"), await disc(192));
  await writeFile(
    out("src", "app", "favicon.ico"),
    ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await disc(size) })))),
  );
  await writeFile(out("src", "app", "apple-icon.png"), await square(180));
  await writeFile(out("public", "icons", "icon-192.png"), await square(192));
  await writeFile(out("public", "icons", "icon-512.png"), await square(512));
  // Android crops maskable icons to a circle — keep the disc inside the 80% safe zone.
  await writeFile(out("public", "icons", "maskable-512.png"), await square(512, 0.8));

  console.log("Brand assets written.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
