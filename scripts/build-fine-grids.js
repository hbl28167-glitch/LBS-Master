/**
 * Variable-resolution heat grids (05.1):
 * - urban core ~250m
 * - suburban ~500m
 * - rural/open ~1000m
 * grid_id FROZEN: sh:f:{cell_m}:{row}:{col}
 * NOT the old 1km product fishnet (that is legacy compute only).
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");
const { wgs84ToGcj02 } = require("./lib/gcj");
const { SHANGHAI_BBOX_WGS84 } = require("./lib/bbox");

const OUT = root("data", "processed", "grids_fine.json");
const OUT_LEGACY_NOTE = root("data", "processed", "grids_legacy_meta.json");

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}
function mToDegLat(m) {
  return m / 111320;
}
function mToDegLng(m, lat) {
  return m / (111320 * Math.cos((lat * Math.PI) / 180));
}

/** resolution band by location (WGS) */
function cellSizeFor(lng, lat) {
  // urban core Shanghai
  if (lng > 121.3 && lng < 121.65 && lat > 31.1 && lat < 31.35) return 250;
  // expanded built-up
  if (lng > 121.15 && lng < 121.85 && lat > 30.95 && lat < 31.45) return 500;
  // lingang town
  if (lng > 121.85 && lng < 122.05 && lat > 30.82 && lat < 30.98) return 250;
  // hongqiao
  if (lng > 121.25 && lng < 121.4 && lat > 31.15 && lat < 31.25) return 250;
  return 1000;
}

function main() {
  const b = SHANGHAI_BBOX_WGS84;
  // base tessellation at 250m, then keep cell if its center's band matches
  // (avoids overlapping multi-res): use 250m lattice, assign size label,
  // emit only cells where floor-aligned block matches preferred size.
  const base = 250;
  const midLat = (b.minLat + b.maxLat) / 2;
  const dLat = mToDegLat(base);
  const dLng = mToDegLng(base, midLat);
  const nRows = Math.ceil((b.maxLat - b.minLat) / dLat);
  const nCols = Math.ceil((b.maxLng - b.minLng) / dLng);

  const grids = [];
  const counts = { 250: 0, 500: 0, 1000: 0 };

  for (let row = 0; row < nRows; row++) {
    for (let col = 0; col < nCols; col++) {
      const latW = b.maxLat - (row + 0.5) * dLat;
      const lngW = b.minLng + (col + 0.5) * dLng;
      if (latW < b.minLat || lngW > b.maxLng) continue;
      const want = cellSizeFor(lngW, latW);
      // subsample lattice: 250→every 1; 500→row/col even; 1000→mod 4
      const step = want / base;
      if (row % step !== 0 || col % step !== 0) continue;
      // center of the larger cell
      const latC = b.maxLat - (row + step / 2) * dLat;
      const lngC = b.minLng + (col + step / 2) * dLng;
      if (cellSizeFor(lngC, latC) !== want) continue;

      const g = wgs84ToGcj02(lngC, latC);
      const rId = Math.floor(row / step);
      const cId = Math.floor(col / step);
      const grid_id = `sh:f:${want}:${rId}:${cId}`;
      grids.push({
        grid_id,
        cell_lng: round6(g.lng),
        cell_lat: round6(g.lat),
        cell_m: want,
        landuse: want >= 1000 ? "other" : "mixed",
        is_valid: true,
        labels: want >= 1000 ? ["coarse"] : want === 500 ? ["suburban"] : ["fine"],
        product_layer: true,
        heat_mode: "fine_grid"
      });
      counts[want]++;
    }
  }

  const payload = {
    version: "0.2.0",
    grid_id_rule: "sh:f:{cell_m}:{row}:{col}",
    purpose: "heat_mode_fine_grid_variable_resolution",
    ui_default_layer: false,
    product_layer: true,
    note: "Default map heat uses zones; this file is for heat mode=细格 only. Old 1km sh:{cell_m}:{row}:{col} is legacy compute.",
    counts_by_cell_m: counts,
    count: grids.length,
    grids
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload));

  // mark legacy 1km grids if present
  const legacyPath = root("data", "processed", "grids.json");
  if (fs.existsSync(legacyPath)) {
    const legacy = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
    legacy.ui_default_layer = false;
    legacy.product_layer = false;
    legacy.deprecated_for_ui =
      "05.1: 1km citywide fishnet removed from product default; use zones + grids_fine";
    legacy.replacement = {
      zones: "data/processed/zones_shanghai.geojson",
      fine_grids: "data/processed/grids_fine.json"
    };
    fs.writeFileSync(legacyPath, JSON.stringify(legacy));
    fs.writeFileSync(
      OUT_LEGACY_NOTE,
      JSON.stringify(
        {
          legacy_grid_id_rule: legacy.grid_id_rule || "sh:{cell_m}:{row}:{col}",
          ui_default_layer: false,
          product_layer: false,
          kept_for: "WS-C metrics join backward compat until C migrates to zones"
        },
        null,
        2
      )
    );
  }

  console.log(
    `fine grids: ${grids.length} ${JSON.stringify(counts)} → ${OUT}`
  );
}

main();
