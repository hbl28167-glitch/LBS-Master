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
const ROAD_CLASSES = new Set([
  "motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",
  "secondary", "secondary_link", "tertiary", "tertiary_link", "unclassified", "residential"
]);

for (const d of [RAW, OUT, PREVIEW]) fs.mkdirSync(d, { recursive: true });

function withinBboxPoint(c, pad = 0) {
  return c[0] >= BBOX.west - pad && c[0] <= BBOX.east + pad && c[1] >= BBOX.south - pad && c[1] <= BBOX.north + pad;
}

function bboxIntersects(coords) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of coords) {
    minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]);
    maxX = Math.max(maxX, c[0]); maxY = Math.max(maxY, c[1]);
  }
  return !(maxX < BBOX.west || minX > BBOX.east || maxY < BBOX.south || minY > BBOX.north);
}

function ringBboxIntersects(ring) {
  return bboxIntersects(ring);
}

function coordKey(c) {
  return c[0].toFixed(5) + "," + c[1].toFixed(5);
}

function planar(c) {
  const lat0 = ((BBOX.south + BBOX.north) / 2) * Math.PI / 180;
  return [c[0] * 111320 * Math.cos(lat0), c[1] * 110540];
}

function areaM2(ring) {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = planar(ring[i]), b = planar(ring[i + 1]);
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function simplifyRing(ring, toleranceM = 2) {
  if (ring.length <= 5) return ring;
  const out = [ring[0]];
  for (let i = 1; i < ring.length - 1; i++) {
    const a = planar(out[out.length - 1]);
    const b = planar(ring[i]);
    const dx = a[0] - b[0], dy = a[1] - b[1];
    if (Math.hypot(dx, dy) >= toleranceM) out.push(ring[i]);
  }
  out.push(out[0]);
  return out;
}

function polygonizeRoads(roads) {
  const coords = new Map();
  const edges = new Map();
  const addEdge = (a, b) => {
    const ka = coordKey(a), kb = coordKey(b);
    if (ka === kb) return;
    coords.set(ka, a); coords.set(kb, b);
    const id = ka < kb ? ka + "|" + kb : kb + "|" + ka;
    edges.set(id, [ka, kb]);
  };

  for (const f of roads) {
    const line = f.geometry.coordinates;
    for (let i = 0; i < line.length - 1; i++) {
      if (withinBboxPoint(line[i], 0.002) || withinBboxPoint(line[i + 1], 0.002)) addEdge(line[i], line[i + 1]);
    }
  }

  const adj = new Map();
  const link = (a, b) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a).add(b);
  };
  for (const [a, b] of edges.values()) { link(a, b); link(b, a); }

  const queue = [];
  for (const [k, ns] of adj) if (ns.size < 2) queue.push(k);
  while (queue.length) {
    const k = queue.pop();
    const ns = adj.get(k);
    if (!ns || ns.size >= 2) continue;
    for (const n of [...ns]) {
      adj.get(n)?.delete(k);
      if (adj.get(n)?.size === 1) queue.push(n);
    }
    adj.delete(k);
  }

  const ordered = new Map();
  for (const [k, ns] of adj) {
    const c = coords.get(k);
    ordered.set(k, [...ns].filter(n => adj.has(n)).sort((a, b) => {
      const ca = coords.get(a), cb = coords.get(b);
      return Math.atan2(ca[1] - c[1], ca[0] - c[0]) - Math.atan2(cb[1] - c[1], cb[0] - c[0]);
    }));
  }

  const seen = new Set();
  const faces = [];
  for (const [u, ns] of ordered) {
    for (const v of ns) {
      const start = u + ">" + v;
      if (seen.has(start)) continue;
      let a = u, b = v;
      const ringKeys = [a];
      let ok = false;
      for (let guard = 0; guard < 20000; guard++) {
        const directed = a + ">" + b;
        if (seen.has(directed) && directed !== start) break;
        seen.add(directed);
        ringKeys.push(b);
        const nexts = ordered.get(b);
        if (!nexts || !nexts.length) break;
        const reverseIndex = nexts.indexOf(a);
        if (reverseIndex < 0) break;
        const c = nexts[(reverseIndex - 1 + nexts.length) % nexts.length];
        a = b; b = c;
        if (a + ">" + b === start) { ok = true; break; }
      }
      if (!ok || ringKeys.length < 4) continue;
      let ring = ringKeys.map(k => coords.get(k));
      if (coordKey(ring[0]) !== coordKey(ring[ring.length - 1])) ring.push(ring[0]);
      const area = areaM2(ring);
      if (area < 1000 || area > 2000000) continue;
      const centroid = ring.slice(0, -1).reduce((s, c) => [s[0] + c[0], s[1] + c[1]], [0, 0]).map(vv => vv / (ring.length - 1));
      if (!withinBboxPoint(centroid)) continue;
      ring = simplifyRing(ring);
      faces.push({ ring, area });
    }
  }
  faces.sort((a, b) => b.area - a.area);
  return faces;
}

