/**
 * OSM highways (WGS84) → GCJ-02 GeoJSON (pre-snap).
 * Prefer local full extract (GeoJSON/OSM JSON); Overpass only fallback.
 * WS-B2 DEFAULT_LEVELS includes tertiary+links.
 * Formal product file is roads_gcj.geojson after repair-roads-snap.js.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { root } = require("./lib/paths");
const { wgs84ToGcj02 } = require("./lib/gcj");
const { SHANGHAI_BBOX_WGS84 } = require("./lib/bbox");

const RAW_DIR = root("data", "raw", "osm");
const OUT_PRE = root("data", "processed", "roads_gcj.pre.geojson");
const OUT = root("data", "processed", "roads_gcj.geojson");
const RAW_CACHE = path.join(RAW_DIR, "shanghai_highways_overpass.json");

/** Frozen B2 levels (motorway..tertiary + links). Override: LBS_ROAD_LEVELS */
const DEFAULT_LEVELS = [
  "motorway",
  "motorway_link",
  "trunk",
  "trunk_link",
  "primary",
  "primary_link",
  "secondary",
  "secondary_link",
  "tertiary",
  "tertiary_link"
];

function levels() {
  if (process.env.LBS_ROAD_LEVELS) {
    return process.env.LBS_ROAD_LEVELS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_LEVELS;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function convertCoord(lng, lat) {
  const g = wgs84ToGcj02(lng, lat);
  return [round6(g.lng), round6(g.lat)];
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function highwayOk(h, allow) {
  return h && allow.has(h);
}

/** Overpass elements → GeoJSON features (GCJ) */
function fromOverpass(json, allow) {
  const features = [];
  for (const el of json.elements || []) {
    if (el.type !== "way" || !el.geometry) continue;
    const hw = el.tags && el.tags.highway;
    if (!highwayOk(hw, allow)) continue;
    const coords = el.geometry.map((p) => convertCoord(p.lon, p.lat));
    if (coords.length < 2) continue;
    features.push({
      type: "Feature",
      properties: {
        osm_id: el.id,
        highway: hw,
        name: (el.tags && (el.tags.name || el.tags["name:zh"])) || null,
        ref: (el.tags && el.tags.ref) || null
      },
      geometry: {
        type: "LineString",
        coordinates: coords
      }
    });
  }
  return features;
}

/** GeoJSON (WGS) → GCJ features */
function fromGeoJSON(gj, allow) {
  const features = [];
  const list = gj.type === "FeatureCollection" ? gj.features : [gj];
  for (const f of list) {
    if (!f || !f.geometry) continue;
    const hw =
      (f.properties && (f.properties.highway || f.properties.Highway)) || null;
    if (allow.size && hw && !highwayOk(hw, allow)) continue;
    const g = convertGeometry(f.geometry);
    if (!g) continue;
    features.push({
      type: "Feature",
      properties: {
        osm_id: f.properties && (f.properties["@id"] || f.properties.osm_id),
        highway: hw,
        name: f.properties && (f.properties.name || f.properties["name:zh"]),
        ref: f.properties && f.properties.ref
      },
      geometry: g
    });
  }
  return features;
}

function convertGeometry(geom) {
  if (!geom) return null;
  if (geom.type === "LineString") {
    const coords = geom.coordinates.map(([lng, lat]) => convertCoord(lng, lat));
    if (coords.length < 2) return null;
    return { type: "LineString", coordinates: coords };
  }
  if (geom.type === "MultiLineString") {
    const lines = geom.coordinates
      .map((line) => line.map(([lng, lat]) => convertCoord(lng, lat)))
      .filter((line) => line.length >= 2);
    if (!lines.length) return null;
    return { type: "MultiLineString", coordinates: lines };
  }
  return null;
}

function findLocalRaw() {
  if (!fs.existsSync(RAW_DIR)) return null;
  const names = fs.readdirSync(RAW_DIR).filter((n) => !n.startsWith("."));
  const prefer = [
    "shanghai_roads.geojson",
    "shanghai.geojson",
    "shanghai_extract.geojson",
    "shanghai_highways_overpass.json",
    "shanghai.osm.json"
  ];
  for (const p of prefer) {
    if (names.includes(p)) return path.join(RAW_DIR, p);
  }
  // Prefer largest non-progress json/geojson
  const cands = names.filter(
    (n) =>
      (n.endsWith(".geojson") || n.endsWith(".json")) &&
      !n.startsWith("_") &&
      n !== "probe.json"
  );
  cands.sort(
    (a, b) =>
      fs.statSync(path.join(RAW_DIR, b)).size -
      fs.statSync(path.join(RAW_DIR, a)).size
  );
  return cands.length ? path.join(RAW_DIR, cands[0]) : null;
}

function httpGet(url, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    // Some corporate/dev machines lack CA bundle for Node; optional insecure.
    const insecure =
      process.env.LBS_TLS_INSECURE === "1" ||
      process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
    const req = lib.get(
      url,
      {
        headers: {
          "User-Agent": "lbs-master-ws-b/0.1 (portfolio sandbox; ODbL compliant)"
        },
        timeout: timeoutMs,
        rejectUnauthorized: !insecure
      },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          httpGet(res.headers.location, timeoutMs).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve(Buffer.concat(chunks).toString("utf8"))
        );
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function buildOverpassQuery(allowList) {
  const b = SHANGHAI_BBOX_WGS84;
  // Overpass bbox: south,west,north,east
  const bb = `${b.minLat},${b.minLng},${b.maxLat},${b.maxLng}`;
  const regs = allowList.map((h) => `way["highway"="${h}"](${bb});`).join("\n");
  return `
[out:json][timeout:180];
(
${regs}
);
out geom;
`.trim();
}

async function fetchOverpass(allowList) {
  const q = buildOverpassQuery(allowList);
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  let lastErr;
  for (const base of endpoints) {
    try {
      const url = `${base}?data=${encodeURIComponent(q)}`;
      console.log(`fetch Overpass: ${base}`);
      const body = await httpGet(url, 180000);
      const json = JSON.parse(body);
      if (!json.elements || !json.elements.length) {
        throw new Error("empty overpass result");
      }
      return json;
    } catch (e) {
      lastErr = e;
      console.warn(`Overpass failed (${base}): ${e.message}`);
    }
  }
  throw lastErr || new Error("Overpass unavailable");
}

function writeOut(features) {
  ensureDir(path.dirname(OUT_PRE));
  const fc = {
    type: "FeatureCollection",
    crs_note: "GCJ-02 (converted from OSM WGS84); pre-snap",
    attribution: "© OpenStreetMap contributors",
    filter: levels(),
    features
  };
  fs.writeFileSync(OUT_PRE, JSON.stringify(fc));
  // Also write OUT so lone convert still usable; pipeline overwrites after snap
  fs.writeFileSync(OUT, JSON.stringify(fc));
  const bytes = fs.statSync(OUT_PRE).size;
  console.log(
    `roads_gcj.pre: ${features.length} features → ${OUT_PRE} (${(bytes / 1e6).toFixed(2)} MB)`
  );
}

function printManualBlock() {
  console.error(`
BLOCKED: no local OSM raw and Overpass fetch failed.
Manual steps:
  1. Read docs/osm-download.md
  2. Place GeoJSON/Overpass JSON under data/raw/osm/
  3. Re-run: npm run build:roads
Scripts are still committed; processed roads optional until raw available.
`);
}

/** Minimal fallback corridor skeleton (GCJ) if no OSM — demo-only, flagged. */
function syntheticSkeleton() {
  // Major corridors approximate GCJ so UI never empty; verify-alignment marks residual.
  const segs = [
    {
      name: "Yan'an elevated approx",
      highway: "trunk",
      coords: [
        [121.32, 31.2],
        [121.4, 31.22],
        [121.47, 31.23],
        [121.52, 31.235]
      ]
    },
    {
      name: "Inner ring east approx",
      highway: "primary",
      coords: [
        [121.48, 31.18],
        [121.5, 31.22],
        [121.52, 31.26],
        [121.5, 31.3]
      ]
    },
    {
      name: "Pudong south to Lingang approx",
      highway: "trunk",
      coords: [
        [121.55, 31.22],
        [121.65, 31.1],
        [121.8, 30.98],
        [121.92, 30.9]
      ]
    },
    {
      name: "Middle ring west approx",
      highway: "primary",
      coords: [
        [121.35, 31.15],
        [121.35, 31.22],
        [121.38, 31.28],
        [121.45, 31.32]
      ]
    }
  ];
  return segs.map((s, i) => ({
    type: "Feature",
    properties: {
      osm_id: null,
      highway: s.highway,
      name: s.name,
      ref: null,
      synthetic_fallback: true
    },
    geometry: { type: "LineString", coordinates: s.coords }
  }));
}

async function main() {
  ensureDir(RAW_DIR);
  const allow = new Set(levels());
  let features = [];
  let source = "none";

  // Merge all usable local raw JSON/GeoJSON under raw/osm
  const locals = [];
  if (fs.existsSync(RAW_DIR)) {
    for (const n of fs.readdirSync(RAW_DIR)) {
      if (n.startsWith("_") || n === ".gitkeep") continue;
      if (!/\.(json|geojson)$/i.test(n)) continue;
      if (n.includes("probe")) continue;
      locals.push(path.join(RAW_DIR, n));
    }
    locals.sort(
      (a, b) => fs.statSync(b).size - fs.statSync(a).size
    );
  }
  const byOsm = new Map();
  if (locals.length) {
    for (const local of locals) {
      console.log(`using local raw: ${path.relative(root(), local)}`);
      let json;
      try {
        json = JSON.parse(fs.readFileSync(local, "utf8"));
      } catch (e) {
        console.warn("skip unreadable", local, e.message);
        continue;
      }
      let part = [];
      if (json.elements) {
        part = fromOverpass(json, allow);
        source = source === "none" ? "local_overpass_json" : source + "+overpass";
      } else if (json.type === "FeatureCollection" || json.features) {
        part = fromGeoJSON(json, allow);
        source = source === "none" ? "local_geojson" : source + "+geojson";
      }
      for (const f of part) {
        const id = f.properties && f.properties.osm_id;
        if (id != null) byOsm.set(String(id), f);
        else features.push(f);
      }
    }
    features = features.concat([...byOsm.values()]);
  }
  if (!features.length) {
    try {
      const json = await fetchOverpass([...allow]);
      fs.writeFileSync(RAW_CACHE, JSON.stringify(json));
      console.log(`cached raw → ${path.relative(root(), RAW_CACHE)}`);
      features = fromOverpass(json, allow);
      source = "overpass";
    } catch (e) {
      console.warn(e.message);
      printManualBlock();
      features = syntheticSkeleton();
      source = "synthetic_fallback";
    }
  }

  if (!features.length) {
    features = syntheticSkeleton();
    source = "synthetic_fallback";
  }

  writeOut(features);
  const metaPath = root("data", "processed", "roads_meta.json");
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        source,
        filter: levels(),
        feature_count: features.length,
        built_at: new Date().toISOString()
      },
      null,
      2
    )
  );
  if (source === "synthetic_fallback") {
    process.exitCode = 0; // allow build chain; HANDOFF notes residual
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
