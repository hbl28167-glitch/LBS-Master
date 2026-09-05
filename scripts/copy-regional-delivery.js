/**
 * Publish the accepted regional-data-delivery package for the static app.
 * Synthetic seed buildings are intentionally not copied into the visual layer.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "regional-data-delivery", "regions");
const OUTPUT = path.join(ROOT, "public", "data", "regions");
const REGION_IDS = [
  "qiantan_xuhui_riverside",
  "xujiahui_caohejing",
  "hongqiao_hub",
  "zhangjiang",
  "lingang"
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function copy(src, dest) {
  fs.copyFileSync(src, dest);
  return path.basename(dest);
}

if (!fs.existsSync(INPUT)) {
  console.error("regional-data-delivery/regions missing");
  process.exit(1);
}

fs.mkdirSync(OUTPUT, { recursive: true });
const index = { generated_at: new Date().toISOString(), regions: [] };

for (const regionId of REGION_IDS) {
  const source = path.join(INPUT, regionId);
  const processed = path.join(source, "processed");
  const qc = path.join(source, "qc");
  const dest = path.join(OUTPUT, regionId);
  fs.mkdirSync(dest, { recursive: true });

  const buildingsDoc = readJson(path.join(processed, "buildings.gcj02.geojson"));
  const buildings = buildingsDoc.features || [];
  const syntheticBuildings = buildings.filter(function (feature) {
    const sourceName = String((feature.properties || {}).geometry_source || "").toLowerCase();
    return sourceName.indexOf("synthetic") >= 0 || sourceName.indexOf("seed") >= 0;
  }).length;
  const buildingsReal = buildings.length >= 500 && syntheticBuildings === 0;
  const roadQc = readJson(path.join(qc, "road-qc.json"));
  const zoneQc = readJson(path.join(qc, "zone-qc.json"));
  const entityQc = readJson(path.join(qc, "entity-qc.json"));

  const files = {
    roads: copy(
      path.join(processed, "roads-v3.gcj02.geojson"),
      path.join(dest, "roads.geojson")
    ),
    zones: copy(
      path.join(processed, "zones-v3.gcj02.geojson"),
      path.join(dest, "zones.geojson")
    ),
    entities: copy(
      path.join(processed, "entities.json"),
      path.join(dest, "entities.json")
    ),
    metrics: copy(
      path.join(processed, "scenario-metrics.json"),
      path.join(dest, "scenario-metrics.json")
    )
  };

  if (buildingsReal) {
    files.buildings = copy(
      path.join(processed, "buildings.gcj02.geojson"),
      path.join(dest, "buildings.geojson")
    );
  }

  const status =
    buildingsReal && roadQc.status === "pass" ? "ready" : "conditional";
  const meta = {
    region_id: regionId,
    status: status,
    buildings_real: buildingsReal,
    buildings_visualized: buildingsReal ? buildings.length : 0,
    buildings_reported: buildings.length,
    synthetic_buildings_hidden: buildingsReal ? 0 : syntheticBuildings,
    road_qc: roadQc,
    zone_qc: zoneQc,
    entity_qc: entityQc,
    files: files,
    disclosure: buildingsReal
      ? "OSM buildings · ODbL"
      : "Synthetic seed buildings hidden; roads/zones/entities are shown with a conditional badge."
  };
  fs.writeFileSync(path.join(dest, "meta.json"), JSON.stringify(meta, null, 2));
  index.regions.push(meta);
  console.log(
    regionId +
      ": " +
      status +
      " · roads " +
      roadQc.feature_count +
      " · zones " +
      zoneQc.zone_count +
      " · buildings shown " +
      meta.buildings_visualized
  );
}

fs.writeFileSync(path.join(OUTPUT, "index.json"), JSON.stringify(index, null, 2));
console.log("regional delivery published:", index.regions.length, "regions");
