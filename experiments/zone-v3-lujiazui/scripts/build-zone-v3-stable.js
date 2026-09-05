"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "processed");
const PREVIEW = path.join(ROOT, "preview", "data");
const buildingsFc = JSON.parse(fs.readFileSync(path.join(OUT, "buildings.geojson"), "utf8"));
const roadsFc = JSON.parse(fs.readFileSync(path.join(OUT, "roads-v3.geojson"), "utf8"));

const BBOX = { west: 121.479, south: 31.217, east: 121.54, north: 31.263 };
const COLS = 360, ROWS = 300;
const DX = (BBOX.east - BBOX.west) / COLS, DY = (BBOX.north - BBOX.south) / ROWS;
const N = COLS * ROWS;
const seed = new Uint8Array(N), support = new Uint8Array(N), barrier = new Uint8Array(N), land = new Uint8Array(N);
const component = new Int32Array(N); component.fill(-1);
const idx = (x, y) => y * COLS + x;
const cell = c => [Math.max(0, Math.min(COLS - 1, Math.floor((c[0] - BBOX.west) / DX))), Math.max(0, Math.min(ROWS - 1, Math.floor((c[1] - BBOX.south) / DY)))];

function ringCenter(ring) {
  const pts = ring.slice(0, -1);
  const s = pts.reduce((a, c) => [a[0] + c[0], a[1] + c[1]], [0, 0]);
  return [s[0] / pts.length, s[1] / pts.length];
}

function areaM2(ring) {
  const cos = Math.cos(31.24 * Math.PI / 180), sx = 111320 * cos, sy = 110540;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * sx * ring[i + 1][1] * sy - ring[i + 1][0] * sx * ring[i][1] * sy;
  return Math.abs(sum / 2);
}

const buildingInfo = buildingsFc.features.map((f, i) => {
  const ring = f.geometry.coordinates[0], center = ringCenter(ring), [x, y] = cell(center);
  seed[idx(x, y)] = 1;
  return { index: i, feature: f, center, x, y, area: areaM2(ring), component: -1 };
});

// A wider support mask is kept only as a safety valve for abnormally large
// components caused by a gap in riverside roads. Normal road blocks stay whole.
for (const b of buildingInfo) {
  for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
    const x = b.x + ox, y = b.y + oy;
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS && ox * ox + oy * oy <= 10) support[idx(x, y)] = 1;
  }
}

// Start from continuous land and let the complete Road V3 network cut it into
// parcels. Components without buildings are removed later, so river/open-space
// voids do not become fabricated functional zones.
land.fill(1);

const barrierRadius = { R1: 2, R2: 2, R3: 1, R4: 1, R5: 0, R6: 0 };
for (const road of roadsFc.features) {
  const cs = road.geometry.coordinates, radius = barrierRadius[road.properties.road_grade] || 0;
  for (let i = 0; i < cs.length - 1; i++) {
    const a = cell(cs[i]), b = cell(cs[i + 1]);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) * 1.5));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, cx = Math.round(a[0] + (b[0] - a[0]) * t), cy = Math.round(a[1] + (b[1] - a[1]) * t);
      for (let oy = -radius; oy <= radius; oy++) for (let ox = -radius; ox <= radius; ox++) {
        const x = cx + ox, y = cy + oy;
        if (x >= 0 && x < COLS && y >= 0 && y < ROWS) barrier[idx(x, y)] = 1;
      }
    }
  }
}
for (let i = 0; i < N; i++) if (barrier[i]) land[i] = 0;

const components = [];
for (let start = 0; start < N; start++) {
  if (!land[start] || component[start] >= 0) continue;
  const id = components.length, queue = [start], cells = [];
  component[start] = id;
  for (let q = 0; q < queue.length; q++) {
    const p = queue[q], x = p % COLS, y = Math.floor(p / COLS); cells.push(p);
    const ns = [x > 0 ? p - 1 : -1, x + 1 < COLS ? p + 1 : -1, y > 0 ? p - COLS : -1, y + 1 < ROWS ? p + COLS : -1];
    for (const n of ns) if (n >= 0 && land[n] && component[n] < 0) { component[n] = id; queue.push(n); }
  }
  components.push({ id, cells, buildings: [] });
}

function findComponent(x, y) {
  const direct = component[idx(x, y)];
  if (direct >= 0) return direct;
  let best = -1, bestD = Infinity;
  for (let r = 1; r <= 7; r++) for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
    const xx = x + ox, yy = y + oy;
    if (xx < 0 || xx >= COLS || yy < 0 || yy >= ROWS) continue;
    const c = component[idx(xx, yy)], d = ox * ox + oy * oy;
    if (c >= 0 && d < bestD) { best = c; bestD = d; }
  }
  return best;
}
for (const b of buildingInfo) {
  b.component = findComponent(b.x, b.y);
  if (b.component >= 0) components[b.component].buildings.push(b);
}

const typeVote = type => {
  const t = String(type || "yes").toLowerCase();
  if (/apartments|residential|house|dormitory|hut/.test(t)) return ["residential", 3];
  if (/commercial|retail|hotel/.test(t)) return ["commercial", 3];
  if (/office|skyscraper/.test(t)) return ["office", 4];
  if (/industrial|warehouse|garage/.test(t)) return ["industrial", 4];
  if (/school|kindergarten|hospital|college|university|stadium|museum|temple|church|hall/.test(t)) return ["public_service", 3];
  return null;
};

