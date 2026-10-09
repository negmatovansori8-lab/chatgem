#!/usr/bin/env node
/**
 * Live smoke test for Maps providers (Nominatim + OSRM).
 * Run: node scripts/test-maps-live.js
 */
async function search(q) {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q,
      format: "json",
      limit: "3",
      countrycodes: "tj",
    });
  const res = await fetch(url, {
    headers: { "User-Agent": "ChatGem/1.0 (smoke-test)" },
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  return res.json();
}

async function route(from, to, profile = "foot") {
  const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`osrm ${res.status}`);
  return res.json();
}

async function main() {
  const pharmacy = await search("аптека Душанбе");
  console.log(
    "pharmacy:",
    pharmacy[0]?.display_name?.slice(0, 80) || "NONE",
  );
  const khuj = await search("Худжанд");
  console.log("khujand:", khuj[0]?.display_name?.slice(0, 80) || "NONE");
  const center = await search("центр Душанбе");
  console.log("center:", center[0]?.display_name?.slice(0, 80) || "NONE");

  if (!pharmacy[0]) throw new Error("pharmacy search failed");
  const a = {
    lat: Number(pharmacy[0].lat),
    lng: Number(pharmacy[0].lon),
  };
  const b = { lat: 38.5598, lng: 68.7738 };
  const walk = await route(b, a, "foot");
  const drive = await route(b, a, "driving");
  console.log(
    "walk m/s:",
    walk.routes?.[0]?.distance,
    walk.routes?.[0]?.duration,
  );
  console.log(
    "drive m/s:",
    drive.routes?.[0]?.distance,
    drive.routes?.[0]?.duration,
  );
  if (walk.code !== "Ok" || drive.code !== "Ok") {
    throw new Error("routing failed");
  }
  console.log("OK live maps smoke passed");
}

main().catch((e) => {
  console.error("FAIL", e.message || e);
  process.exit(1);
});
