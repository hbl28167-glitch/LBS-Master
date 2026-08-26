/**
 * Accessibility E · fromPoint (PRD 05.2 §3.5)
 * Road-time impedance isochrones. Synthetic · not navigation.
 */
(function (global) {
  "use strict";

  let graphCache = null;
  let graphKey = "";

  function haversineM(lat1, lng1, lat2, lng2) {
    const toR = Math.PI / 180;
    const R = 6371000;
    const dLat = (lat2 - lat1) * toR;
    const dLng = (lng2 - lng1) * toR;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toR) *
        Math.cos(lat2 * toR) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function quantKey(lat, lng, prec) {
    // ~110m grid @ prec=3 — balances connectivity vs node count
    const p = prec != null ? prec : 3;
    return lat.toFixed(p) + "," + lng.toFixed(p);
  }

  function hwRank(hw) {
    const h = hw || "";
    if (/motorway/.test(h)) return 0;
    if (/trunk/.test(h)) return 1;
    if (/primary/.test(h)) return 2;
    if (/secondary/.test(h)) return 3;
    if (/tertiary/.test(h)) return 4;
    return 5;
  }

  /**
   * Build undirected graph from roads GeoJSON.
   * Prefer higher-class roads; quantize nodes for junction merge.
   */
  function buildGraph(roadsFc, speedFn, opts) {
    const o = opts || {};
    const maxFeats = o.maxFeatures != null ? o.maxFeatures : 18000;
    const feats = ((roadsFc && roadsFc.features) || []).slice();
    feats.sort(function (a, b) {
      return (
        hwRank((a.properties && a.properties.highway) || "") -
        hwRank((b.properties && b.properties.highway) || "")
      );
    });
    const use =
      feats.length > maxFeats
        ? feats.filter(function (f, i) {
            const hw = (f.properties && f.properties.highway) || "";
            if (hwRank(hw) <= 3) return true; // keep secondary+
            return i % 3 === 0;
          }).slice(0, maxFeats)
        : feats;

    const nodes = new Map();
    const edges = new Map();
    const edgeSeen = new Set();

    function ensureNode(lat, lng) {
      const id = quantKey(lat, lng);
      if (!nodes.has(id)) nodes.set(id, { lat: lat, lng: lng });
      else {
        // average toward junction
        const n = nodes.get(id);
        n.lat = (n.lat + lat) / 2;
        n.lng = (n.lng + lng) / 2;
      }
      return id;
    }
    function addEdge(a, b, sec, m) {
      if (a === b) return;
      const k = a < b ? a + ">" + b : b + ">" + a;
      if (edgeSeen.has(k)) return;
      edgeSeen.add(k);
      if (!edges.has(a)) edges.set(a, []);
      if (!edges.has(b)) edges.set(b, []);
      edges.get(a).push({ to: b, sec: sec, m: m });
      edges.get(b).push({ to: a, sec: sec, m: m });
    }

    for (let i = 0; i < use.length; i++) {
      const f = use[i];
      if (!f || !f.geometry) continue;
      const hw = (f.properties && f.properties.highway) || "";
      if (/footway|path|steps|cycleway|pedestrian|track/.test(hw)) continue;
      let lines = [];
      if (f.geometry.type === "LineString") lines = [f.geometry.coordinates];
      else if (f.geometry.type === "MultiLineString")
        lines = f.geometry.coordinates;
      else continue;
      const kmh = Math.max(10, speedFn(f.properties || {}) || 28);
      const mps = (kmh * 1000) / 3600;
      for (let li = 0; li < lines.length; li++) {
        const coords = lines[li];
        if (!coords || coords.length < 2) continue;
        // densify long segments so quantization still chains
        const chain = [];
        for (let j = 0; j < coords.length; j++) {
          chain.push(coords[j]);
          if (j < coords.length - 1) {
            const a = coords[j];
            const b = coords[j + 1];
            const segM = haversineM(a[1], a[0], b[1], b[0]);
            if (segM > 180) {
              const steps = Math.min(6, Math.floor(segM / 120));
              for (let s = 1; s < steps; s++) {
                const t = s / steps;
                chain.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
              }
            }
          }
        }
        for (let j = 0; j < chain.length - 1; j++) {
          const a = chain[j];
          const b = chain[j + 1];
          const m = haversineM(a[1], a[0], b[1], b[0]);
          if (m < 5 || m > 12000) continue;
          const sec = m / mps;
          const na = ensureNode(a[1], a[0]);
          const nb = ensureNode(b[1], b[0]);
          addEdge(na, nb, sec, m);
        }
      }
    }

    return { nodes: nodes, edges: edges, feature_count: use.length };
  }

  function nearestNode(graph, lat, lng, maxSnapM) {
    let best = null;
    let bestD = maxSnapM != null ? maxSnapM : 900;
    graph.nodes.forEach(function (n, id) {
      const d = haversineM(lat, lng, n.lat, n.lng);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    });
    if (!best) return null;
    return { id: best, dist_m: bestD, node: graph.nodes.get(best) };
  }

  /** Binary min-heap by sec */
  function dijkstra(graph, sourceId, maxSec) {
    const dist = new Map();
    const heap = [];
    function push(id, s) {
      heap.push({ id: id, s: s });
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p].s <= heap[i].s) break;
        const t = heap[p];
        heap[p] = heap[i];
        heap[i] = t;
        i = p;
      }
    }
    function pop() {
      if (!heap.length) return null;
      const out = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          let l = i * 2 + 1;
          let r = l + 1;
          let sm = i;
          if (l < heap.length && heap[l].s < heap[sm].s) sm = l;
          if (r < heap.length && heap[r].s < heap[sm].s) sm = r;
          if (sm === i) break;
          const t = heap[i];
          heap[i] = heap[sm];
          heap[sm] = t;
          i = sm;
        }
      }
      return out;
    }

    dist.set(sourceId, 0);
    push(sourceId, 0);
    let visited = 0;
    while (heap.length) {
      const cur = pop();
      if (!cur) break;
      if (cur.s !== dist.get(cur.id)) continue;
      if (cur.s > maxSec) continue;
      visited += 1;
      const outs = graph.edges.get(cur.id) || [];
      for (let i = 0; i < outs.length; i++) {
        const e = outs[i];
        const ns = cur.s + e.sec;
        if (ns > maxSec) continue;
        if (!dist.has(e.to) || ns < dist.get(e.to)) {
          dist.set(e.to, ns);
          push(e.to, ns);
        }
      }
    }
    return { dist: dist, nodes_visited: visited };
  }

  /** Convex hull (Andrew) on [{lat,lng}] */
  function convexHull(points) {
    if (!points || points.length < 3) return points ? points.slice() : [];
    const pts = points
      .map(function (p) {
        return { x: p.lng, y: p.lat };
      })
      .sort(function (a, b) {
        return a.x === b.x ? a.y - b.y : a.x - b.x;
      });
    const cross = function (o, a, b) {
      return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    };
    const lower = [];
    for (let i = 0; i < pts.length; i++) {
      while (
        lower.length >= 2 &&
        cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0
      )
        lower.pop();
      lower.push(pts[i]);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      while (
        upper.length >= 2 &&
        cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0
      )
        upper.pop();
      upper.push(pts[i]);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper).map(function (p) {
      return { lat: p.y, lng: p.x };
    });
  }

  function ringToPolygon(ring) {
    if (!ring || ring.length < 3) return null;
    const coords = ring.map(function (p) {
      return [p.lng, p.lat];
    });
    // close
    const f = coords[0];
    const l = coords[coords.length - 1];
    if (f[0] !== l[0] || f[1] !== l[1]) coords.push([f[0], f[1]]);
    return { type: "Polygon", coordinates: [coords] };
  }

  function circlePoly(lat, lng, radiusM, n) {
    const steps = n || 32;
    const coords = [];
    const dLat = radiusM / 111320;
    const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
    }
    return { type: "Polygon", coordinates: [coords] };
  }

  function polyAreaKm2(geom) {
    if (!geom || !geom.coordinates || !geom.coordinates[0]) return null;
    const ring = geom.coordinates[0];
    if (ring.length < 3) return null;
    let s = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    const deg2 = Math.abs(s) / 2;
    // rough m2 at Shanghai
    const m2 = deg2 * 111320 * 111320 * Math.cos((31.2 * Math.PI) / 180);
    return Math.round((m2 / 1e6) * 100) / 100;
  }

  /**
   * fromPoint(request, ctx)
   * ctx: { roads, scenarioCi, anchorsDoc, zoneById, gapZoneIds:Set, roadsQcOk }
   */
  function fromPoint(request, ctx) {
    const t0 =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const req = request || {};
    const c = ctx || {};
    const scene = req.analysis_scene || {
      time_scenario: "wd_pm_peak",
      weather: "clear"
    };
    const bands = req.bands_min || [5, 10, 15];
    const maxR = req.max_radius_m != null ? req.max_radius_m : 12000;
    const warnings = [];

    if (c.roadsQcOk === false) {
      return {
        ok: false,
        synthetic: true,
        error_code: "qc_blocked",
        message: "路网 QC 未达标，禁用等时圈",
        bands: [],
        zone_coverage: [],
        warnings: ["qc_failed"]
      };
    }
    if (!c.roads || !c.roads.features || !c.roads.features.length) {
      return {
        ok: false,
        synthetic: true,
        error_code: "no_graph",
        message: "无路网数据",
        bands: [],
        zone_coverage: []
      };
    }

    const src = req.source || {};
    let lat = src.lat;
    let lng = src.lng;
    if (lat == null || lng == null) {
      return {
        ok: false,
        synthetic: true,
        error_code: "snap_failed",
        message: "源点缺少坐标",
        bands: [],
        zone_coverage: []
      };
    }

    const speedFn = function (props) {
      if (global.LBSMetrics && LBSMetrics.wayCI) {
        const w = LBSMetrics.wayCI(props, {
          scenarioCi: c.scenarioCi,
          anchorsDoc: c.anchorsDoc,
          time_scenario: scene.time_scenario,
          weather: scene.weather
        });
        return w.speed_kmh;
      }
      return 28;
    };

    const gkey =
      String(c.roads.features.length) +
      "|" +
      scene.time_scenario +
      "|" +
      scene.weather;
    let graph = graphCache;
    if (!graph || graphKey !== gkey) {
      graph = buildGraph(c.roads, speedFn, { maxFeatures: 20000 });
      graphCache = graph;
      graphKey = gkey;
    }

    const snap = nearestNode(graph, lat, lng, 2000);
    if (!snap) {
      return {
        ok: false,
        synthetic: true,
        error_code: "snap_failed",
        message: "无法吸附到路网节点",
        bands: [],
        zone_coverage: [],
        snap: { ok: false }
      };
    }
    if (snap.dist_m > 400) warnings.push("last_mile_coarse");

    const maxMin = Math.max.apply(null, bands);
    const maxSec = maxMin * 60 * 1.15;
    const dij = dijkstra(graph, snap.id, maxSec);

    const bandsOut = [];
    bands.forEach(function (bm) {
      const sec = bm * 60;
      const pts = [];
      dij.dist.forEach(function (s, id) {
        if (s <= sec) {
          const n = graph.nodes.get(id);
          if (n) pts.push(n);
        }
      });
      let geom = null;
      if (pts.length >= 6) {
        const hull = convexHull(pts);
        if (hull.length >= 3) geom = ringToPolygon(hull);
      }
      // always ensure minimum visual radius from effective speed (scene-aware)
      const cityCi = LBSMetrics.lookupCityCI
        ? LBSMetrics.lookupCityCI(
            c.scenarioCi,
            scene.time_scenario,
            scene.weather
          )
        : 1.5;
      const meanKmh = Math.max(12, 36 / Math.max(1, cityCi));
      const rExpect = Math.min(maxR, (meanKmh * 1000 * bm) / 60);
      if (!geom) {
        geom = circlePoly(snap.node.lat, snap.node.lng, rExpect, 40);
        warnings.push("band_" + bm + "_circle_fallback");
      } else {
        // if hull too tiny vs expected, blend outward with circle (visual honesty)
        const area = polyAreaKm2(geom);
        const expectA = Math.PI * Math.pow(rExpect / 1000, 2) * 0.35;
        if (area != null && area < expectA * 0.25) {
          geom = circlePoly(snap.node.lat, snap.node.lng, rExpect * 0.85, 40);
          warnings.push("band_" + bm + "_expanded_circle");
        }
      }
      bandsOut.push({
        minutes: bm,
        geometry: geom,
        area_km2: polyAreaKm2(geom),
        node_count: pts.length
      });
    });

    const zone_coverage = [];
    if (req.include_zone_eta !== false && c.zoneById) {
      c.zoneById.forEach(function (z, zid) {
        if (z.centroid_lat == null) return;
        // ETA: nearest graph node to centroid, then Dijkstra dist
        const zn = nearestNode(graph, z.centroid_lat, z.centroid_lng, 2500);
        let eta = null;
        if (zn && dij.dist.has(zn.id)) {
          eta = dij.dist.get(zn.id) / 60;
          // add last-mile
          eta += zn.dist_m / 1000 / 15 * 60 / 60; // ~15km/h last hop minutes
          eta = Math.round(eta * 10) / 10;
        } else {
          // air distance / effective speed fallback
          const air = haversineM(lat, lng, z.centroid_lat, z.centroid_lng);
          if (air < maxR * 1.2) {
            const city = LBSMetrics.lookupCityCI
              ? LBSMetrics.lookupCityCI(
                  c.scenarioCi,
                  scene.time_scenario,
                  scene.weather
                )
              : 1.5;
            eta = Math.round(((air / 1000) / (28 / city)) * 60 * 10) / 10;
          }
        }
        if (eta == null || eta > maxMin * 1.4) {
          zone_coverage.push({
            zone_id: zid,
            eta_min: eta,
            in_band: { "5": false, "10": false, "15": false },
            zone_type: z.zone_type || null,
            name: z.name || null,
            is_gap: c.gapZoneIds ? c.gapZoneIds.has(zid) : null
          });
          return;
        }
        zone_coverage.push({
          zone_id: zid,
          eta_min: eta,
          in_band: {
            "5": eta <= 5,
            "10": eta <= 10,
            "15": eta <= 15
          },
          zone_type: z.zone_type || null,
          name: z.name || null,
          is_gap: c.gapZoneIds ? c.gapZoneIds.has(zid) : null
        });
      });
    }

    const t1 =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    return {
      ok: true,
      synthetic: true,
      request_echo: {
        source: src,
        analysis_scene: scene,
        bands_min: bands,
        profile: req.profile || "car_urban"
      },
      snap: {
        ok: true,
        lng: snap.node.lng,
        lat: snap.node.lat,
        road_id: null,
        snap_dist_m: Math.round(snap.dist_m)
      },
      bands: bandsOut,
      zone_coverage: zone_coverage,
      stats: {
        nodes_visited: dij.nodes_visited,
        elapsed_ms: Math.round(t1 - t0),
        roads_qc_ok: c.roadsQcOk !== false,
        graph_nodes: graph.nodes.size
      },
      warnings: warnings
    };
  }

  function countInBand(result, bandMin) {
    if (!result || !result.zone_coverage) return 0;
    const k = String(bandMin);
    let n = 0;
    result.zone_coverage.forEach(function (z) {
      if (z.in_band && z.in_band[k]) n += 1;
    });
    return n;
  }

  function compareScenes(site, sceneA, sceneB, ctx, bandMin) {
    const b = bandMin != null ? bandMin : 10;
    const ra = fromPoint(
      {
        source: {
          kind: "site",
          id: site.site_id || site.entity_id,
          lat: site.lat,
          lng: site.lng
        },
        analysis_scene: sceneA,
        bands_min: [5, 10, 15],
        include_zone_eta: true
      },
      ctx
    );
    const rb = fromPoint(
      {
        source: {
          kind: "site",
          id: site.site_id || site.entity_id,
          lat: site.lat,
          lng: site.lng
        },
        analysis_scene: sceneB,
        bands_min: [5, 10, 15],
        include_zone_eta: true
      },
      ctx
    );
    const ca = ra.ok ? countInBand(ra, b) : 0;
    const cb = rb.ok ? countInBand(rb, b) : 0;
    const aa =
      ra.ok && ra.bands
        ? (ra.bands.find(function (x) {
            return x.minutes === b;
          }) || {}).area_km2
        : null;
    const ab =
      rb.ok && rb.bands
        ? (rb.bands.find(function (x) {
            return x.minutes === b;
          }) || {}).area_km2
        : null;
    return {
      site_id: site.site_id || site.entity_id,
      scene_a: sceneA,
      scene_b: sceneB,
      band_min: b,
      result_a: ra,
      result_b: rb,
      coverage_count_a: ca,
      coverage_count_b: cb,
      delta_coverage_count: cb - ca,
      area_km2_a: aa != null ? aa : null,
      area_km2_b: ab != null ? ab : null,
      delta_area_km2:
        aa != null && ab != null ? Math.round((ab - aa) * 100) / 100 : null
    };
  }

  function adviceTemplate(site, compare, powerLabel) {
    if (!compare) return "";
    const d = compare.delta_coverage_count;
    const pct =
      compare.coverage_count_a > 0
        ? Math.round((d / compare.coverage_count_a) * 100)
        : 0;
    const name = site.name || site.site_id || "该站";
    let s =
      name +
      " · 10min 覆盖：情景A " +
      compare.coverage_count_a +
      " 区 → 情景B " +
      compare.coverage_count_b +
      " 区（Δ " +
      (d >= 0 ? "+" : "") +
      d +
      (pct ? " / " + pct + "%" : "") +
      "）。";
    if (d <= -2) {
      s +=
        "塌缩主因路阻抗（高峰/雨），非单看功率；保守设计取晚峰+雨，周边可考虑第二站或引导。";
    } else if (d >= 0) {
      s += "压力情景下覆盖仍稳；可关注功率结构是否匹配区需求（" +
        (powerLabel || "—") +
        "）。";
    } else {
      s += "覆盖略降；结合缺口区表决定是否扩容枪功率。";
    }
    return s;
  }

  function clearGraphCache() {
    graphCache = null;
    graphKey = "";
  }

  global.LBSAccess = {
    fromPoint: fromPoint,
    compareScenes: compareScenes,
    countInBand: countInBand,
    adviceTemplate: adviceTemplate,
    clearGraphCache: clearGraphCache,
    haversineM: haversineM
  };
})(typeof window !== "undefined" ? window : globalThis);
