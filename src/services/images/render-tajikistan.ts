import sharp from "sharp";
import geo from "@/data/tajikistan/geo.json";
import { TAJIKISTAN_FLAG_SVG } from "@/data/tajikistan/flag";

export type MapLang = "tg" | "ru" | "en";

type Ring = number[][];
type Polygons = Ring[][];

const FONT = "'Segoe UI', Arial, 'DejaVu Sans', 'Noto Sans', sans-serif";

const REGION_LABELS: Record<string, Record<MapLang, string>> = {
  "Sughd Region": { tg: "Вилояти Суғд", ru: "Согдийская обл.", en: "Sughd Region" },
  "Khatlon Region": { tg: "Вилояти Хатлон", ru: "Хатлонская обл.", en: "Khatlon Region" },
  "Gorno-Badakhshan Autonomous Region": { tg: "ВМКБ", ru: "ГБАО", en: "Gorno-Badakhshan" },
  "Districts of Republican Subordination": { tg: "НТҶ", ru: "РРП", en: "DRS" },
};

const REGION_FILL: Record<string, string> = {
  "Sughd Region": "#d4e8cf",
  "Districts of Republican Subordination": "#e5ecc8",
  "Khatlon Region": "#f2e4c4",
  "Gorno-Badakhshan Autonomous Region": "#dcd9ec",
  Dushanbe: "#f3c9c4",
};

const NEIGHBOUR_LABELS: Record<string, Record<MapLang, string>> = {
  UZB: { tg: "ӮЗБЕКИСТОН", ru: "УЗБЕКИСТАН", en: "UZBEKISTAN" },
  KGZ: { tg: "ҚИРҒИЗИСТОН", ru: "КИРГИЗИЯ", en: "KYRGYZSTAN" },
  CHN: { tg: "ЧИН", ru: "КИТАЙ", en: "CHINA" },
  AFG: { tg: "АФҒОНИСТОН", ru: "АФГАНИСТАН", en: "AFGHANISTAN" },
  PAK: { tg: "ПОКИСТОН", ru: "ПАКИСТАН", en: "PAKISTAN" },
};

const CITY_LABELS: Record<string, Record<MapLang, string>> = {
  Dushanbe: { tg: "Душанбе", ru: "Душанбе", en: "Dushanbe" },
  Khujand: { tg: "Хуҷанд", ru: "Худжанд", en: "Khujand" },
  Bokhtar: { tg: "Бохтар", ru: "Бохтар", en: "Bokhtar" },
  Konibodom: { tg: "Конибодом", ru: "Канибадам", en: "Konibodom" },
  Istaravshan: { tg: "Истаравшан", ru: "Истаравшан", en: "Istaravshan" },
  Kulob: { tg: "Кӯлоб", ru: "Куляб", en: "Kulob" },
  Khorugh: { tg: "Хоруғ", ru: "Хорог", en: "Khorugh" },
  Panjakent: { tg: "Панҷакент", ru: "Пенджикент", en: "Panjakent" },
  Murghob: { tg: "Мурғоб", ru: "Мургаб", en: "Murghob" },
};

type LabelSide = "right" | "left" | "above";

/** Labels that would collide with a neighbour, a region name or the border move around the dot. */
const LABEL_SIDE: Record<string, LabelSide> = { Khujand: "above", Murghob: "left", Bokhtar: "left" };

/** Pixel nudges for region names that would sit on top of a city label. */
const REGION_LABEL_SHIFT: Record<string, [number, number]> = { "Khatlon Region": [10, 64] };

const TEXT: Record<MapLang, Record<string, string>> = {
  tg: {
    title: "Ҷумҳурии Тоҷикистон",
    subtitle: "Харитаи маъмурӣ-сиёсӣ",
    capital: "Пойтахт",
    city: "Шаҳр",
    border: "Сарҳади давлатӣ",
    region: "Сарҳади вилоят",
    river: "Дарё, обанбор",
    notes: "ВМКБ — Вилояти Мухтори Кӯҳистони Бадахшон · НТҶ — ноҳияҳои тобеи ҷумҳурӣ",
    km: "км",
  },
  ru: {
    title: "Республика Таджикистан",
    subtitle: "Административно-политическая карта",
    capital: "Столица",
    city: "Город",
    border: "Государственная граница",
    region: "Граница области",
    river: "Река, водохранилище",
    notes: "ГБАО — Горно-Бадахшанская автономная область · РРП — районы республиканского подчинения",
    km: "км",
  },
  en: {
    title: "Republic of Tajikistan",
    subtitle: "Administrative and political map",
    capital: "Capital",
    city: "City",
    border: "International border",
    region: "Regional border",
    river: "River, reservoir",
    notes: "DRS — Districts of Republican Subordination",
    km: "km",
  },
};

