async function main() {
  const body = `[out:json][timeout:25];
(
  node["amenity"="pharmacy"](around:2000,38.5598,68.7738);
  way["amenity"="pharmacy"](around:2000,38.5598,68.7738);
);
out center 8;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(body)}`,
  });
  const json = await res.json();
  console.log("status", res.status, "elements", json.elements?.length);
  console.log(
    (json.elements || []).slice(0, 3).map((e) => ({
      name: e.tags?.name || e.tags?.["name:ru"] || "pharmacy",
      lat: e.lat || e.center?.lat,
      lon: e.lon || e.center?.lon,
    })),
  );
}
main().catch(console.error);
