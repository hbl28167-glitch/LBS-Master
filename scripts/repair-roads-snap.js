/**
 * Road topology repair:
 * 1) Merge nearby endpoints (ε m)
 * 2) Snap dangling endpoints onto nearby mid-vertices / segments (T-junctions)
 *
 * Env:
 *   LBS_ROAD_SNAP_M   endpoint cluster ε (default 2, max 5)
 *   LBS_ROAD_TJOIN_M  tip→vertex snap (default 8, max 15)
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");

const IN =
  process.argv[2] || root("data", "processed", "roads_gcj.pre.geojson");
const OUT =
  process.argv[3] || root("data", "processed", "roads_gcj.geojson");
const LOG = root("data", "processed", "roads_snap_log.json");

const LAT0 = 31.2;
const MX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const MY = 111320;

function envM(name, def, max) {
  let m = Number(process.env[name] || def);
  if (!Number.isFinite(m) || m <= 0) m = def;
  if (m > max) m = max;
  return m;
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function toXY(lng, lat) {
  return { x: lng * MX, y: lat * MY };
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function ensureInput() {
  if (fs.existsSync(IN)) return IN;
  const fallback = root("data", "processed", "roads_gcj.geojson");
  if (!fs.existsSync(fallback)) {
    console.error("missing input", IN);
    process.exit(1);
  }
  fs.copyFileSync(fallback, IN);
  return IN;
}

function iterLineRefs(features) {
  const refs = [];
  features.forEach((f, fi) => {
    const g = f.geometry;
    if (!g) return;
    if (g.type === "LineString") {
      refs.push({ fi, li: 0, coords: g.coordinates });
    } else if (g.type === "MultiLineString") {
      g.coordinates.forEach((coords, li) => {
        refs.push({ fi, li, coords });
      });
    }
  });
  return refs;
}

function endpointCluster(features, epsM) {
  const tips = [];
  const refs = iterLineRefs(features);
  refs.forEach((ref) => {
    const coords = ref.coords;
    if (!coords || coords.length < 2) return;
    tips.push({
      fi: ref.fi,
      li: ref.li,
      end: 0,
      lng: coords[0][0],
      lat: coords[0][1]
    });
    tips.push({
      fi: ref.fi,
      li: ref.li,
      end: 1,
      lng: coords[coords.length - 1][0],
      lat: coords[coords.length - 1][1]
    });
  });

  const cellM = Math.max(epsM, 1);
  const cellLng = cellM / MX;
  const cellLat = cellM / MY;
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

  const eps2 = epsM * epsM;
  for (let i = 0; i < tips.length; i++) {
    const t = tips[i];
    const p1 = toXY(t.lng, t.lat);
    const gx = Math.floor(t.lng / cellLng);
    const gy = Math.floor(t.lat / cellLat);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(gx + dx + ":" + (gy + dy));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue;
          const u = tips[j];
          const d2 = dist2(p1, toXY(u.lng, u.lat));
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

  const touched = new Set();
  for (let i = 0; i < tips.length; i++) {
    const t = tips[i];
    const c = repCoord.get(i);
    if (!c) continue;
    const f = features[t.fi];
    const g = f.geometry;
    const coords =
      g.type === "LineString" ? g.coordinates : g.coordinates[t.li];
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

  return {
    tips,
    mergedClusters,
    tipsMoved,
    featuresTouched: touched.size
  };
}

/**
 * Snap degree-1 endpoints onto nearby vertices of OTHER ways (T-junction).
 */
