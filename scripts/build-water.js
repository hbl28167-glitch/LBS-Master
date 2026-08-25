/**
 * Water layer placeholder (05.1).
 * Schematic Huangpu/etc. removed — too inaccurate vs basemap.
 * Emits empty FeatureCollection so UI can load without 404.
 * Future: OSM water extract only when quality-checked.
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");

const OUT = root("data", "processed", "water_shanghai.geojson");

function main() {
  const fc = {
    type: "FeatureCollection",
    crs_note: "GCJ-02",
    ui_default_layer: false,
    disabled_reason:
      "Schematic water (Huangpu etc.) removed — geometry too far from reality. Prefer Gaode basemap rivers until OSM water QC ready.",
    attribution: "No synthetic water polygons. Basemap shows real waterways.",
    features: []
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(fc, null, 2));
  console.log(`water: 0 features (disabled) → ${OUT}`);
}

main();
