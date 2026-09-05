"use strict";

const fs = require("fs");
const path = require("path");
const { wgs84ToGcj02 } = require("../../../scripts/lib/gcj");

const ROOT = path.resolve(__dirname, "..");
const REPO = path.resolve(ROOT, "../..");
const RAW = path.join(ROOT, "data", "raw");
const OUT = path.join(ROOT, "data", "processed");
const PREVIEW = path.join(ROOT, "preview", "data");
const BBOX_WGS = { west: 121.475, south: 31.215, east: 121.535, north: 31.26 };
const sw = wgs84ToGcj02(BBOX_WGS.west, BBOX_WGS.south);
const ne = wgs84ToGcj02(BBOX_WGS.east, BBOX_WGS.north);
const BBOX = { west: sw.lng, south: sw.lat, east: ne.lng, north: ne.lat };

const MOTOR_CLASSES = new Set([
  "motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",
  "secondary", "secondary_link", "tertiary", "tertiary_link", "unclassified",
  "residential", "living_street", "service", "road"
]);
const GRADE = {
  motorway: "R1", motorway_link: "R1", trunk: "R1", trunk_link: "R1",
  primary: "R2", primary_link: "R2", secondary: "R3", secondary_link: "R3",
  tertiary: "R4", tertiary_link: "R4", unclassified: "R4",
  residential: "R5", living_street: "R5", service: "R6", road: "R6"
};
const DEFAULT_SPEED = { R1: 78, R2: 52, R3: 42, R4: 32, R5: 22, R6: 12 };
const DEFAULT_LANES = { R1: 4, R2: 4, R3: 3, R4: 2, R5: 2, R6: 1 };
const PM_FACTOR = { R1: 0.72, R2: 0.58, R3: 0.65, R4: 0.75, R5: 0.85, R6: 0.9 };

for (const dir of [RAW, OUT, PREVIEW]) fs.mkdirSync(dir, { recursive: true });

function intersects(coords) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of coords) {
    minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]);
    maxX = Math.max(maxX, c[0]); maxY = Math.max(maxY, c[1]);
  }
  return !(maxX < BBOX.west || minX > BBOX.east || maxY < BBOX.south || minY > BBOX.north);
}

