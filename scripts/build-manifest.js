/**
 * Write data/processed/manifest.json for Gate B / WS-D.
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");
const { wgs84ToGcj02 } = require("./lib/gcj");
const { SHANGHAI_BBOX_WGS84 } = require("./lib/bbox");

const OUT = root("data", "processed", "manifest.json");

function main() {
  const b = SHANGHAI_BBOX_WGS84;
  const sw = wgs84ToGcj02(b.minLng, b.minLat);
  const ne = wgs84ToGcj02(b.maxLng, b.maxLat);
  const bbox_gcj = [
    Math.round(sw.lng * 1e6) / 1e6,
    Math.round(sw.lat * 1e6) / 1e6,
    Math.round(ne.lng * 1e6) / 1e6,
    Math.round(ne.lat * 1e6) / 1e6
  ];

  const gridsPath = root("data", "processed", "grids.json");
  const gridsFinePath = root("data", "processed", "grids_fine.json");
  const zonesPath = root("data", "processed", "zones_shanghai.json");
  const waterPath = root("data", "processed", "water_shanghai.geojson");
  const roadsPath = root("data", "processed", "roads_gcj.geojson");
  const roadsMetaPath = root("data", "processed", "roads_meta.json");
  const ridePath = root("data", "processed", "metrics_ride.json");
  const chgPath = root("data", "processed", "metrics_chg.json");
  const chgEntPath = root("data", "processed", "entities_charger.json");

  let grid_count = 0;
  let cell_m = null;
  let grid_id_rule = "sh:{cell_m}:{row}:{col}";
  let legacy_grids_ui_default = false;
  if (fs.existsSync(gridsPath)) {
    const g = JSON.parse(fs.readFileSync(gridsPath, "utf8"));
    grid_count = g.count || (g.grids && g.grids.length) || 0;
    cell_m = g.cell_m;
    if (g.grid_id_rule) grid_id_rule = g.grid_id_rule;
    legacy_grids_ui_default = !!g.ui_default_layer;
  }

  let fine_grid_count = 0;
  let fine_grid_id_rule = "sh:f:{cell_m}:{row}:{col}";
  if (fs.existsSync(gridsFinePath)) {
    const fg = JSON.parse(fs.readFileSync(gridsFinePath, "utf8"));
    fine_grid_count = fg.count || (fg.grids && fg.grids.length) || 0;
    if (fg.grid_id_rule) fine_grid_id_rule = fg.grid_id_rule;
  }

  let zone_count = 0;
  let zone_id_rule = "sh:z:{type}:{slug}";
  if (fs.existsSync(zonesPath)) {
    const z = JSON.parse(fs.readFileSync(zonesPath, "utf8"));
    zone_count = z.count || (z.zones && z.zones.length) || 0;
    if (z.zone_id_rule) zone_id_rule = z.zone_id_rule;
  }

  let water_features = 0;
  if (fs.existsSync(waterPath)) {
    water_features =
      (JSON.parse(fs.readFileSync(waterPath, "utf8")).features || []).length;
  }

  let road_features = 0;
  let roads_source = null;
  if (fs.existsSync(roadsPath)) {
    const r = JSON.parse(fs.readFileSync(roadsPath, "utf8"));
    road_features = (r.features || []).length;
  }
  if (fs.existsSync(roadsMetaPath)) {
    roads_source = JSON.parse(fs.readFileSync(roadsMetaPath, "utf8")).source;
  }

  function rowCount(p) {
    if (!fs.existsSync(p)) return null;
    const d = JSON.parse(fs.readFileSync(p, "utf8"));
    return d.count != null
      ? d.count
      : (d.rows && d.rows.length) ||
          (d.entities && d.entities.length) ||
          null;
  }

  const metrics_ride_count = rowCount(ridePath);
  const metrics_chg_count = rowCount(chgPath);
  const entities_charger_count = rowCount(chgEntPath);

  const manifest = {
    version: "0.2.0",
    bbox_gcj,
    built_at: new Date().toISOString(),
    osm_attribution: "© OpenStreetMap contributors",
    synthetic: true,
    synthetic_note:
      "All ride/chg metrics and 小李 charger entities are Synthetic; not real ops data.",
    zone_id_rule,
    zone_count,
    water_features,
    fine_grid_id_rule,
    fine_grid_count,
    grid_id_rule,
    cell_m,
    grid_count,
    legacy_1km_grids_ui_default: legacy_grids_ui_default,
    ui_default_layers: ["basemap", "water", "roads", "zones"],
    road_features,
    roads_source,
    metrics_ride_count,
    metrics_chg_count,
    entities_charger_count,
    artifacts: {
      zones: "data/processed/zones_shanghai.geojson",
      zones_index: "data/processed/zones_shanghai.json",
      water: "data/processed/water_shanghai.geojson",
      grids_fine: "data/processed/grids_fine.json",
      grids_legacy: "data/processed/grids.json",
      roads_gcj: "data/processed/roads_gcj.geojson",
      anchors: "data/static/anchors_shanghai.json",
      weather_coeff: "data/static/weather_coeff.json",
      calendar: "data/static/calendar.json",
      metrics_ride: "data/processed/metrics_ride.json",
      metrics_chg: "data/processed/metrics_chg.json",
      entities_charger: "data/processed/entities_charger.json",
      attribution: "docs/data-attribution.md",
      alignment_sample: "docs/alignment-sample.md",
      synthetic_rules: "docs/synthetic-rules.md"
    }
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));
  console.log(`manifest → ${OUT}`);
}

main();
