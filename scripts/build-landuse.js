/**
 * Assign landuse + labels on grids using anchors distance + overrides.
 * Mutates data/processed/grids.json in place (same file WS-C reads).
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");

const GRIDS = root("data", "processed", "grids.json");
const ANCHORS = root("data", "static", "anchors_shanghai.json");

/** haversine metres */
function distM(lng1, lat1, lng2, lat2) {
  const R = 6371000;
  const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLng = toR(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Hard overrides: circle around known districts (GCJ) */
const OVERRIDES = [
  {
    name: "lujiazui_office_core",
    lng: 121.5055,
    lat: 31.2397,
    r_m: 1800,
    landuse: "office",
    labels: ["lujiazui", "cbd"]
  },
  {
    name: "lingang_core",
    lng: 121.92,
    lat: 30.9,
    r_m: 4500,
    landuse: "mixed",
    labels: ["lingang"]
  },
  {
    name: "hongqiao_hub",
    lng: 121.3205,
    lat: 31.1975,
    r_m: 2200,
    landuse: "hub",
    labels: ["hongqiao"]
  },
  {
    name: "pudong_airport",
    lng: 121.8056,
    lat: 31.1443,
    r_m: 2500,
    landuse: "hub",
    labels: ["pvg"]
  },
  {
    name: "zhangjiang_park",
    lng: 121.6045,
    lat: 31.2055,
    r_m: 2500,
    landuse: "industrial_park",
    labels: ["zhangjiang"]
  }
];

const ANCHOR_RADIUS_M = 1200;

function main() {
  if (!fs.existsSync(GRIDS)) {
    console.error("missing grids.json — run build-grids first");
    process.exit(1);
  }
  const pack = JSON.parse(fs.readFileSync(GRIDS, "utf8"));
  const anchorsDoc = JSON.parse(fs.readFileSync(ANCHORS, "utf8"));
  const anchors = anchorsDoc.anchors || [];

  let overrideHits = 0;
  let anchorHits = 0;

  for (const cell of pack.grids) {
    let landuse = "other";
    const labels = new Set();

    // 1) hard overrides (priority)
    let hitOverride = null;
    let bestOR = Infinity;
    for (const o of OVERRIDES) {
      const d = distM(cell.cell_lng, cell.cell_lat, o.lng, o.lat);
      if (d <= o.r_m && d < bestOR) {
        bestOR = d;
        hitOverride = o;
      }
    }
    if (hitOverride) {
      landuse = hitOverride.landuse;
      hitOverride.labels.forEach((l) => labels.add(l));
      overrideHits++;
    }

    // 2) nearest anchor within radius
    let bestA = null;
    let bestD = Infinity;
    for (const a of anchors) {
      const d = distM(cell.cell_lng, cell.cell_lat, a.lng, a.lat);
      if (d < bestD) {
        bestD = d;
        bestA = a;
      }
    }
    if (bestA && bestD <= ANCHOR_RADIUS_M) {
      if (!hitOverride) {
        landuse = bestA.landuse || "mixed";
        anchorHits++;
      }
      labels.add(bestA.id);
      (bestA.labels || []).forEach((l) => labels.add(l));
    }

    // 3) coarse ring rule: outer sparse → residential/mixed heuristic
    if (!hitOverride && !(bestA && bestD <= ANCHOR_RADIUS_M)) {
      // Huangpu/Puxi denser band
      if (
        cell.cell_lng > 121.4 &&
        cell.cell_lng < 121.55 &&
        cell.cell_lat > 31.15 &&
        cell.cell_lat < 31.3
      ) {
        landuse = "residential";
        labels.add("core_urban");
      } else if (
        cell.cell_lng > 121.85 &&
        cell.cell_lat < 31.0 &&
        cell.cell_lat > 30.75
      ) {
        landuse = "mixed";
        labels.add("lingang_belt");
      } else {
        landuse = "other";
      }
    }

    // water-ish invalid: rough Yangtze mouth / far east open water
    if (cell.cell_lng > 121.95 && cell.cell_lat > 31.35) {
      cell.is_valid = false;
      labels.add("water_edge");
    } else {
      cell.is_valid = true;
    }

    cell.landuse = landuse;
    cell.labels = [...labels];
  }

  fs.writeFileSync(GRIDS, JSON.stringify(pack));
  console.log(
    `landuse: overrideHits≈${overrideHits} anchorNear=${anchorHits} cells=${pack.grids.length}`
  );
}

main();