function classify(comp) {
  const votes = { commercial: 0, office: 0, residential: 0, industrial: 0, public_service: 0 };
  let lng = 0, lat = 0, avgArea = 0, generic = 0;
  for (const b of comp.buildings) {
    lng += b.center[0]; lat += b.center[1]; avgArea += b.area;
    const vote = typeVote(b.feature.properties.building);
    if (vote) votes[vote[0]] += vote[1]; else generic++;
  }
  const n = Math.max(1, comp.buildings.length); lng /= n; lat /= n; avgArea /= n;
  const dx = (lng - 121.505) * 95, dy = (lat - 31.238) * 111, coreKm = Math.hypot(dx, dy);
  if (coreKm < 1.4) { votes.office += generic * 0.8 + 2; votes.commercial += generic * 0.65 + 2; }
  else if ((lng > 121.525 || lat < 31.224) && avgArea > 900) votes.industrial += generic * 0.75 + 1;
  else votes.residential += generic * 0.75 + 1;
  if (lat > 31.248 && lng < 121.505) votes.commercial += generic * 0.25;
  const ordered = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const total = ordered.reduce((s, x) => s + x[1], 0) || 1, confidence = ordered[0][1] / total;
  return { dominant: ordered[0][0], functional_type: confidence < 0.55 && ordered[1][1] > 0 ? "mixed" : ordered[0][0], confidence: +confidence.toFixed(2), votes, center: [lng, lat], avgArea: Math.round(avgArea) };
}

function cellRuns(cells) {
  const rows = new Map();
  for (const p of cells) {
    const x = p % COLS, y = Math.floor(p / COLS);
    if (!rows.has(y)) rows.set(y, []); rows.get(y).push(x);
  }
  const polygons = [];
  for (const [y, xs] of rows) {
    xs.sort((a, b) => a - b);
    let start = xs[0], prev = xs[0];
    const emit = (a, b) => {
      const w = BBOX.west + a * DX, e = BBOX.west + (b + 1) * DX, s = BBOX.south + y * DY, n = s + DY;
      polygons.push([[[w, s], [e, s], [e, n], [w, n], [w, s]]]);
    };
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] !== prev + 1) { emit(start, prev); start = xs[i]; }
      prev = xs[i];
    }
    emit(start, prev);
  }
  return polygons;
}

const features = [];
for (const comp of components) {
  if (!comp.buildings.length || comp.cells.length < 3) continue;
  const displayCells = comp.cells.length > 1400 ? comp.cells.filter(p => support[p]) : comp.cells;
  if (displayCells.length < 3) continue;
  const c = classify(comp);
  features.push({
    type: "Feature",
    properties: {
      parcel_id: `lz:stable:${String(features.length + 1).padStart(4, "0")}`,
      geometry_method: "building_support_minus_road_barriers",
      functional_type: c.functional_type,
      dominant_type: c.dominant,
      confidence: c.confidence,
      building_count: comp.buildings.length,
      avg_building_area_m2: c.avgArea,
      centroid_lng: +c.center[0].toFixed(6),
      centroid_lat: +c.center[1].toFixed(6),
      parcel_area_m2: Math.round(displayCells.length * DX * 111320 * Math.cos(31.24 * Math.PI / 180) * DY * 110540),
      safety_clipped: displayCells.length !== comp.cells.length,
      classification_source: "OSM_building_tags+Synthetic_spatial_prior",
      synthetic_classification: true
    },
    geometry: { type: "MultiPolygon", coordinates: cellRuns(displayCells) }
  });
}

const assigned = buildingInfo.filter(b => b.component >= 0 && components[b.component].buildings.length).length;
const sideStats = side => {
  const list = buildingInfo.filter(b => side === "puxi" ? b.center[0] < 121.50 : b.center[0] >= 121.50);
  const ok = list.filter(b => b.component >= 0).length;
  return { buildings: list.length, assigned: ok, assignment_rate: +(ok / list.length).toFixed(3) };
};
const byType = {};
for (const f of features) byType[f.properties.functional_type] = (byType[f.properties.functional_type] || 0) + 1;
const payload = { type: "FeatureCollection", meta: { experimental: true, grid: { cols: COLS, rows: ROWS }, classification: "Synthetic", topology: "OSM" }, features };
const summary = { parcels: features.length, waterfront_review_parcels: features.filter(f => f.properties.safety_clipped).length, buildings: buildingInfo.length, assigned_buildings: assigned, assignment_rate: +(assigned / buildingInfo.length).toFixed(3), by_side: { puxi: sideStats("puxi"), pudong: sideStats("pudong") }, by_type: byType };
for (const dir of [OUT, PREVIEW]) {
  fs.writeFileSync(path.join(dir, "zones-v3-stable.geojson"), JSON.stringify(payload));
  fs.writeFileSync(path.join(dir, "zones-v3-stable-summary.json"), JSON.stringify(summary, null, 2));
}
console.log(JSON.stringify(summary, null, 2));