function escapeXml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function projector(width: number, height: number) {
  const { west, east, south, north } = geo.bbox;
  return ([lon, lat]: number[]): [number, number] => [
    ((lon - west) / (east - west)) * width,
    ((north - lat) / (north - south)) * height,
  ];
}

function pathOf(polygons: Polygons, project: (p: number[]) => [number, number]): string {
  return polygons
    .map((poly) =>
      poly
        .map((ring) => `M${ring.map((p) => project(p).map((v) => v.toFixed(1)).join(" ")).join("L")}Z`)
        .join(""),
    )
    .join("");
}

function lineOf(lines: number[][][], project: (p: number[]) => [number, number]): string {
  return lines.map((line) => `M${line.map((p) => project(p).map((v) => v.toFixed(1)).join(" ")).join("L")}`).join("");
}

function halo(color = "#ffffff", width = 4) {
  return `stroke="${color}" stroke-width="${width}" stroke-linejoin="round" paint-order="stroke"`;
}

/** Accurate political map of Tajikistan from bundled open data, localized labels. */
export async function renderTajikistanMap(lang: MapLang = "tg"): Promise<{ url: string; width: number; height: number }> {
  const { west, east, south, north } = geo.bbox;
  const midLat = ((south + north) / 2) * (Math.PI / 180);
  const width = 1600;
  const height = Math.round((width * (north - south)) / ((east - west) * Math.cos(midLat)));
  const project = projector(width, height);
  const t = TEXT[lang];

  const neighbours = geo.neighbours
    .map((n) => `<path d="${pathOf(n.polygons as Polygons, project)}" fill="#efebe4" stroke="#b5ad9f" stroke-width="1.4" stroke-dasharray="7 5"/>`)
    .join("");
  const regionPaths = geo.regions.map((r) => ({ r, d: pathOf(r.polygons as Polygons, project) }));
  const border = regionPaths.map(({ d }) => `<path d="${d}" fill="none" stroke="#b3261e" stroke-width="5" stroke-linejoin="round"/>`).join("");
  const regionFills = regionPaths.map(({ r, d }) => `<path d="${d}" fill="${REGION_FILL[r.name] ?? "#e5ecc8"}"/>`).join("");
  const regionLines = regionPaths
    .map(({ d }) => `<path d="${d}" fill="none" stroke="#7d8b6f" stroke-width="1.3" stroke-dasharray="5 4" stroke-linejoin="round"/>`)
    .join("");
  const rivers = geo.rivers.map((r) => `<path d="${lineOf(r.lines, project)}" fill="none" stroke="#5aa2d6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  const lakes = geo.lakes.map((l) => `<path d="${pathOf(l.polygons as Polygons, project)}" fill="#a8d1ec" stroke="#5aa2d6" stroke-width="1"/>`).join("");

  const neighbourLabels = geo.neighbours
    .map((n) => {
      const [px, y] = project(n.label);
      const nearEdge = px > width - 170;
      const x = nearEdge ? width - 36 : px;
      return `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="${nearEdge ? "end" : "middle"}" font-family="${FONT}" font-size="22" font-weight="600" letter-spacing="4" fill="#9a9284">${escapeXml(NEIGHBOUR_LABELS[n.code]?.[lang] ?? n.name)}</text>`;
    })
    .join("");
  const regionLabels = geo.regions
    .filter((r) => REGION_LABELS[r.name])
    .map((r) => {
      const [dx, dy] = REGION_LABEL_SHIFT[r.name] ?? [0, 0];
      const [px, py] = project(r.label);
      const x = px + dx;
      const y = py + dy;
      return `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="middle" font-family="${FONT}" font-size="21" font-style="italic" font-weight="600" fill="#4f5d43" ${halo("#ffffff", 3)}>${escapeXml(REGION_LABELS[r.name]![lang])}</text>`;
    })
    .join("");
  const cities = geo.cities
    .filter((c) => CITY_LABELS[c.name])
    .map((c) => {
      const [x, y] = project(c.at);
      const label = escapeXml(CITY_LABELS[c.name]![lang]);
      const side = LABEL_SIDE[c.name] ?? "right";
      const tx = side === "left" ? x - 12 : side === "above" ? x : x + 12;
      const ty = side === "above" ? y - 14 : y + 7;
      const anchor = side === "left" ? "end" : side === "above" ? "middle" : "start";
      if (c.capital) {
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="#ffffff" stroke="#b3261e" stroke-width="3"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#b3261e"/><text x="${(tx + 4).toFixed(0)}" y="${(y - 12).toFixed(0)}" text-anchor="${anchor}" font-family="${FONT}" font-size="27" font-weight="700" fill="#1f1f1f" ${halo()}>${label}</text>`;
      }
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#2b2b2b" stroke="#ffffff" stroke-width="2"/><text x="${tx.toFixed(0)}" y="${ty.toFixed(0)}" text-anchor="${anchor}" font-family="${FONT}" font-size="20" font-weight="600" fill="#2b2b2b" ${halo()}>${label}</text>`;
    })
    .join("");

  // 1 km in pixels at the map's mid latitude.
  const pxPerKm = width / ((east - west) * 111.32 * Math.cos(midLat));
  const barKm = 200;
  const barPx = barKm * pxPerKm;
  const sx = width - barPx - 48;
  const sy = height - 64;
  const scale = [0, 1, 2, 3]
    .map((i) => `<rect x="${(sx + (barPx / 4) * i).toFixed(1)}" y="${sy}" width="${(barPx / 4).toFixed(1)}" height="9" fill="${i % 2 ? "#ffffff" : "#2b2b2b"}" stroke="#2b2b2b" stroke-width="1.2"/>`)
    .join("");
  const scaleLabels = [0, 100, 200]
    .map((km, i) => `<text x="${(sx + (barPx / 2) * i).toFixed(1)}" y="${sy - 8}" text-anchor="middle" font-family="${FONT}" font-size="16" fill="#2b2b2b" ${halo("#ffffff", 3)}>${km}${i === 2 ? ` ${t.km}` : ""}</text>`)
    .join("");

  const flag = `<svg x="40" y="38" width="96" height="48" viewBox="0 0 8267.7 4133.8">${TAJIKISTAN_FLAG_SVG.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</svg>`;
  const legendItems = [
    `<circle cx="58" cy="0" r="9" fill="#ffffff" stroke="#b3261e" stroke-width="3"/><circle cx="58" cy="0" r="4" fill="#b3261e"/><text x="80" y="6" font-size="17">${escapeXml(t.capital)}</text>`,
    `<circle cx="58" cy="30" r="5.5" fill="#2b2b2b" stroke="#ffffff" stroke-width="2"/><text x="80" y="36" font-size="17">${escapeXml(t.city)}</text>`,
    `<line x1="42" y1="60" x2="74" y2="60" stroke="#b3261e" stroke-width="4"/><text x="80" y="66" font-size="17">${escapeXml(t.border)}</text>`,
    `<line x1="42" y1="90" x2="74" y2="90" stroke="#7d8b6f" stroke-width="1.6" stroke-dasharray="5 4"/><text x="80" y="96" font-size="17">${escapeXml(t.region)}</text>`,
    `<line x1="42" y1="120" x2="74" y2="120" stroke="#5aa2d6" stroke-width="2.4"/><text x="80" y="126" font-size="17">${escapeXml(t.river)}</text>`,
  ].join("");
  const legendH = 196;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="#efebe4"/>
