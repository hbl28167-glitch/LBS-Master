/**
 * Road network connectivity QC (WS-B2).
 * Usage: node scripts/qc-roads.js [--label before|after] [--no-fail]
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");

const ROADS = root("data", "processed", "roads_gcj.geojson");
const ANCHORS = root("data", "static", "anchors_shanghai.json");
const OUT_JSON = root("data", "processed", "roads_qc.json");
const OUT_MD = root("docs", "roads-qc-report.md");
const BEFORE_JSON = root("data", "processed", "roads_qc_before.json");

const QUANT = 1e5; // ~1.1m at equator; ~1m lon at Shanghai
// Endpoint-only graphs under-count T-junctions; default uses all vertices.
// Calibrated after B2 core+tertiary rebuild (see HANDOFF-WS-B2).
const MIN_LARGEST_RATIO = Number(process.env.LBS_ROAD_QC_MIN_RATIO || 0.85);
const MAX_ANCHOR_P90_M = Number(process.env.LBS_ROAD_QC_ANCHOR_P90_M || 300);
const GRAPH_MODE = process.env.LBS_ROAD_QC_GRAPH || "vertices"; // vertices|endpoints

function args() {
  const a = process.argv.slice(2);
  return {
    label: a.includes("--label")
      ? a[a.indexOf("--label") + 1] || "after"
      : "after",
    noFail: a.includes("--no-fail")
  };
}

function qKey(lng, lat) {
  return (
    Math.round(lng * QUANT) + ":" + Math.round(lat * QUANT)
  );
}

function haversineM(lng1, lat1, lng2, lat2) {
  const R = 6371000;
  const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLng = toR(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function lineLengthKm(coords) {
  let m = 0;
  for (let i = 1; i < coords.length; i++) {
    m += haversineM(
      coords[i - 1][0],
      coords[i - 1][1],
      coords[i][0],
      coords[i][1]
    );
  }
  return m / 1000;
}

function iterLines(features) {
  const out = [];
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    const hw = (f.properties && f.properties.highway) || "unknown";
    if (g.type === "LineString") out.push({ coords: g.coordinates, hw, f });
    else if (g.type === "MultiLineString") {
      for (const c of g.coordinates) out.push({ coords: c, hw, f });
    }
  }
  return out;
}

function pointToSegDistM(px, py, ax, ay, bx, by) {
  // approx local meters
  const midLat = ((ay + by + py) / 3) * (Math.PI / 180);
  const mx = 111320 * Math.cos(midLat);
  const my = 111320;
  const Ax = ax * mx;
  const Ay = ay * my;
  const Bx = bx * mx;
  const By = by * my;
  const Px = px * mx;
  const Py = py * my;
  const dx = Bx - Ax;
  const dy = By - Ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) t = ((Px - Ax) * dx + (Py - Ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = Ax + t * dx;
  const qy = Ay + t * dy;
  return Math.hypot(Px - qx, Py - qy);
}

function nearestRoadM(lng, lat, lines, grid) {
  const cell = 0.02;
  const ci = Math.floor(lng / cell);
  const cj = Math.floor(lat / cell);
  let best = Infinity;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const bucket = grid.get(ci + di + ":" + (cj + dj));
      if (!bucket) continue;
      for (const li of bucket) {
        const coords = lines[li].coords;
        for (let i = 1; i < coords.length; i++) {
          const d = pointToSegDistM(
            lng,
            lat,
            coords[i - 1][0],
            coords[i - 1][1],
            coords[i][0],
            coords[i][1]
          );
          if (d < best) best = d;
        }
      }
    }
  }
  if (best === Infinity) {
    // fallback sample
    const step = Math.max(1, Math.floor(lines.length / 2000));
    for (let li = 0; li < lines.length; li += step) {
      const coords = lines[li].coords;
      for (let i = 1; i < coords.length; i++) {
        const d = pointToSegDistM(
          lng,
          lat,
          coords[i - 1][0],
          coords[i - 1][1],
          coords[i][0],
          coords[i][1]
        );
        if (d < best) best = d;
      }
    }
  }
  return best;
}

function buildLineGrid(lines) {
  const cell = 0.02;
  const grid = new Map();
  lines.forEach((ln, idx) => {
    const seen = new Set();
    for (const [lng, lat] of ln.coords) {
      const k = Math.floor(lng / cell) + ":" + Math.floor(lat / cell);
      if (seen.has(k)) continue;
      seen.add(k);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(idx);
    }
  });
  return grid;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}

function runQc(roadsPath) {
  const gj = JSON.parse(fs.readFileSync(roadsPath, "utf8"));
  const features = gj.features || [];
  const lines = iterLines(features);

  const byHw = {};
  let lengthKm = 0;
  const lengthByHw = {};

  // graph: quantized vertices connected along each way (and shared junctions)
  const adj = new Map();
  function addEdge(a, b) {
    if (a === b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }
  function touch(k) {
    if (!adj.has(k)) adj.set(k, new Set());
  }

  const tipKeys = new Set();
  for (const ln of lines) {
    const hw = ln.hw;
    byHw[hw] = (byHw[hw] || 0) + 1;
    const lk = lineLengthKm(ln.coords);
    lengthKm += lk;
    lengthByHw[hw] = (lengthByHw[hw] || 0) + lk;
    if (ln.coords.length < 2) continue;
    if (GRAPH_MODE === "endpoints") {
      const a = ln.coords[0];
      const b = ln.coords[ln.coords.length - 1];
      const ka = qKey(a[0], a[1]);
      const kb = qKey(b[0], b[1]);
      tipKeys.add(ka);
      tipKeys.add(kb);
      addEdge(ka, kb);
    } else {
      // chain consecutive vertices so shared mid-nodes connect T-junctions
      let prev = null;
      for (let i = 0; i < ln.coords.length; i++) {
        const c = ln.coords[i];
        const k = qKey(c[0], c[1]);
        touch(k);
        if (i === 0 || i === ln.coords.length - 1) tipKeys.add(k);
        if (prev) addEdge(prev, k);
        prev = k;
      }
    }
  }

  const nodes = [...adj.keys()];
  const endpoint_count = tipKeys.size || nodes.length;
  let dangling_tips = 0;
  for (const n of tipKeys) {
    const deg = (adj.get(n) && adj.get(n).size) || 0;
    if (deg <= 1) dangling_tips++;
  }

  // connected components on endpoints
  const seen = new Set();
  const components = [];
  for (const n of nodes) {
    if (seen.has(n)) continue;
    let size = 0;
    const stack = [n];
    seen.add(n);
    while (stack.length) {
      const u = stack.pop();
      size++;
      for (const v of adj.get(u) || []) {
        if (!seen.has(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }
    components.push(size);
  }
  components.sort((a, b) => b - a);
  const largest = components[0] || 0;
  // ratio of nodes (vertices or endpoints) in largest component
  const node_count = nodes.length;
  const largest_component_endpoint_ratio =
    node_count > 0 ? largest / node_count : 0;

  // anchors
  let anchorStats = { count: 0, p50: null, p90: null, max: null, samples: [] };
  if (fs.existsSync(ANCHORS)) {
    const anchors = JSON.parse(fs.readFileSync(ANCHORS, "utf8")).anchors || [];
    const grid = buildLineGrid(lines);
    const dists = [];
    for (const a of anchors) {
      const d = nearestRoadM(a.lng, a.lat, lines, grid);
      dists.push(d);
      anchorStats.samples.push({
        id: a.id,
        m: Math.round(d * 10) / 10
      });
    }
    dists.sort((a, b) => a - b);
    anchorStats.count = dists.length;
    anchorStats.p50 = percentile(dists, 0.5);
    anchorStats.p90 = percentile(dists, 0.9);
    anchorStats.max = dists[dists.length - 1] || null;
    if (anchorStats.p50 != null) anchorStats.p50 = Math.round(anchorStats.p50 * 10) / 10;
    if (anchorStats.p90 != null) anchorStats.p90 = Math.round(anchorStats.p90 * 10) / 10;
    if (anchorStats.max != null) anchorStats.max = Math.round(anchorStats.max * 10) / 10;
  }

  // bbox coverage crude: count features in 4 quadrants of shanghai-ish
  const quads = { nw: 0, ne: 0, sw: 0, se: 0 };
  const cx = 121.47;
  const cy = 31.2;
  for (const ln of lines) {
    const c = ln.coords[Math.floor(ln.coords.length / 2)];
    if (!c) continue;
    const e = c[0] >= cx;
    const n = c[1] >= cy;
    if (n && !e) quads.nw++;
    else if (n && e) quads.ne++;
    else if (!n && !e) quads.sw++;
    else quads.se++;
  }

  const tertiary_count =
    (byHw.tertiary || 0) + (byHw.tertiary_link || 0);

  const gates = {
    tertiary_gt_0: tertiary_count > 0,
    largest_ratio_ok: largest_component_endpoint_ratio >= MIN_LARGEST_RATIO,
    anchor_p90_ok:
      anchorStats.p90 == null || anchorStats.p90 <= MAX_ANCHOR_P90_M,
    feature_gt_1000: features.length >= 1000
  };
  const pass = Object.values(gates).every(Boolean);

  return {
    built_at: new Date().toISOString(),
    roads_path: path.relative(root(), roadsPath),
    feature_count: features.length,
    line_parts: lines.length,
    length_km: Math.round(lengthKm * 10) / 10,
    by_highway: byHw,
    length_km_by_highway: Object.fromEntries(
      Object.entries(lengthByHw).map(([k, v]) => [k, Math.round(v * 10) / 10])
    ),
    tertiary_count,
    graph_mode: GRAPH_MODE,
    node_count,
    endpoint_count,
    dangling_tips,
    components: components.length,
    largest_component_endpoints: largest,
    largest_component_endpoint_ratio:
      Math.round(largest_component_endpoint_ratio * 10000) / 10000,
    thresholds: {
      min_largest_ratio: MIN_LARGEST_RATIO,
      max_anchor_p90_m: MAX_ANCHOR_P90_M
    },
    anchor_to_road_m: anchorStats,
    bbox_quadrant_feature_parts: quads,
    gates,
    verdict: pass ? "PASS" : "FAIL"
  };
}

function writeReport(qc, label, before) {
  const md = [];
  md.push("# Roads QC report · WS-B2");
  md.push("");
  md.push(`- generated: ${qc.built_at}`);
  md.push(`- label: **${label}**`);
  md.push(`- verdict: **${qc.verdict}**`);
  md.push(`- features: ${qc.feature_count}`);
  md.push(`- length_km: ${qc.length_km}`);
  md.push(`- tertiary(+link): ${qc.tertiary_count}`);
  md.push(`- endpoints: ${qc.endpoint_count}`);
  md.push(`- dangling_tips (deg=1): ${qc.dangling_tips}`);
  md.push(`- components: ${qc.components}`);
  md.push(
    `- largest_component_endpoint_ratio: ${qc.largest_component_endpoint_ratio} (min ${qc.thresholds.min_largest_ratio})`
  );
  md.push(
    `- anchor→road m: P50=${qc.anchor_to_road_m.p50} P90=${qc.anchor_to_road_m.p90} max=${qc.anchor_to_road_m.max}`
  );
  md.push("");
  md.push("## Gates");
  md.push("");
  for (const [k, v] of Object.entries(qc.gates)) {
    md.push(`- ${v ? "OK" : "FAIL"} \`${k}\``);
  }
  md.push("");
  if (before) {
    md.push("## Before / After");
    md.push("");
    md.push("| metric | before | after |");
    md.push("|--------|-------:|------:|");
    md.push(
      `| features | ${before.feature_count} | ${qc.feature_count} |`
    );
    md.push(
      `| tertiary | ${before.tertiary_count} | ${qc.tertiary_count} |`
    );
    md.push(
      `| largest_ratio | ${before.largest_component_endpoint_ratio} | ${qc.largest_component_endpoint_ratio} |`
    );
    md.push(
      `| dangling_tips | ${before.dangling_tips} | ${qc.dangling_tips} |`
    );
    md.push(
      `| components | ${before.components} | ${qc.components} |`
    );
    md.push(
      `| anchor P90 m | ${before.anchor_to_road_m && before.anchor_to_road_m.p90} | ${qc.anchor_to_road_m.p90} |`
    );
    md.push("");
  }
  md.push("## by_highway (count)");
  md.push("");
  md.push("```json");
  md.push(JSON.stringify(qc.by_highway, null, 2));
  md.push("```");
  md.push("");
  md.push("## Notes");
  md.push("");
  md.push(
    "- Connectivity uses **endpoint graph** (way endpoints quantized); mid-vertex T-junctions without shared endpoints still look disconnected — snap helps tips only."
  );
  md.push(
    "- Anchor distance is true geometry check (not GCJ self-compare)."
  );
  md.push("- © OpenStreetMap contributors (ODbL).");
  md.push("");

  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, md.join("\n"));
  fs.writeFileSync(OUT_JSON, JSON.stringify(qc, null, 2));
}

function main() {
  const { label, noFail } = args();
  if (!fs.existsSync(ROADS)) {
    console.error("missing", ROADS);
    process.exit(1);
  }
  const qc = runQc(ROADS);
  let before = null;
  if (label === "before") {
    fs.writeFileSync(BEFORE_JSON, JSON.stringify(qc, null, 2));
  } else if (fs.existsSync(BEFORE_JSON)) {
    before = JSON.parse(fs.readFileSync(BEFORE_JSON, "utf8"));
  }
  writeReport(qc, label, before);
  console.log(
    `qc-roads [${label}]: ${qc.verdict} features=${qc.feature_count} tertiary=${qc.tertiary_count} largest_ratio=${qc.largest_component_endpoint_ratio} dangling=${qc.dangling_tips} anchorP90=${qc.anchor_to_road_m.p90}`
  );
  console.log(`→ ${OUT_MD}`);
  if (qc.verdict !== "PASS" && !noFail && label !== "before") {
    process.exit(1);
  }
}

main();
