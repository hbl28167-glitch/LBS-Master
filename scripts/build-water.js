/**
 * Shanghai water bodies (GCJ) for basemap underlay — Huangpu primary.
 * Schematic corridor from public WGS control points → GCJ; optional OSM raw merge later.
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");
const { wgs84ToGcj02 } = require("./lib/gcj");

const OUT = root("data", "processed", "water_shanghai.geojson");

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function toGcjLine(wgsPts) {
  return wgsPts.map(([lng, lat]) => {
    const g = wgs84ToGcj02(lng, lat);
    return [round6(g.lng), round6(g.lat)];
  });
}

/** buffer a centerline to polygon (metres half-width) */
function bufferLine(coords, halfM) {
  if (coords.length < 2) return null;
  const left = [];
  const right = [];
  for (let i = 0; i < coords.length; i++) {
    const [lng, lat] = coords[i];
    let dx;
    let dy;
    if (i === 0) {
      dx = coords[1][0] - lng;
      dy = coords[1][1] - lat;
    } else if (i === coords.length - 1) {
      dx = lng - coords[i - 1][0];
      dy = lat - coords[i - 1][1];
    } else {
      dx = coords[i + 1][0] - coords[i - 1][0];
      dy = coords[i + 1][1] - coords[i - 1][1];
    }
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
    const ex = dx * mPerDegLng;
    const ey = dy * mPerDegLat;
    const len = Math.hypot(ex, ey) || 1;
    const nx = (-ey / len) * halfM;
    const ny = (ex / len) * halfM;
    left.push([round6(lng + nx / mPerDegLng), round6(lat + ny / mPerDegLat)]);
    right.push([
      round6(lng - nx / mPerDegLng),
      round6(lat - ny / mPerDegLat)
    ]);
  }
  const ring = left.concat(right.reverse());
  ring.push(ring[0]);
  return ring;
}

// Huangpu mainstream WGS approx (Minhang → Wusong)
const HUANGPU_WGS = [
  [121.43, 31.0],
  [121.45, 31.05],
  [121.47, 31.1],
  [121.48, 31.14],
  [121.485, 31.17],
  [121.49, 31.19],
  [121.492, 31.21],
  [121.49, 31.225],
  [121.488, 31.235],
  [121.49, 31.245],
  [121.5, 31.255],
  [121.51, 31.27],
  [121.52, 31.29],
  [121.53, 31.31],
  [121.52, 31.33],
  [121.51, 31.35],
  [121.505, 31.37],
  [121.5, 31.39]
];

// Suzhou Creek mouth stretch
const SUZHOU_WGS = [
  [121.42, 31.24],
  [121.44, 31.242],
  [121.46, 31.245],
  [121.48, 31.247],
  [121.49, 31.245]
];

// Dishui Lake ring (approx circle center)
const DISHUI_C = [121.925, 30.905];

function circleRing(lngW, latW, r_m, n = 48) {
  const g = wgs84ToGcj02(lngW, latW);
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((g.lat * Math.PI) / 180);
  const ring = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    ring.push([
      round6(g.lng + (r_m * Math.cos(t)) / mPerDegLng),
      round6(g.lat + (r_m * Math.sin(t)) / mPerDegLat)
    ]);
  }
  return ring;
}

function main() {
  const features = [];

  const hp = toGcjLine(HUANGPU_WGS);
  const hpPoly = bufferLine(hp, 180);
  features.push({
    type: "Feature",
    properties: {
      water_id: "sh:w:huangpu",
      name: "黄浦江",
      water_type: "river",
      source: "schematic_centerline_public",
      fill: "#7DD3FC",
      fill_opacity: 0.55,
      stroke: "#0284C7"
    },
    geometry: { type: "Polygon", coordinates: [hpPoly] }
  });
  features.push({
    type: "Feature",
    properties: {
      water_id: "sh:w:huangpu_cl",
      name: "黄浦江中线",
      water_type: "river_centerline",
      source: "schematic"
    },
    geometry: { type: "LineString", coordinates: hp }
  });

  const sc = toGcjLine(SUZHOU_WGS);
  features.push({
    type: "Feature",
    properties: {
      water_id: "sh:w:suzhou_creek",
      name: "苏州河（下游示意）",
      water_type: "river",
      source: "schematic_centerline_public",
      fill: "#BAE6FD",
      fill_opacity: 0.45,
      stroke: "#0EA5E9"
    },
    geometry: { type: "Polygon", coordinates: [bufferLine(sc, 60)] }
  });

  features.push({
    type: "Feature",
    properties: {
      water_id: "sh:w:dishui_lake",
      name: "滴水湖",
      water_type: "lake",
      source: "schematic_circle_public",
      fill: "#38BDF8",
      fill_opacity: 0.5,
      stroke: "#0284C7"
    },
    geometry: {
      type: "Polygon",
      coordinates: [circleRing(DISHUI_C[0], DISHUI_C[1], 1300)]
    }
  });

  const fc = {
    type: "FeatureCollection",
    crs_note: "GCJ-02",
    ui_default_layer: true,
    attribution:
      "Water geometry: schematic from public geography for sandbox basemap underlay. Prefer OSM waterways when local extract available. © OpenStreetMap contributors when replaced by OSM.",
    features
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(fc));
  console.log(`water: ${features.length} features → ${OUT}`);
}

main();