${neighbours}${border}${regionFills}${regionLines}${lakes}${rivers}
${neighbourLabels}${regionLabels}${cities}
<g><rect x="24" y="24" width="${lang === "ru" ? 560 : 500}" height="78" rx="14" fill="#ffffff" fill-opacity="0.94" stroke="#d8d2c6"/>${flag}
<text x="152" y="58" font-family="${FONT}" font-size="28" font-weight="700" fill="#1f1f1f">${escapeXml(t.title)}</text>
<text x="152" y="86" font-family="${FONT}" font-size="17" fill="#5d5a54">${escapeXml(t.subtitle)}</text></g>
<g transform="translate(24 ${height - legendH - 24})" font-family="${FONT}" fill="#2b2b2b"><rect width="300" height="${legendH}" rx="14" fill="#ffffff" fill-opacity="0.94" stroke="#d8d2c6"/><g transform="translate(0 32)">${legendItems}</g></g>
<g transform="translate(${width - 70} ${height - 160})" font-family="${FONT}"><path d="M0 -28 L11 6 L0 0 L-11 6 Z" fill="#2b2b2b"/><text x="0" y="28" text-anchor="middle" font-size="18" font-weight="700" fill="#2b2b2b">N</text></g>
${scale}${scaleLabels}
<text x="${width - 48}" y="${height - 22}" text-anchor="end" font-family="${FONT}" font-size="13" fill="#6b665d" ${halo("#efebe4", 3)}>${escapeXml(t.notes)}</text>
<text x="${width - 48}" y="${height - 6}" text-anchor="end" font-family="${FONT}" font-size="11" fill="#8a847a">© OpenStreetMap contributors (geoBoundaries, ODbL) · Natural Earth</text>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  return { url: `data:image/png;base64,${png.toString("base64")}`, width, height };
}

const SERIF = "Cambria, 'Times New Roman', 'Noto Serif', 'DejaVu Serif', serif";

const LOGO_WORDMARK: Record<MapLang, string> = { tg: "Тоҷикистон", ru: "Таджикистан", en: "Tajikistan" };

