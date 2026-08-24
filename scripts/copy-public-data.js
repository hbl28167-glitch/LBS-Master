/**
 * Copy processed + static artifacts into public/data for static serving.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const outDir = path.join(ROOT, "public", "data");

const copies = [
  ["data/processed/manifest.json", "manifest.json"],
  ["data/processed/grids.json", "grids.json"],
  ["data/processed/grids_fine.json", "grids_fine.json"],
  ["data/processed/grids_legacy_meta.json", "grids_legacy_meta.json"],
  ["data/processed/zones_shanghai.json", "zones_shanghai.json"],
  ["data/processed/zones_shanghai.geojson", "zones_shanghai.geojson"],
  ["data/processed/water_shanghai.geojson", "water_shanghai.geojson"],
  ["data/processed/metrics_ride.json", "metrics_ride.json"],
  ["data/processed/metrics_chg.json", "metrics_chg.json"],
  ["data/processed/roads_gcj.geojson", "roads_gcj.geojson"],
  ["data/processed/roads_meta.json", "roads_meta.json"],
  ["data/processed/entities_charger.json", "entities_charger.json"],
  ["data/static/weather_coeff.json", "weather_coeff.json"],
  ["data/static/calendar.json", "calendar.json"],
  ["data/static/anchors_shanghai.json", "anchors_shanghai.json"],
  ["data/static/corridor_copy.json", "corridor_copy.json"]
];

fs.mkdirSync(outDir, { recursive: true });

let ok = 0;
let missing = 0;
for (const [rel, name] of copies) {
  const src = path.join(ROOT, rel);
  const dest = path.join(outDir, name);
  if (!fs.existsSync(src)) {
    console.warn("skip missing:", rel);
    missing += 1;
    continue;
  }
  fs.copyFileSync(src, dest);
  const kb = (fs.statSync(dest).size / 1024).toFixed(1);
  console.log(`copy ${rel} -> public/data/${name} (${kb} KB)`);
  ok += 1;
}

console.log(`copy-public-data: ${ok} files, ${missing} missing`);
if (ok === 0) {
  console.error("no data copied; run npm run build first");
  process.exit(1);
}
