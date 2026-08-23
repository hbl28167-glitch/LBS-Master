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
  const roadsPath = root("data", "processed", "roads_gcj.geojson");
  const roadsMetaPath = root("data", "processed", "roads_meta.json");

  let grid_count = 0;
  let cell_m = null;
  let grid_id_rule = "sh:{cell_m}:{row}:{col}";
  if (fs.existsSync(gridsPath)) {
    const g = JSON.parse(fs.readFileSync(gridsPath, "utf8"));
    grid_count = g.count || (g.grids && g.grids.length) || 0;
    cell_m = g.cell_m;
    if (g.grid_id_rule) grid_id_rule = g.grid_id_rule;
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

  const manifest = {
    version: "0.1.0",
    bbox_gcj,
    built_at: new Date().toISOString(),
    osm_attribution: "© OpenStreetMap contributors",
    synthetic: true,
    grid_id_rule,
    cell_m,
    grid_count,
    road_features,
    roads_source,
    artifacts: {
      grids: "data/processed/grids.json",
      roads_gcj: "data/processed/roads_gcj.geojson",
      anchors: "data/static/anchors_shanghai.json",
      alignment_sample: "docs/alignment-sample.md"
    }
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));
  console.log(`manifest → ${OUT}`);
}

main();