/** Crown and seven stars only: the flag's stripes and construction box are dropped. */
const EMBLEM_VIEWBOX = "3249.2 1351.2 1771.6 1417.3";
const EMBLEM_RATIO = 1771.6 / 1417.3;
const EMBLEM_INNER = TAJIKISTAN_FLAG_SVG.replace(/^<svg[^>]*>/, "")
  .replace(/<\/svg>$/, "")
  .replace(/<rect[^>]*class="st[0125]"[^>]*\/>/g, "");

/** Stripe edges as a share of the silhouette's height: the red reaches into the main body, as on the classic map-flag emblem. */
const RED_END = 0.38;
const WHITE_END = 0.64;

/**
 * The country's exact silhouette filled with the flag stripes, the crown and seven stars
 * centred in the white band, over a wordmark (`null` = no wordmark).
 */
export async function renderTajikistanLogo(
  lang: MapLang = "tg",
  opts: { wordmark?: string | null; size?: number } = {},
): Promise<{ url: string; width: number; height: number }> {
  const size = opts.size ?? 1024;
  const wordmark = opts.wordmark === undefined ? LOGO_WORDMARK[lang] : opts.wordmark?.trim() || null;
  const rings = geo.regions.flatMap((r) => (r.polygons as Polygons).flat());
  let [west, east, south, north] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      west = Math.min(west, lon!);
      east = Math.max(east, lon!);
      south = Math.min(south, lat!);
      north = Math.max(north, lat!);
    }
  }
  const kx = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const scale = Math.min((size * 0.88) / ((east - west) * kx), (size * (wordmark ? 0.64 : 0.8)) / (north - south));
  const mapW = (east - west) * kx * scale;
  const mapH = (north - south) * scale;
  const left = (size - mapW) / 2;
  const top = wordmark ? size * 0.08 : (size - mapH) / 2;
  const project = ([lon, lat]: number[]): [number, number] => [left + (lon! - west) * kx * scale, top + (north - lat!) * scale];

  const silhouette = geo.regions.map((r) => pathOf(r.polygons as Polygons, project)).join("");
  const redEnd = top + mapH * RED_END;
  const whiteEnd = top + mapH * WHITE_END;
  const emblemH = (whiteEnd - redEnd) * 0.86;
  const emblemW = emblemH * EMBLEM_RATIO;
  const emblemX = left + mapW / 2 - emblemW / 2;
  const emblemY = (redEnd + whiteEnd) / 2 - emblemH / 2;
  const fontSize = Math.round(size * 0.1);
  const wordY = top + mapH + (size - top - mapH) * 0.62;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>
<mask id="land" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}"><path d="${silhouette}" fill="#fff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></mask>
</defs>
<rect width="${size}" height="${size}" rx="${size * 0.08}" fill="#f4f4f3"/>
<path d="${silhouette}" fill="#ffffff" stroke="#8f1d1d" stroke-width="${(size * 0.005).toFixed(1)}" stroke-linejoin="round"/>
<path d="${silhouette}" fill="#ffffff"/>
<g mask="url(#land)">
<rect x="${left - 4}" y="${top - 4}" width="${mapW + 8}" height="${(redEnd - top + 4).toFixed(1)}" fill="#C8102E"/>
<rect x="${left - 4}" y="${whiteEnd.toFixed(1)}" width="${mapW + 8}" height="${(top + mapH - whiteEnd + 4).toFixed(1)}" fill="#0F6B2F"/>
</g>
<svg x="${emblemX.toFixed(1)}" y="${emblemY.toFixed(1)}" width="${emblemW.toFixed(1)}" height="${emblemH.toFixed(1)}" viewBox="${EMBLEM_VIEWBOX}">${EMBLEM_INNER}</svg>
${wordmark ? `<text x="${size / 2}" y="${wordY.toFixed(0)}" text-anchor="middle" font-family="${SERIF}" font-size="${fontSize}" font-weight="700" letter-spacing="${(size * 0.003).toFixed(1)}" fill="#a3161a">${escapeXml(wordmark)}</text>` : ""}
</svg>`;

  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  return { url: `data:image/png;base64,${png.toString("base64")}`, width: size, height: size };
}

/** The official flag, rendered from its construction sheet — exact colours, crown and seven stars. */
export async function renderTajikistanFlag(width = 1600): Promise<{ url: string; width: number; height: number }> {
  const height = Math.round(width / 2);
  const svg = TAJIKISTAN_FLAG_SVG.replace(/^<svg/, `<svg width="${width}" height="${height}"`);
  const png = await sharp(Buffer.from(svg)).resize(width, height).png({ compressionLevel: 9 }).toBuffer();
  return { url: `data:image/png;base64,${png.toString("base64")}`, width, height };
}