function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const hit = ((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / ((yj - yi) || 1e-12) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

async function fetchBuildings() {
  const rawPath = path.join(RAW, "osm-buildings-overpass.json");
  if (!fs.existsSync(rawPath)) {
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
    for (let ti = 0; ti < tiles.length; ti++) {
      const [s, w, n, e] = tiles[ti];
      const q = `[out:json][timeout:120];way["building"](${s},${w},${n},${e});out geom;`;
      let tileData = null;
      let lastError;
      for (const endpoint of endpoints) {
        try {
          console.log(`download buildings tile ${ti + 1}/4:`, endpoint);
          const url = endpoint + "?data=" + encodeURIComponent(q);
          const res = await fetch(url, { headers: { "user-agent": "LBS-Master-zone-v3-pilot/1.0", accept: "application/json" } });
          if (!res.ok) throw new Error("HTTP " + res.status);
          tileData = JSON.parse(await res.text());
          break;
        } catch (e) { lastError = e; console.warn("  failed:", e.message); }
      }
      if (!tileData) throw lastError || new Error("building tile download failed");
      for (const element of tileData.elements || []) merged.set(element.type + ":" + element.id, element);
    }
    fs.writeFileSync(rawPath, JSON.stringify({ version: 0.6, generator: "LBS-Master tiled Overpass", elements: [...merged.values()] }));
  }
  const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  const features = [];
  for (const e of raw.elements || []) {
    if (!e.geometry || e.geometry.length < 4) continue;
    const ring = e.geometry.map(p => {
      const g = wgs84ToGcj02(p.lon, p.lat);
      return [g.lng, g.lat];
    });
    if (coordKey(ring[0]) !== coordKey(ring[ring.length - 1])) ring.push(ring[0]);
    features.push({ type: "Feature", properties: { osm_id: e.id, building: e.tags?.building || "yes", source: "OpenStreetMap" }, geometry: { type: "Polygon", coordinates: [ring] } });
  }
  return features;
}

async function main() {
  const roadsFc = JSON.parse(fs.readFileSync(path.join(REPO, "data", "processed", "roads_gcj.geojson"), "utf8"));
  const roads = roadsFc.features.filter(f => ROAD_CLASSES.has(f.properties?.highway) && f.geometry?.type === "LineString" && bboxIntersects(f.geometry.coordinates));
  console.log("pilot roads:", roads.length);
  const faces = polygonizeRoads(roads);
  console.log("road blocks:", faces.length);
  const buildings = await fetchBuildings();
  console.log("buildings:", buildings.length);

  const blocks = faces.map((f, i) => {
    let count = 0, footprint = 0;
    for (const b of buildings) {
      const ring = b.geometry.coordinates[0];
      const center = ring.slice(0, -1).reduce((s, c) => [s[0] + c[0], s[1] + c[1]], [0, 0]).map(v => v / (ring.length - 1));
      if (pointInRing(center, f.ring)) { count++; footprint += Math.abs(areaM2(ring)); }
    }
    return { type: "Feature", properties: { block_id: "lz:block:" + String(i + 1).padStart(4, "0"), geometry_method: "road_polygonized_v3_pilot", block_area_m2: Math.round(f.area), building_count: count, building_footprint_m2: Math.round(footprint), building_coverage_ratio: +(footprint / f.area).toFixed(3), classification_status: "not_started", synthetic: false }, geometry: { type: "Polygon", coordinates: [f.ring] } };
  });

  const zonesFc = JSON.parse(fs.readFileSync(path.join(REPO, "data", "processed", "zones_shanghai.geojson"), "utf8"));
  const oldZones = zonesFc.features.filter(f => {
    const rings = f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat();
    return rings.some(ringBboxIntersects);
  });
  const blockFc = { type: "FeatureCollection", meta: { bbox_wgs: BBOX_WGS, bbox_gcj: BBOX, source: "OSM roads + OSM buildings", experimental: true }, features: blocks };
  const buildingFc = { type: "FeatureCollection", meta: { source: "OpenStreetMap via Overpass", license: "ODbL", experimental: true }, features: buildings };
  const pilotRoads = { type: "FeatureCollection", features: roads };
  const oldFc = { type: "FeatureCollection", features: oldZones };

  for (const [name, value] of [["blocks-v3.geojson", blockFc], ["buildings.geojson", buildingFc], ["roads.geojson", pilotRoads], ["zones-v2.geojson", oldFc]]) {
    fs.writeFileSync(path.join(OUT, name), JSON.stringify(value));
    fs.writeFileSync(path.join(PREVIEW, name), JSON.stringify(value));
  }
  const assigned = blocks.reduce((s, b) => s + b.properties.building_count, 0);
  const summary = { roads: roads.length, blocks: blocks.length, buildings: buildings.length, assigned_buildings: assigned, assignment_rate: buildings.length ? +(assigned / buildings.length).toFixed(3) : 0, old_zones: oldZones.length, bbox_wgs: BBOX_WGS };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(PREVIEW, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(summary);
}

main().catch(e => { console.error(e); process.exitCode = 1; });
