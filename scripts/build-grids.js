/**
 * Shanghai fishnet grids in GCJ-02.
 * grid_id FROZEN: sh:{cell_m}:{row}:{col}
 * row increases north→south (from maxLat); col west→east (from minLng).
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");
const { wgs84ToGcj02 } = require("./lib/gcj");
const { SHANGHAI_BBOX_WGS84, DEFAULT_CELL_M } = require("./lib/bbox");

const OUT = root("data", "processed", "grids.json");

function cellM() {
  const n = Number(process.env.LBS_CELL_M || DEFAULT_CELL_M);
  if (!Number.isFinite(n) || n < 500 || n > 1000) {
    throw new Error("LBS_CELL_M must be 500–1000");
  }
  return Math.round(n);
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

/** metres → degrees at given latitude */
function mToDegLat(m) {
  return m / 111320;
}
function mToDegLng(m, lat) {
  return m / (111320 * Math.cos((lat * Math.PI) / 180));
}

function main() {
  const cell_m = cellM();
  const b = SHANGHAI_BBOX_WGS84;

  // Build fishnet in WGS then convert cell centers to GCJ for storage.
  // Grid indices use WGS-aligned origin so rebuild is stable.
  const midLat = (b.minLat + b.maxLat) / 2;
  const dLat = mToDegLat(cell_m);
  const dLng = mToDegLng(cell_m, midLat);

  const nRows = Math.ceil((b.maxLat - b.minLat) / dLat);
  const nCols = Math.ceil((b.maxLng - b.minLng) / dLng);

  const grids = [];
  for (let row = 0; row < nRows; row++) {
    for (let col = 0; col < nCols; col++) {
      const latW = b.maxLat - (row + 0.5) * dLat;
      const lngW = b.minLng + (col + 0.5) * dLng;
      if (latW < b.minLat || lngW > b.maxLng) continue;
      const g = wgs84ToGcj02(lngW, latW);
      const grid_id = `sh:${cell_m}:${row}:${col}`;
      grids.push({
        grid_id,
        cell_lng: round6(g.lng),
        cell_lat: round6(g.lat),
        landuse: "other",
        is_valid: true,
        labels: [],
        _row: row,
        _col: col,
        _cell_m: cell_m
      });
    }
  }

  // strip internal fields for contract purity in output
  const publicGrids = grids.map(
    ({ grid_id, cell_lng, cell_lat, landuse, is_valid, labels }) => ({
      grid_id,
      cell_lng,
      cell_lat,
      landuse,
      is_valid,
      labels
    })
  );

  const payload = {
    version: "0.1.0",
    grid_id_rule: "sh:{cell_m}:{row}:{col}",
    cell_m,
    bbox_wgs84: [b.minLng, b.minLat, b.maxLng, b.maxLat],
    n_rows: nRows,
    n_cols: nCols,
    count: publicGrids.length,
    grids: publicGrids
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload));
  console.log(
    `grids: ${publicGrids.length} cells cell_m=${cell_m} → ${OUT}`
  );
}

main();
