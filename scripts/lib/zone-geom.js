/**
 * Road-aligned zone polygons (GCJ-02).
 * Collect nearby road vertices → convex hull (+ light inflate).
 * Fallback: irregular multi-lobe ring (not smooth ellipse) if roads sparse.
 */

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function distM(lng1, lat1, lng2, lat2) {
  const mLat = 111320;
  const mLng = 111320 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  const dx = (lng2 - lng1) * mLng;
  const dy = (lat2 - lat1) * mLat;
  return Math.hypot(dx, dy);
}

function cross(o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Monotone chain convex hull. pts: [lng,lat][] */
function convexHull(pts) {
  if (pts.length < 3) return pts.slice();
  const p = pts
    .map(function (q) {
      return [q[0], q[1]];
    })
    .sort(function (a, b) {
      return a[0] === b[0] ? a[1] - b[1] : a[0] - b[0];
    });
  // unique
  const uniq = [];
  for (let i = 0; i < p.length; i++) {
    if (
      i === 0 ||
      p[i][0] !== p[i - 1][0] ||
      p[i][1] !== p[i - 1][1]
    ) {
      uniq.push(p[i]);
    }
  }
  if (uniq.length < 3) return uniq;

  const lower = [];
  for (let i = 0; i < uniq.length; i++) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], uniq[i]) <= 0
    ) {
      lower.pop();
    }
    lower.push(uniq[i]);
  }
  const upper = [];
  for (let i = uniq.length - 1; i >= 0; i--) {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], uniq[i]) <= 0
    ) {
      upper.pop();
    }
    upper.push(uniq[i]);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function ringClose(ring) {
  if (!ring.length) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]]);
  return ring;
}

/** Push vertices away from centroid by factor (area inflate). */
function inflateRing(ring, clng, clat, factor) {
  return ring.map(function (p) {
    if (p[0] === ring[0][0] && p[1] === ring[0][1] && ring.indexOf(p) > 0) {
      return p;
    }
    const lng = clng + (p[0] - clng) * factor;
    const lat = clat + (p[1] - clat) * factor;
    return [round6(lng), round6(lat)];
  });
}

/**
 * Irregular fallback (NOT smooth ellipse): radial spikes + flats,
 * optionally biased by road direction histogram.
 */
