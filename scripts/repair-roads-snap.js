/**
 * Endpoint snap: merge nearby LineString endpoints (ε metres).
 * Env: LBS_ROAD_SNAP_M (default 2, max 5)
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");

const IN =
  process.argv[2] || root("data", "processed", "roads_gcj.pre.geojson");
const OUT =
  process.argv[3] || root("data", "processed", "roads_gcj.geojson");
const LOG = root("data", "processed", "roads_snap_log.json");

function snapM() {
  let m = Number(process.env.LBS_ROAD_SNAP_M || 2);
  if (!Number.isFinite(m) || m <= 0) m = 2;
  if (m > 5) m = 5;
  return m;
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

/** local metres projection helpers at lat */
function toXY(lng, lat, lat0) {
  const mx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return { x: lng * mx, y: lat * 111320 };
}

function main() {
  const eps = snapM();
  if (!fs.existsSync(IN)) {
    // allow snap in-place from existing roads_gcj
    const fallback = root("data", "processed", "roads_gcj.geojson");
    if (!fs.existsSync(fallback)) {
      console.error("missing input", IN);
      process.exit(1);
    }
    fs.copyFileSync(fallback, IN);
  }

  const gj = JSON.parse(fs.readFileSync(IN, "utf8"));
  const features = gj.features || [];

  // Collect endpoints with feature refs
  const tips = [];
  features.forEach((f, fi) => {
    const g = f.geometry;
    if (!g) return;
    const lines =
      g.type === "LineString"
        ? [g.coordinates]
        : g.type === "MultiLineString"
          ? g.coordinates
          : [];
    lines.forEach((coords, li) => {
      if (!coords || coords.length < 2) return;
      tips.push({ fi, li, end: 0, lng: coords[0][0], lat: coords[0][1] });
      tips.push({
        fi,
        li,
        end: 1,
        lng: coords[coords.length - 1][0],
        lat: coords[coords.length - 1][1]
      });
    });
  });

  const lat0 = 31.2;
  const cellM = Math.max(eps, 1);
  const mx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const cellLng = cellM / mx;
  const cellLat = cellM / 111320;

  const grid = new Map();
  tips.forEach((t, idx) => {
    const gx = Math.floor(t.lng / cellLng);
    const gy = Math.floor(t.lat / cellLat);
    const k = gx + ":" + gy;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(idx);
  });

  const parent = tips.map((_, i) => i);
  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function union(a, b) {
    a = find(a);
    b = find(b);
    if (a !== b) parent[a] = b;
  }

  const eps2 = eps * eps;
  for (let i = 0; i < tips.length; i++) {
    const t = tips[i];
    const gx = Math.floor(t.lng / cellLng);
    const gy = Math.floor(t.lat / cellLat);
    const p1 = toXY(t.lng, t.lat, lat0);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(gx + dx + ":" + (gy + dy));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue;
          const u = tips[j];
          // skip same feature both ends only if identical index pair mid — allow
          const p2 = toXY(u.lng, u.lat, lat0);
          const d2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
          if (d2 <= eps2) union(i, j);
        }
      }
    }
  }

  const clusters = new Map();
  for (let i = 0; i < tips.length; i++) {
    const r = find(i);
    if (!clusters.has(r)) clusters.set(r, []);
    clusters.get(r).push(i);
  }

  let mergedClusters = 0;
  let tipsMoved = 0;
  const repCoord = new Map();
  for (const [, members] of clusters) {
    if (members.length < 2) {
      const t = tips[members[0]];
      repCoord.set(members[0], [t.lng, t.lat]);
      continue;
    }
    mergedClusters++;
    let slng = 0;
    let slat = 0;
    for (const mi of members) {
      slng += tips[mi].lng;
      slat += tips[mi].lat;
    }
    const c = [round6(slng / members.length), round6(slat / members.length)];
    for (const mi of members) {
      repCoord.set(mi, c);
      if (tips[mi].lng !== c[0] || tips[mi].lat !== c[1]) tipsMoved++;
    }
  }

  // apply
  const touched = new Set();
  for (let i = 0; i < tips.length; i++) {
    const t = tips[i];
    const c = repCoord.get(i);
    if (!c) continue;
    const f = features[t.fi];
    const g = f.geometry;
    let coords;
    if (g.type === "LineString") coords = g.coordinates;
    else coords = g.coordinates[t.li];
    if (t.end === 0) {
      if (coords[0][0] !== c[0] || coords[0][1] !== c[1]) {
        coords[0] = c;
        touched.add(t.fi);
      }
    } else {
      const last = coords.length - 1;
      if (coords[last][0] !== c[0] || coords[last][1] !== c[1]) {
        coords[last] = c;
        touched.add(t.fi);
      }
    }
  }

  gj.snap = {
    eps_m: eps,
    merged_clusters: mergedClusters,
    tips_moved: tipsMoved,
    features_touched: touched.size
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(gj));
  const log = {
    built_at: new Date().toISOString(),
    input: path.relative(root(), IN),
    output: path.relative(root(), OUT),
    eps_m: eps,
    tip_count: tips.length,
    merged_clusters: mergedClusters,
    tips_moved: tipsMoved,
    features_touched: touched.size
  };
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2));
  console.log(
    `snap: eps=${eps}m clusters=${mergedClusters} tips_moved=${tipsMoved} features=${touched.size} → ${OUT}`
  );
}

main();
