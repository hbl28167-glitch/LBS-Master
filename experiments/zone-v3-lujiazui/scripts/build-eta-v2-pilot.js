"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "processed");
const PREVIEW = path.join(ROOT, "preview", "data");
const ROADS_PATH = path.join(OUT, "roads-v3.geojson");
const BLOCKS_PATH = path.join(OUT, "blocks-v3.geojson");

const STATION = {
  id: "lz:energy:pilot-01",
  name: "陆家嘴能源示范站",
  lng: 121.5222,
  lat: 31.2352,
  stalls: 18,
  power_kw: 250,
  synthetic: true
};
const SCENES = {
  base: { label: "平峰", speed_field: "speed_base_kmh", circle_speed: 22 },
  pm: { label: "晚高峰", speed_field: "speed_pm_kmh", circle_speed: 17 },
  rain: { label: "晚高峰雨天", speed_field: "speed_pm_rain_kmh", circle_speed: 14 }
};
const TARGETS = [
  { id: "finance", name: "小陆家嘴商圈", lng: 121.5070, lat: 31.2390 },
  { id: "bund", name: "外滩滨江需求区", lng: 121.4945, lat: 31.2380 },
  { id: "century", name: "世纪大道办公带", lng: 121.5313, lat: 31.2279 }
];

function haversine(a, b) {
  const r = 6371000, d = Math.PI / 180;
  const dLat = (b[1] - a[1]) * d, dLng = (b[0] - a[0]) * d;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * d) * Math.cos(b[1] * d) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(x)));
}

function coordKey(c) { return `${c[0].toFixed(6)},${c[1].toFixed(6)}`; }

function buildGraph(roads, speedField, reverse) {
  const nodes = new Map(), edges = new Map();
  const ensure = c => {
    const id = coordKey(c);
    if (!nodes.has(id)) nodes.set(id, { id, lng: c[0], lat: c[1] });
    if (!edges.has(id)) edges.set(id, []);
    return id;
  };
  const add = (a, b, road, meters) => {
    const kmh = Math.max(8, Number(road.properties[speedField]) || 20);
    edges.get(a).push({ to: b, sec: meters / (kmh * 1000 / 3600), meters, road });
  };
  for (const road of roads) {
    const cs = road.geometry.coordinates;
    for (let i = 0; i < cs.length - 1; i++) {
      const a = ensure(cs[i]), b = ensure(cs[i + 1]), meters = haversine(cs[i], cs[i + 1]);
      if (meters < 0.5 || meters > 5000) continue;
      if (reverse) add(b, a, road, meters);
      else add(a, b, road, meters);
      if (!road.properties.oneway) {
        if (reverse) add(a, b, road, meters);
        else add(b, a, road, meters);
      }
    }
  }
  return { nodes, edges };
}

function nearest(graph, lng, lat, maxM = 1200) {
  let best = null, bestM = maxM;
  for (const node of graph.nodes.values()) {
    const m = haversine([lng, lat], [node.lng, node.lat]);
    if (m < bestM) { best = node; bestM = m; }
  }
  return best ? { node: best, meters: bestM } : null;
}

function dijkstra(graph, source, maxSec = 1800) {
  const dist = new Map([[source, 0]]), prev = new Map(), heap = [{ id: source, sec: 0 }];
  const push = item => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].sec <= heap[i].sec) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
    }
  };
  const pop = () => {
    const first = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      while (true) {
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < heap.length && heap[l].sec < heap[s].sec) s = l;
        if (r < heap.length && heap[r].sec < heap[s].sec) s = r;
        if (s === i) break;
        [heap[s], heap[i]] = [heap[i], heap[s]]; i = s;
      }
    }
    return first;
  };
  while (heap.length) {
    const cur = pop();
    if (cur.sec !== dist.get(cur.id) || cur.sec > maxSec) continue;
    for (const edge of graph.edges.get(cur.id) || []) {
      const next = cur.sec + edge.sec;
      if (next <= maxSec && (!dist.has(edge.to) || next < dist.get(edge.to))) {
        dist.set(edge.to, next); prev.set(edge.to, { from: cur.id, edge }); push({ id: edge.to, sec: next });
      }
    }
  }
  return { dist, prev };
}

function routeFeature(graph, result, targetSnap, target, inbound) {
  if (!targetSnap || !result.dist.has(targetSnap.node.id)) return null;
  const coords = [[targetSnap.node.lng, targetSnap.node.lat]];
  let at = targetSnap.node.id, meters = targetSnap.meters;
  while (result.prev.has(at)) {
    const step = result.prev.get(at);
    meters += step.edge.meters;
    const n = graph.nodes.get(step.from); coords.push([n.lng, n.lat]); at = step.from;
  }
  if (!inbound) coords.reverse();
  const roadSec = result.dist.get(targetSnap.node.id), accessSec = targetSnap.meters / (12 * 1000 / 3600);
  return {
    type: "Feature",
    properties: { target_id: target.id, target_name: target.name, eta_min: +((roadSec + accessSec) / 60).toFixed(1), distance_km: +(meters / 1000).toFixed(2) },
    geometry: { type: "LineString", coordinates: coords }
  };
}