function tJunctionSnap(features, joinM) {
  const refs = iterLineRefs(features);
  // vertex spatial hash (all vertices)
  const cellM = Math.max(joinM, 2);
  const cellLng = cellM / MX;
  const cellLat = cellM / MY;
  const vgrid = new Map();

  function addV(lng, lat, fi, li, vi) {
    const gx = Math.floor(lng / cellLng);
    const gy = Math.floor(lat / cellLat);
    const k = gx + ":" + gy;
    if (!vgrid.has(k)) vgrid.set(k, []);
    vgrid.get(k).push({ lng, lat, fi, li, vi });
  }

  refs.forEach((ref) => {
    const coords = ref.coords;
    if (!coords) return;
    for (let vi = 0; vi < coords.length; vi++) {
      addV(coords[vi][0], coords[vi][1], ref.fi, ref.li, vi);
    }
  });

  // endpoint degree for skipping already-connected tips
  const tipKeyCount = new Map();
  function tipKey(lng, lat) {
    return Math.round(lng * 1e5) + ":" + Math.round(lat * 1e5);
  }
  refs.forEach((ref) => {
    const c = ref.coords;
    if (!c || c.length < 2) return;
    const k0 = tipKey(c[0][0], c[0][1]);
    const k1 = tipKey(c[c.length - 1][0], c[c.length - 1][1]);
    tipKeyCount.set(k0, (tipKeyCount.get(k0) || 0) + 1);
    tipKeyCount.set(k1, (tipKeyCount.get(k1) || 0) + 1);
  });

  const join2 = joinM * joinM;
  let tSnaps = 0;
  const touched = new Set();

  refs.forEach((ref) => {
    const coords = ref.coords;
    if (!coords || coords.length < 2) return;
    const ends = [
      { end: 0, lng: coords[0][0], lat: coords[0][1] },
      {
        end: 1,
        lng: coords[coords.length - 1][0],
        lat: coords[coords.length - 1][1]
      }
    ];
    for (const e of ends) {
      const tk = tipKey(e.lng, e.lat);
      if ((tipKeyCount.get(tk) || 0) >= 2) continue; // already multi-way junction

      const p = toXY(e.lng, e.lat);
      const gx = Math.floor(e.lng / cellLng);
      const gy = Math.floor(e.lat / cellLat);
      let best = null;
      let bestD = join2;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = vgrid.get(gx + dx + ":" + (gy + dy));
          if (!bucket) continue;
          for (const v of bucket) {
            if (v.fi === ref.fi) continue; // other way only
            const d2 = dist2(p, toXY(v.lng, v.lat));
            if (d2 < bestD) {
              bestD = d2;
              best = v;
            }
          }
        }
      }
      if (!best) continue;
      const c = [round6(best.lng), round6(best.lat)];
      if (e.end === 0) {
        if (coords[0][0] !== c[0] || coords[0][1] !== c[1]) {
          coords[0] = c;
          tSnaps++;
          touched.add(ref.fi);
        }
      } else {
        const last = coords.length - 1;
        if (coords[last][0] !== c[0] || coords[last][1] !== c[1]) {
          coords[last] = c;
          tSnaps++;
          touched.add(ref.fi);
        }
      }
    }
  });

  return { tSnaps, featuresTouched: touched.size };
}

function main() {
  const eps = envM("LBS_ROAD_SNAP_M", 2, 5);
  const tjoin = envM("LBS_ROAD_TJOIN_M", 8, 15);
  ensureInput();

  const gj = JSON.parse(fs.readFileSync(IN, "utf8"));
  const features = gj.features || [];

  const ep = endpointCluster(features, eps);
  const tj = tJunctionSnap(features, tjoin);

  gj.snap = {
    eps_m: eps,
    tjoin_m: tjoin,
    endpoint_merged_clusters: ep.mergedClusters,
    endpoint_tips_moved: ep.tipsMoved,
    tjunction_snaps: tj.tSnaps,
    features_touched_endpoint: ep.featuresTouched,
    features_touched_tjoin: tj.featuresTouched
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(gj));
  const log = {
    built_at: new Date().toISOString(),
    input: path.relative(root(), IN),
    output: path.relative(root(), OUT),
    eps_m: eps,
    tjoin_m: tjoin,
    tip_count: ep.tips.length,
    merged_clusters: ep.mergedClusters,
    tips_moved: ep.tipsMoved,
    tjunction_snaps: tj.tSnaps,
    features_touched: ep.featuresTouched + tj.featuresTouched
  };
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2));
  console.log(
    `snap: eps=${eps}m clusters=${ep.mergedClusters} tips_moved=${ep.tipsMoved} | tjoin=${tjoin}m snaps=${tj.tSnaps} → ${OUT}`
  );
}

main();