function irregularFallbackRing(lng, lat, rx_m, ry_m, rotDeg, n, seed) {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const rx = rx_m / mPerDegLng;
  const ry = ry_m / mPerDegLat;
  const rot = ((rotDeg || 0) * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const ring = [];
  const nn = Math.max(16, n || 24);
  for (let i = 0; i <= nn; i++) {
    const t = (i / nn) * Math.PI * 2;
    // lobed radius: 4–6 sides feel like blocks
    const lobes = 4 + (seed % 3);
    const wobble =
      0.72 +
      0.22 * Math.abs(Math.cos(t * lobes * 0.5)) +
      0.08 * Math.sin(t * (lobes + 1) + seed);
    const x = rx * Math.cos(t) * wobble;
    const y = ry * Math.sin(t) * wobble;
    const xr = x * cos - y * sin;
    const yr = x * sin + y * cos;
    // flatten some edges (city-block feel)
    const flat = 0.92 + 0.08 * Math.sign(Math.cos(t * 2 + seed));
    ring.push([round6(lng + xr * flat), round6(lat + yr * flat)]);
  }
  return ringClose(ring);
}

function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Build spatial index of road sample points.
 * @returns {{ query: (lng,lat,r_m)=>[lng,lat][], count: number }}
 */
function buildRoadPointIndex(roadsFc, options) {
  const opts = options || {};
  const cell = opts.cellDeg || 0.01; // ~1km
  const skipLink = opts.skipLink !== false;
  const stepM = opts.sampleStepM || 80;
  const idx = new Map();
  let count = 0;

  function addPt(lng, lat) {
    const kx = Math.floor(lng / cell);
    const ky = Math.floor(lat / cell);
    const k = kx + "," + ky;
    let arr = idx.get(k);
    if (!arr) {
      arr = [];
      idx.set(k, arr);
    }
    arr.push([lng, lat]);
    count++;
  }

  function densify(a, b) {
    const d = distM(a[0], a[1], b[0], b[1]);
    const n = Math.max(1, Math.floor(d / stepM));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      addPt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    }
  }

  const feats = (roadsFc && roadsFc.features) || [];
  for (let fi = 0; fi < feats.length; fi++) {
    const f = feats[fi];
    const hw = (f.properties && f.properties.highway) || "";
    if (skipLink && hw.indexOf("link") >= 0) continue;
    const g = f.geometry;
    if (!g) continue;
    let lines = [];
    if (g.type === "LineString") lines = [g.coordinates];
    else if (g.type === "MultiLineString") lines = g.coordinates;
    else continue;
    for (let li = 0; li < lines.length; li++) {
      const c = lines[li];
      for (let i = 0; i < c.length - 1; i++) densify(c[i], c[i + 1]);
    }
  }

  function query(lng, lat, r_m) {
    const mLat = 111320;
    const mLng = 111320 * Math.cos((lat * Math.PI) / 180);
    const dLng = r_m / mLng;
    const dLat = r_m / mLat;
    const kx0 = Math.floor((lng - dLng) / cell);
    const kx1 = Math.floor((lng + dLng) / cell);
    const ky0 = Math.floor((lat - dLat) / cell);
    const ky1 = Math.floor((lat + dLat) / cell);
    const out = [];
    const r2 = r_m * r_m;
    for (let kx = kx0; kx <= kx1; kx++) {
      for (let ky = ky0; ky <= ky1; ky++) {
        const arr = idx.get(kx + "," + ky);
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const p = arr[i];
          const dx = (p[0] - lng) * mLng;
          const dy = (p[1] - lat) * mLat;
          if (dx * dx + dy * dy <= r2) out.push(p);
        }
      }
    }
    return out;
  }

  return { query: query, count: count };
}

/**
 * @returns {{ ring: number[][], method: string, road_pts: number }}
 */
function zonePolygonFromRoads(clng, clat, rx_m, ry_m, rot_deg, zoneKey, roadIndex) {
  const R = Math.max(rx_m || 600, ry_m || 600) * 1.12;
  const minPts = 10;
  let pts = roadIndex ? roadIndex.query(clng, clat, R) : [];

  // Cap points for hull speed
  if (pts.length > 800) {
    const step = Math.ceil(pts.length / 600);
    const thin = [];
    for (let i = 0; i < pts.length; i += step) thin.push(pts[i]);
    pts = thin;
  }

  if (pts.length >= minPts) {
    let hull = convexHull(pts);
    if (hull.length >= 3) {
      // inflate slightly so fill covers block interiors, not only road centerlines
      const factor =
        (rx_m || 600) > 1500 ? 1.06 : (rx_m || 600) > 900 ? 1.1 : 1.14;
      let ring = inflateRing(hull, clng, clat, factor);
      ring = ring.map(function (p) {
        return [round6(p[0]), round6(p[1])];
      });
      ring = ringClose(ring);
      // Ensure ring not inverted / too few
      if (ring.length >= 4) {
        return {
          ring: ring,
          method: "road_convex_hull",
          road_pts: pts.length
        };
      }
    }
  }

  const seed = hashSeed(zoneKey || "z");
  return {
    ring: irregularFallbackRing(
      clng,
      clat,
      rx_m || 600,
      ry_m || 600,
      rot_deg || 0,
      20,
      seed
    ),
    method: "irregular_fallback",
    road_pts: pts.length
  };
}

module.exports = {
  buildRoadPointIndex,
  zonePolygonFromRoads,
  convexHull,
  round6
};