function centroid(ring) {
  const pts = ring.slice(0, -1);
  const sum = pts.reduce((a, c) => [a[0] + c[0], a[1] + c[1]], [0, 0]);
  return [sum[0] / pts.length, sum[1] / pts.length];
}

function reachableSegments(roads, result) {
  const features = [];
  for (const road of roads) {
    const cs = road.geometry.coordinates;
    for (let i = 0; i < cs.length - 1; i++) {
      const a = result.dist.get(coordKey(cs[i])), b = result.dist.get(coordKey(cs[i + 1]));
      const sec = Math.min(a == null ? Infinity : a, b == null ? Infinity : b);
      if (!Number.isFinite(sec) || sec > 900) continue;
      features.push({
        type: "Feature",
        properties: { band_min: sec <= 300 ? 5 : sec <= 600 ? 10 : 15, road_grade: road.properties.road_grade },
        geometry: { type: "LineString", coordinates: [cs[i], cs[i + 1]] }
      });
    }
  }
  return features;
}

function main() {
  const roadsFc = JSON.parse(fs.readFileSync(ROADS_PATH, "utf8"));
  const blocksFc = JSON.parse(fs.readFileSync(BLOCKS_PATH, "utf8"));
  const outputs = {};
  for (const [sceneId, scene] of Object.entries(SCENES)) {
    // Charging coverage is inbound: users drive from demand blocks to the
    // station. Dijkstra on the reversed directed graph gives node→station ETA.
    const graph = buildGraph(roadsFc.features, scene.speed_field, true);
    const sourceSnap = nearest(graph, STATION.lng, STATION.lat);
    if (!sourceSnap) throw new Error("station cannot snap to graph");
    const result = dijkstra(graph, sourceSnap.node.id, 20 * 60);
    const routes = TARGETS.map(t => routeFeature(graph, result, nearest(graph, t.lng, t.lat), t, true)).filter(Boolean);
    const blocks = [];
    for (const block of blocksFc.features) {
      const c = centroid(block.geometry.coordinates[0]);
      const snap = nearest(graph, c[0], c[1], 500);
      if (!snap || !result.dist.has(snap.node.id)) continue;
      const eta = (result.dist.get(snap.node.id) + snap.meters / (12 * 1000 / 3600)) / 60;
      if (eta > 15) continue;
      const buildingCount = Number(block.properties.building_count) || 0;
      const coverage = Number(block.properties.building_coverage_ratio) || 0;
      const demand = Math.max(8, Math.round(10 + buildingCount * 1.8 + coverage * 55));
      blocks.push({ block_id: block.properties.block_id, lng: c[0], lat: c[1], eta_min: +eta.toFixed(1), demand_index: demand, band_min: eta <= 5 ? 5 : eta <= 10 ? 10 : 15 });
    }
    const within10 = blocks.filter(b => b.eta_min <= 10);
    const demand10 = within10.reduce((s, b) => s + b.demand_index, 0);
    // Synthetic business estimate: demand conversion is constrained by the
    // station's physical daily service capacity, not allowed to grow forever.
    const serviceCapacity = STATION.stalls * 14;
    const orders = Math.min(serviceCapacity, Math.round(demand10 * 0.018));
    outputs[sceneId] = {
      scene_id: sceneId,
      scene_label: scene.label,
      circle_speed_kmh: scene.circle_speed,
      station_snap: { lng: sourceSnap.node.lng, lat: sourceSnap.node.lat, distance_m: Math.round(sourceSnap.meters) },
      reachable: { type: "FeatureCollection", features: reachableSegments(roadsFc.features, result) },
      routes: { type: "FeatureCollection", features: routes },
      targets: TARGETS.map(t => {
        const route = routes.find(r => r.properties.target_id === t.id);
        return { ...t, eta_min: route ? route.properties.eta_min : null, distance_km: route ? route.properties.distance_km : null };
      }),
      blocks,
      metrics: {
        road_nodes_reached_15min: [...result.dist.values()].filter(sec => sec <= 900).length,
        blocks_5min: blocks.filter(b => b.eta_min <= 5).length,
        blocks_10min: within10.length,
        blocks_15min: blocks.length,
        demand_index_10min: demand10,
        estimated_orders_day: orders,
        estimated_service_revenue_day_rmb: orders * 38,
        service_capacity_orders_day: serviceCapacity
      }
    };
  }
  const payload = {
    meta: { method: "inbound_directed_dijkstra_road_v3", topology_source: "OpenStreetMap", impedance: "Synthetic where OSM speed is missing", bands_min: [5, 10, 15] },
    station: STATION,
    scenes: outputs
  };
  for (const dir of [OUT, PREVIEW]) fs.writeFileSync(path.join(dir, "eta-v2-pilot.json"), JSON.stringify(payload));
  console.log(JSON.stringify({ station: STATION, snap_m: outputs.base.station_snap.distance_m, metrics: Object.fromEntries(Object.entries(outputs).map(([k, v]) => [k, v.metrics])), targets: outputs.base.targets }, null, 2));
}

main();
