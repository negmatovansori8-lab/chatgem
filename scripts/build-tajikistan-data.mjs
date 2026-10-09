/**
 * Builds src/data/tajikistan/{geo.json,flag.ts} from open data — run once, output is committed.
 *   Natural Earth (public domain): neighbours, cities, rivers, lakes.
 *   geoBoundaries gbOpen TJK ADM1 (ODbL 1.0, © OpenStreetMap contributors): national border and regions.
 *   Wikimedia Commons "Flag of Tajikistan.svg" (public domain): official flag construction.
 * Usage: node scripts/build-tajikistan-data.mjs [path/to/geoBoundaries-TJK-ADM1_simplified.geojson]
 * (pass the file when github.com is unreachable from Node).
 *        node scripts/build-tajikistan-data.mjs --flag path/to/Flag_of_Tajikistan.svg   (flag only)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const OUT = path.join(root, "src", "data", "tajikistan");
const UA = { "User-Agent": "ChatGem/1.0 (open-data build script)" };
const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";

/** lon/lat window of the map: Tajikistan plus a margin of its neighbours. */
const BBOX = { west: 66.2, south: 35.9, east: 76.0, north: 41.4 };
const NEIGHBOURS = ["UZB", "KGZ", "CHN", "AFG", "PAK"];

/** Natural Earth still uses Soviet-era names; points without a current town are dropped. */
const CITY_RENAMES = { Qurghonteppa: "Bokhtar", Uroteppa: "Istaravshan", Leninobod: null, Kuybyshevskiy: null };
/** Towns missing from Natural Earth — coordinates from OpenStreetMap (Nominatim). */
const EXTRA_CITIES = [
  { name: "Panjakent", capital: false, population: 0, at: [67.614, 39.496] },
  { name: "Murghob", capital: false, population: 0, at: [73.967, 38.171] },
];