function parseNumber(value) {
  if (value == null) return null;
  const text = String(value).toLowerCase();
  const m = text.match(/\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return text.includes("mph") ? Math.round(n * 1.60934) : n;
}

function yes(value) {
  return ["yes", "true", "1"].includes(String(value || "").toLowerCase());
}

async function downloadRoads() {
  const rawPath = path.join(RAW, "osm-roads-v3-overpass.json");
  if (fs.existsSync(rawPath)) return JSON.parse(fs.readFileSync(rawPath, "utf8"));
  const midLng = (BBOX_WGS.west + BBOX_WGS.east) / 2;
  const midLat = (BBOX_WGS.south + BBOX_WGS.north) / 2;
  const tiles = [
    [BBOX_WGS.south, BBOX_WGS.west, midLat, midLng],
    [BBOX_WGS.south, midLng, midLat, BBOX_WGS.east],
    [midLat, BBOX_WGS.west, BBOX_WGS.north, midLng],
    [midLat, midLng, BBOX_WGS.north, BBOX_WGS.east]
  ];
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];
  const merged = new Map();
  for (let i = 0; i < tiles.length; i++) {
    const [s, w, n, e] = tiles[i];
    const query = `[out:json][timeout:120];way["highway"](${s},${w},${n},${e});out geom;`;
    let data = null, lastError = null;
    for (const endpoint of endpoints) {
      try {
        console.log(`download roads tile ${i + 1}/4: ${endpoint}`);
        const response = await fetch(endpoint + "?data=" + encodeURIComponent(query), {
          headers: { "user-agent": "LBS-Master-road-v3-pilot/1.0", accept: "application/json" }
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        data = JSON.parse(await response.text());
        break;
      } catch (error) {
        lastError = error;
        console.warn("  failed:", error.message);
      }
    }
    if (!data) throw lastError || new Error("road tile download failed");
    for (const element of data.elements || []) merged.set(element.type + ":" + element.id, element);
  }
  const raw = { version: 0.6, generator: "LBS-Master tiled Overpass", elements: [...merged.values()] };
  fs.writeFileSync(rawPath, JSON.stringify(raw));
  return raw;
}

function enrich(element) {
  const tags = element.tags || {};
  if (!MOTOR_CLASSES.has(tags.highway) || !element.geometry || element.geometry.length < 2) return null;
  const grade = GRADE[tags.highway] || "R6";
  const observedSpeed = parseNumber(tags.maxspeed);
  const baseSpeed = Math.max(8, Math.min(100, observedSpeed || DEFAULT_SPEED[grade]));
  const observedLanes = parseNumber(tags.lanes);
  let oneWay = yes(tags.oneway), oneWaySource = tags.oneway != null ? "OSM" : "default";
  let reverse = String(tags.oneway || "") === "-1";
  if (tags.oneway == null && ["motorway", "motorway_link"].includes(tags.highway)) {
    oneWay = true; oneWaySource = "inferred_by_class";
  }
  let layer = Number.parseInt(tags.layer, 10);
  let layerSource = "OSM";
  if (!Number.isFinite(layer)) {
    layer = yes(tags.bridge) ? 1 : yes(tags.tunnel) ? -1 : 0;
    layerSource = yes(tags.bridge) || yes(tags.tunnel) ? "inferred_by_structure" : "default_ground";
  }
  let coords = element.geometry.map(p => {
    const gcj = wgs84ToGcj02(p.lon, p.lat);
    return [gcj.lng, gcj.lat];
  });
  if (reverse) coords = coords.reverse();
  const speedPm = Math.max(8, Math.round(baseSpeed * PM_FACTOR[grade]));
  const speedRain = Math.max(8, Math.round(speedPm * 0.88));
  return {
    type: "Feature",
    properties: {
      osm_id: element.id,
      name: tags.name || tags["name:zh"] || "",
      ref: tags.ref || "",
      highway: tags.highway,
      road_grade: grade,
      maxspeed_raw: tags.maxspeed || null,
      speed_base_kmh: baseSpeed,
      speed_pm_kmh: speedPm,
      speed_pm_rain_kmh: speedRain,
      speed_source: observedSpeed ? "OSM" : "Synthetic_by_grade",
      lanes: observedLanes || DEFAULT_LANES[grade],
      lanes_source: observedLanes ? "OSM" : "Synthetic_by_grade",
      oneway: oneWay,
      oneway_source: oneWaySource,
      bridge: yes(tags.bridge),
      tunnel: yes(tags.tunnel),
      layer,
      layer_source: layerSource,
      access: tags.access || "",
      surface: tags.surface || "",
      service: tags.service || "",
      topology_source: "OpenStreetMap",
      impedance_synthetic: !observedSpeed
    },
    geometry: { type: "LineString", coordinates: coords }
  };
}

function graphSummary(features) {
  const adjacency = new Map();
  let directedEdges = 0;
  // OSM grade-separated crossings do not share a node. Coordinate identity is
  // therefore enough, while keeping layer in the key would also sever real
  // bridge/ramp transition nodes at a way boundary.
  const key = c => `${c[0].toFixed(6)},${c[1].toFixed(6)}`;
  const link = (a, b) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a).add(b); adjacency.get(b).add(a);
  };
  for (const f of features) {
    const cs = f.geometry.coordinates;
    for (let i = 0; i < cs.length - 1; i++) {
      const a = key(cs[i]), b = key(cs[i + 1]);
      link(a, b);
      directedEdges += f.properties.oneway ? 1 : 2;
    }
  }
  let largest = 0, components = 0;
  const seen = new Set();
  for (const start of adjacency.keys()) {
    if (seen.has(start)) continue;
    components++;
    let count = 0;
    const stack = [start]; seen.add(start);
    while (stack.length) {
      const n = stack.pop(); count++;
      for (const next of adjacency.get(n) || []) if (!seen.has(next)) { seen.add(next); stack.push(next); }
    }
    largest = Math.max(largest, count);
  }
  return {
    nodes: adjacency.size,
    directed_edges: directedEdges,
    weak_components: components,
    giant_component_rate: adjacency.size ? +(largest / adjacency.size).toFixed(3) : 0
  };
}

async function main() {
  const raw = await downloadRoads();
  const v3 = raw.elements.map(enrich).filter(Boolean);
  const current = JSON.parse(fs.readFileSync(path.join(REPO, "data", "processed", "roads_gcj.geojson"), "utf8"));
  const v2 = current.features.filter(f => f.geometry?.type === "LineString" && intersects(f.geometry.coordinates));
  const graph = graphSummary(v3);
  const byGrade = {};
  for (const f of v3) byGrade[f.properties.road_grade] = (byGrade[f.properties.road_grade] || 0) + 1;
  const summary = {
    bbox_wgs: BBOX_WGS,
    v2: { roads: v2.length, classes: [...new Set(v2.map(f => f.properties.highway))].sort() },
    v3: {
      roads: v3.length,
      by_grade: byGrade,
      local_roads: v3.filter(f => ["R5", "R6"].includes(f.properties.road_grade)).length,
      oneway_roads: v3.filter(f => f.properties.oneway).length,
      bridges: v3.filter(f => f.properties.bridge).length,
      tunnels: v3.filter(f => f.properties.tunnel).length,
      observed_speed_roads: v3.filter(f => f.properties.speed_source === "OSM").length,
      synthetic_speed_roads: v3.filter(f => f.properties.speed_source !== "OSM").length,
      ...graph
    },
    note: "Topology is OSM-derived. Missing speed and lane impedance is Synthetic by road grade."
  };
  const files = {
    "roads-v2.geojson": { type: "FeatureCollection", features: v2 },
    "roads-v3.geojson": { type: "FeatureCollection", features: v3 },
    "road-v3-summary.json": summary
  };
  for (const [name, value] of Object.entries(files)) {
    fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, name.endsWith(".json") ? 2 : 0));
    fs.writeFileSync(path.join(PREVIEW, name), JSON.stringify(value, null, name.endsWith(".json") ? 2 : 0));
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