async function json(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const round = (n) => Math.round(n * 1000) / 1000;

function polygonsOf(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function linesOf(geometry) {
  if (geometry.type === "LineString") return [geometry.coordinates];
  if (geometry.type === "MultiLineString") return geometry.coordinates;
  return [];
}

/** Sutherland–Hodgman against the map window (rings stay closed and fillable). */
function clipRing(ring) {
  const edges = [
    (p) => p[0] >= BBOX.west,
    (p) => p[0] <= BBOX.east,
    (p) => p[1] >= BBOX.south,
    (p) => p[1] <= BBOX.north,
  ];
  const cut = [
    (a, b) => [BBOX.west, a[1] + ((b[1] - a[1]) * (BBOX.west - a[0])) / (b[0] - a[0])],
    (a, b) => [BBOX.east, a[1] + ((b[1] - a[1]) * (BBOX.east - a[0])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((b[0] - a[0]) * (BBOX.south - a[1])) / (b[1] - a[1]), BBOX.south],
    (a, b) => [a[0] + ((b[0] - a[0]) * (BBOX.north - a[1])) / (b[1] - a[1]), BBOX.north],
  ];
  let pts = ring;
  for (let e = 0; e < 4; e++) {
    const inside = edges[e];
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const prev = pts[(i + pts.length - 1) % pts.length];
      if (inside(cur)) {
        if (!inside(prev)) next.push(cut[e](prev, cur));
        next.push(cur);
      } else if (inside(prev)) {
        next.push(cut[e](prev, cur));
      }
    }
    pts = next;
    if (!pts.length) break;
  }
  return pts;
}

/** Drops points closer than `tol` degrees to the previous kept point. */
function thin(points, tol = 0.01) {
  const out = [];
  for (const p of points) {
    const q = [round(p[0]), round(p[1])];
    const last = out[out.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) >= tol) out.push(q);
  }
  return out;
}

function clipPolygons(geometry, tol) {
  return polygonsOf(geometry)
    .map((poly) => poly.map((ring) => thin(clipRing(ring), tol)).filter((r) => r.length >= 4))
    .filter((poly) => poly.length);
}

function inBox([x, y]) {
  return x >= BBOX.west && x <= BBOX.east && y >= BBOX.south && y <= BBOX.north;
}

function clipLines(geometry) {
  const runs = [];
  for (const line of linesOf(geometry)) {
    let run = [];
    for (const p of line) {
      if (inBox(p)) run.push(p);
      else if (run.length) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length) runs.push(run);
  }
  return runs.map((r) => thin(r, 0.008)).filter((r) => r.length >= 2);
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolygons(p, polygons) {
  return polygons.some((poly) => pointInRing(p, poly[0]) && !poly.slice(1).some((hole) => pointInRing(p, hole)));
}

function segmentDistance([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Interior point farthest from the border — where a label fits best (grid search). */
function labelPoint(polygons) {
  const pts = polygons.flatMap((poly) => poly[0]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let best = null;
  const steps = 40;
  for (let i = 1; i < steps; i++) {
    for (let j = 1; j < steps; j++) {
      const p = [minX + ((maxX - minX) * i) / steps, minY + ((maxY - minY) * j) / steps];
      if (!pointInPolygons(p, polygons)) continue;
      let d = Infinity;
      for (const poly of polygons) {
        for (const ring of poly) {
          for (let k = 1; k < ring.length; k++) d = Math.min(d, segmentDistance(p, ring[k - 1], ring[k]));
        }
      }
      if (!best || d > best.d) best = { p, d };
    }
  }
  return best ? [round(best.p[0]), round(best.p[1])] : [round((minX + maxX) / 2), round((minY + maxY) / 2)];
}

async function fetchFlag() {
  const res = await fetch("https://upload.wikimedia.org/wikipedia/commons/d/d0/Flag_of_Tajikistan.svg", { headers: UA });
  if (!res.ok) throw new Error(`flag ${res.status}`);
  return res.text();
}

/** Bundled as a TS string so server code needs no file-system access at runtime. */
async function writeFlagModule(svg) {
  const clean = svg
    .replace(/<\?xml[^>]*>/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+id="[^"]*"/g, "")
    .replace(/\s+style="enable-background:[^"]*"/, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  await writeFile(
    path.join(OUT, "flag.ts"),
    `/** Flag of Tajikistan, official construction (Wikimedia Commons, public domain). Ratio 1:2. */\nexport const TAJIKISTAN_FLAG_SVG = ${JSON.stringify(clean)};\n`,
  );
}

async function main() {
  await mkdir(OUT, { recursive: true });

  if (process.argv[2] === "--flag") {
    await writeFlagModule(await readFile(process.argv[3], "utf8"));
    console.log("flag.ts written");
    return;
  }

  const localAdm1 = process.argv[2];
  const [countries, places, rivers, lakes, adm1] = await Promise.all([
    json(`${NE}/ne_50m_admin_0_countries.geojson`),
    json(`${NE}/ne_10m_populated_places_simple.geojson`),
    json(`${NE}/ne_10m_rivers_lake_centerlines.geojson`),
    json(`${NE}/ne_10m_lakes.geojson`),
    localAdm1
      ? readFile(localAdm1, "utf8").then(JSON.parse)
      : json("https://www.geoboundaries.org/api/current/gbOpen/TJK/ADM1/").then((meta) => json(meta.simplifiedGeometryGeoJSON)),
  ]);

  const regions = adm1.features.map((f) => {
    const polygons = clipPolygons(f.geometry, 0.004);
    return { name: f.properties.shapeName, polygons, label: labelPoint(polygons) };
  });

  const neighbours = countries.features
    .filter((f) => NEIGHBOURS.includes(f.properties.ADM0_A3))
    .map((f) => {
      const polygons = clipPolygons(f.geometry, 0.01);
      return { code: f.properties.ADM0_A3, name: f.properties.NAME_EN, polygons, label: labelPoint(polygons) };
    })
    .filter((n) => n.polygons.length);

  const cities = places.features
    .filter((f) => f.properties.adm0_a3 === "TJK" && inBox(f.geometry.coordinates))
    .sort((a, b) => b.properties.pop_max - a.properties.pop_max)
    .slice(0, 14)
    .map((f) => ({
      name: f.properties.name in CITY_RENAMES ? CITY_RENAMES[f.properties.name] : f.properties.name,
      capital: f.properties.adm0cap === 1,
      population: f.properties.pop_max,
      at: f.geometry.coordinates.map(round),
    }))
    .filter((c) => c.name)
    .concat(EXTRA_CITIES);

  const riverLines = rivers.features
    .filter((f) => (f.properties.scalerank ?? 10) <= 8)
    .map((f) => ({ name: f.properties.name_en || f.properties.name || "", lines: clipLines(f.geometry) }))
    .filter((r) => r.lines.length);

  const lakePolys = lakes.features
    .map((f) => ({ name: f.properties.name_en || f.properties.name || "", polygons: clipPolygons(f.geometry, 0.004) }))
    .filter((l) => l.polygons.length);

  const geo = {
    sources: {
      regions: "geoBoundaries gbOpen TJK ADM1 (ODbL 1.0, © OpenStreetMap contributors)",
      context: "Natural Earth (public domain)",
    },
    bbox: BBOX,
    regions,
    neighbours,
    cities,
    rivers: riverLines,
    lakes: lakePolys,
  };
  await writeFile(path.join(OUT, "geo.json"), JSON.stringify(geo));

  await writeFlagModule(await fetchFlag());

  console.log(
    `regions=${regions.length} neighbours=${neighbours.length} cities=${cities.length} rivers=${riverLines.length} lakes=${lakePolys.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
