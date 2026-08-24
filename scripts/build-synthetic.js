/**
 * WS-C · Zone-driven synthetic metrics + dense 小李 entities (05.1 / Byteda-V2-0824).
 *
 * ALL business numbers are Synthetic (manifest.synthetic=true).
 * Display brand: 小李* — no employer site names.
 *
 * Primary spatial key: zone_id = sh:z:{type}:{slug} (WS-B zones, frozen).
 * Fine-grid heat: sh:f:{cell_m}:{row}:{col} inherits nearest zone × distance decay.
 * Legacy 1km grids.json is NOT the product metric spine (ui_default_layer=false).
 *
 * ── Zone × TOD shape (05.1 §4.3 direction-locked) ───────────────────
 * dense_mass residential → ride/delivery strong at wd_am + wd_pm
 * office/CBD             → ride noon/pm tide; delivery midday medium
 * retail premium         → o2o strong we_aft / weekend evening
 * hub                    → ride pulse all day; delivery weak–mid
 * scenic                 → weekend/holiday pulse (we_aft + national_day bias)
 *
 * grade multipliers on base (retail/residential).
 *
 * Runtime (WS-D):
 *   demand = demand_base * weather.demand_{scene} * node_coeff
 *   supply = supply_base * weather.supply_{scene} * node_coeff / difficulty_{scene}
 *   gap    = demand - supply   // identity norm on 0–100 bases
 * difficulty from data/static/congestion_coeff.json (citywide + corridor extras).
 *
 * Entities: 小李充电 800–1500; 小李门店 1500–3000; GCJ near zones.
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");

const ZONES = root("data", "processed", "zones_shanghai.json");
const FINE = root("data", "processed", "grids_fine.json");
const ANCHORS = root("data", "static", "anchors_shanghai.json");

const OUT_ZONE = root("data", "processed", "metrics_zone.json");
const OUT_RIDE = root("data", "processed", "metrics_ride.json");
const OUT_DEL = root("data", "processed", "metrics_delivery.json");
const OUT_CHG = root("data", "processed", "metrics_chg.json");
const OUT_O2O = root("data", "processed", "metrics_o2o.json");
const OUT_HEAT = root("data", "processed", "metrics_heat_fine.json");
const OUT_CHG_ENT = root("data", "processed", "entities_charger.json");
const OUT_STORE = root("data", "processed", "entities_store.json");

const TIMES = ["wd_am_peak", "wd_pm_peak", "we_aft"];
const SCENES = ["ride", "delivery", "chg", "o2o"];

/** Base demand/supply by zone_type (clear/baseline skeleton) */
const TYPE_BASE = {
  retail: {
    ride: [52, 48],
    delivery: [48, 46],
    chg: [55, 42],
    o2o: [62, 50]
  },
  residential: {
    ride: [50, 50],
    delivery: [58, 44],
    chg: [40, 36],
    o2o: [42, 40]
  },
  office: {
    ride: [60, 46],
    delivery: [50, 42],
    chg: [48, 38],
    o2o: [45, 42]
  },
  industrial: {
    ride: [38, 40],
    delivery: [36, 38],
    chg: [44, 40],
    o2o: [28, 30]
  },
  hub: {
    ride: [72, 40],
    delivery: [40, 38],
    chg: [58, 45],
    o2o: [30, 32]
  },
  scenic: {
    ride: [42, 36],
    delivery: [40, 38],
    chg: [35, 30],
    o2o: [48, 40]
  },
  rural: {
    ride: [22, 28],
    delivery: [20, 26],
    chg: [18, 22],
    o2o: [16, 20]
  }
};

/**
 * TOD multipliers [demand, supply] by type — 05.1 table directions.
 */
const TOD_MUL = {
  wd_am_peak: {
    retail: { ride: [0.9, 0.95], delivery: [0.95, 1.0], chg: [0.85, 1.0], o2o: [0.75, 0.95] },
    residential: { ride: [1.4, 0.85], delivery: [1.35, 0.88], chg: [0.9, 1.0], o2o: [0.85, 0.95] },
    office: { ride: [1.15, 1.05], delivery: [1.1, 1.0], chg: [0.95, 1.0], o2o: [1.05, 1.0] },
    industrial: { ride: [1.2, 1.0], delivery: [1.05, 1.0], chg: [1.0, 1.0], o2o: [0.7, 0.9] },
    hub: { ride: [1.35, 0.9], delivery: [0.95, 0.95], chg: [1.1, 0.95], o2o: [0.8, 0.9] },
    scenic: { ride: [0.75, 0.85], delivery: [0.8, 0.9], chg: [0.7, 0.9], o2o: [0.7, 0.85] },
    rural: { ride: [0.95, 1.0], delivery: [0.9, 1.0], chg: [0.85, 1.0], o2o: [0.7, 0.9] }
  },
  wd_pm_peak: {
    retail: { ride: [1.2, 1.0], delivery: [1.25, 0.95], chg: [1.15, 0.95], o2o: [1.15, 1.0] },
    residential: { ride: [1.25, 1.2], delivery: [1.4, 0.9], chg: [1.05, 0.95], o2o: [1.0, 1.0] },
    office: { ride: [1.5, 0.88], delivery: [1.15, 0.92], chg: [1.2, 0.9], o2o: [0.95, 0.95] },
    industrial: { ride: [1.15, 0.95], delivery: [1.0, 0.95], chg: [1.05, 0.95], o2o: [0.65, 0.9] },
    hub: { ride: [1.4, 0.85], delivery: [1.05, 0.9], chg: [1.2, 0.9], o2o: [0.85, 0.9] },
    scenic: { ride: [0.95, 0.9], delivery: [0.95, 0.9], chg: [0.85, 0.9], o2o: [1.0, 0.95] },
    rural: { ride: [0.9, 1.0], delivery: [0.95, 1.0], chg: [0.9, 1.0], o2o: [0.75, 0.95] }
  },
  we_aft: {
    retail: { ride: [1.15, 1.05], delivery: [1.2, 1.0], chg: [1.25, 0.9], o2o: [1.45, 1.05] },
    residential: { ride: [1.05, 1.1], delivery: [1.2, 1.0], chg: [1.1, 0.95], o2o: [1.15, 1.0] },
    office: { ride: [0.55, 0.7], delivery: [0.65, 0.75], chg: [0.7, 0.8], o2o: [0.6, 0.75] },
    industrial: { ride: [0.5, 0.7], delivery: [0.55, 0.75], chg: [0.6, 0.8], o2o: [0.45, 0.7] },
    hub: { ride: [1.25, 0.95], delivery: [1.0, 0.95], chg: [1.15, 0.95], o2o: [0.9, 0.95] },
    scenic: { ride: [1.4, 1.0], delivery: [1.15, 0.95], chg: [1.0, 0.9], o2o: [1.3, 1.0] },
    rural: { ride: [0.85, 0.95], delivery: [0.9, 0.95], chg: [0.8, 0.95], o2o: [0.8, 0.9] }
  }
};

/** Grade multipliers on demand (supply milder) */
const GRADE_DEMAND = {
  // retail
  premium: 1.22,
  mass: 1.05,
  community: 0.92,
  // residential
  dense_mass: 1.2,
  improve: 1.0,
  premium_low: 0.78
};
const GRADE_SUPPLY = {
  premium: 0.95,
  mass: 1.0,
  community: 1.05,
  dense_mass: 0.92,
  improve: 1.0,
  premium_low: 1.08
};

const CHARGER_TARGET = 1100;
const STORE_TARGET = 2200;

function clamp100(x) {
  if (x < 0) return 0;
  if (x > 100) return 100;
  return Math.round(x * 10) / 10;
}

function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function distM(lng1, lat1, lng2, lat2) {
  const R = 6371000;
  const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLng = toR(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function labelBoost(labels, scene) {
  const set = new Set(labels || []);
  let d = 1;
  let s = 1;
  if (set.has("lingang") || set.has("new_town")) {
    d *= scene === "ride" || scene === "delivery" ? 1.15 : 1.08;
    s *= 0.82;
  }
  if (set.has("cbd") || set.has("finance") || set.has("lujiazui")) {
    if (scene === "ride") {
      d *= 1.12;
      s *= 0.9;
    }
  }
  if (set.has("airport") || set.has("rail") || set.has("metro")) {
    if (scene === "ride") {
      d *= 1.1;
      s *= 0.88;
    }
  }
  return { d, s };
}

function zoneBases(z, scene, tod) {
  const zt = TYPE_BASE[z.zone_type] ? z.zone_type : "rural";
  const [bd, bs] = TYPE_BASE[zt][scene] || [30, 30];
  const tm = (TOD_MUL[tod] && TOD_MUL[tod][zt] && TOD_MUL[tod][zt][scene]) || [
    1, 1
  ];
  const gd = (z.grade && GRADE_DEMAND[z.grade]) || 1;
  const gs = (z.grade && GRADE_SUPPLY[z.grade]) || 1;
  const lb = labelBoost(z.labels, scene);
  const n1 = 0.92 + 0.16 * hash01(`${z.zone_id}|${scene}|d|${tod}`);
  const n2 = 0.92 + 0.16 * hash01(`${z.zone_id}|${scene}|s|${tod}`);
  const demand_base = clamp100(bd * tm[0] * gd * lb.d * n1);
  const supply_base = clamp100(bs * tm[1] * gs * lb.s * n2);
  return { demand_base, supply_base };
}

function metricRow(z, scene, tod) {
  const { demand_base, supply_base } = zoneBases(z, scene, tod);
  return {
    zone_id: z.zone_id,
    // compat: D indexByGrid may still key on grid_id — alias zone for zone-mode
    grid_id: z.zone_id,
    unit_kind: "zone",
    scene,
    time_of_day: tod,
    demand_base,
    supply_base,
    zone_type: z.zone_type,
    grade: z.grade || null
  };
}

function nearestZone(lng, lat, zones, cacheHint) {
  let best = cacheHint || null;
  let bestD = best
    ? distM(lng, lat, best.centroid_lng, best.centroid_lat)
    : Infinity;
  // if hint already close, keep
  if (best && bestD < 800) return { zone: best, d: bestD };
  for (const z of zones) {
    const d = distM(lng, lat, z.centroid_lng, z.centroid_lat);
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return { zone: best, d: bestD };
}

/**
 * Scatter entities around zone centroids (ellipse-ish using rx_m/ry_m).
 */
function scatterEntities(zones, kind, target) {
  const brand = kind === "charger" ? "小李充电" : "小李门店";
  const prefix = kind === "charger" ? "xl_chg" : "xl_store";
  // weight by type suitability
  const weight = (z) => {
    const t = z.zone_type;
    if (kind === "charger") {
      if (t === "retail" || t === "hub") return 3.2;
      if (t === "office" || t === "residential") return 2.2;
      if (t === "industrial") return 1.4;
      if (t === "scenic") return 1.0;
      return 0.35;
    }
    // store
    if (t === "retail") return 3.5;
    if (t === "residential") return 2.8;
    if (t === "office") return 1.6;
    if (t === "hub") return 1.2;
    if (t === "scenic") return 1.0;
    return 0.3;
  };

  const pool = zones.filter((z) => weight(z) > 0.4);
  const totalW = pool.reduce((s, z) => s + weight(z), 0);
  const entities = [];
  let seq = 1;

  for (const z of pool) {
    const n = Math.max(1, Math.round((weight(z) / totalW) * target));
    const rx = (z.rx_m || 600) / 111320;
    const ry =
      (z.ry_m || 500) / (111320 * Math.cos((z.centroid_lat * Math.PI) / 180));
    for (let i = 0; i < n && entities.length < target + 50; i++) {
      const h = hash01(`${z.zone_id}|${kind}|${i}`);
      const h2 = hash01(`${z.zone_id}|${kind}|r|${i}`);
      const ang = h * Math.PI * 2;
      const rad = 0.15 + 0.85 * Math.sqrt(h2);
      const lng =
        Math.round((z.centroid_lng + Math.cos(ang) * rx * rad) * 1e6) / 1e6;
      const lat =
        Math.round((z.centroid_lat + Math.sin(ang) * ry * rad) * 1e6) / 1e6;
      const id = `${prefix}_${String(seq).padStart(4, "0")}`;
      if (kind === "charger") {
        entities.push({
          entity_id: id,
          brand,
          name: `${brand}-${String(seq).padStart(4, "0")}`,
          lng,
          lat,
          crs: "GCJ-02",
          stalls: 4 + Math.floor(hash01(`${id}|st`) * 13),
          power_kw: hash01(`${id}|pw`) > 0.5 ? 120 : 60,
          status: "open",
          zone_id: z.zone_id,
          synthetic: true
        });
      } else {
        entities.push({
          entity_id: id,
          brand,
          name: `${brand}-${String(seq).padStart(4, "0")}`,
          lng,
          lat,
          crs: "GCJ-02",
          store_type: z.zone_type === "retail" ? "flagship_or_mall" : "community",
          status: "open",
          zone_id: z.zone_id,
          synthetic: true
        });
      }
      seq++;
    }
  }

  // trim/pad to band
  if (entities.length > target) entities.length = target;
  while (entities.length < Math.min(target, kind === "charger" ? 800 : 1500)) {
    const z = pool[entities.length % pool.length];
    const h = hash01(`pad|${kind}|${entities.length}`);
    const lng = Math.round((z.centroid_lng + (h - 0.5) * 0.01) * 1e6) / 1e6;
    const lat =
      Math.round((z.centroid_lat + (hash01(`pad2|${entities.length}`) - 0.5) * 0.008) *
        1e6) / 1e6;
    seq++;
    const id = `${prefix}_${String(seq).padStart(4, "0")}`;
    entities.push({
      entity_id: id,
      brand,
      name: `${brand}-${String(seq).padStart(4, "0")}`,
      lng,
      lat,
      crs: "GCJ-02",
      status: "open",
      zone_id: z.zone_id,
      synthetic: true,
      ...(kind === "charger"
        ? { stalls: 6, power_kw: 60 }
        : { store_type: "community" })
    });
  }
  return entities;
}

function writeMetricsDoc(scene, rows, extra) {
  return {
    version: "0.2.0",
    synthetic: true,
    scene,
    unit_kind_primary: "zone",
    time_of_day_keys: TIMES,
    unit: "index_0_100",
    zone_id_rule: "sh:z:{type}:{slug}",
    count: rows.length,
    ...extra,
    rows
  };
}

function main() {
  if (!fs.existsSync(ZONES)) {
    console.error("BLOCKED: missing zones_shanghai.json — run npm run build:zones");
    console.error(
      "Minimal zone fields: zone_id, name, zone_type, grade, centroid_lng/lat, labels, rx_m/ry_m"
    );
    process.exit(1);
  }
  const zdoc = JSON.parse(fs.readFileSync(ZONES, "utf8"));
  const zones = zdoc.zones || [];
  if (zones.length < 10) {
    console.error("zones too few:", zones.length);
    process.exit(1);
  }
  if (zdoc.zone_id_rule && zdoc.zone_id_rule !== "sh:z:{type}:{slug}") {
    console.warn("unexpected zone_id_rule", zdoc.zone_id_rule);
  }

  const allZoneRows = [];
  const byScene = { ride: [], delivery: [], chg: [], o2o: [] };

  for (const z of zones) {
    for (const tod of TIMES) {
      for (const scene of SCENES) {
        const row = metricRow(z, scene, tod);
        allZoneRows.push(row);
        byScene[scene].push(row);
      }
    }
  }

  // Fine-grid heat: ride + delivery demand/supply from nearest zone (decay)
  const heatRows = [];
  let fineCount = 0;
  if (fs.existsSync(FINE)) {
    const fdoc = JSON.parse(fs.readFileSync(FINE, "utf8"));
    const cells = fdoc.grids || [];
    fineCount = cells.length;
    // spatial grid bucket for faster NN (0.05 deg ~5km)
    const bucket = new Map();
    function bkey(lng, lat) {
      return `${Math.floor(lng * 20)}_${Math.floor(lat * 20)}`;
    }
    for (const z of zones) {
      const k = bkey(z.centroid_lng, z.centroid_lat);
      if (!bucket.has(k)) bucket.set(k, []);
      bucket.get(k).push(z);
    }
    function nn(lng, lat) {
      const bx = Math.floor(lng * 20);
      const by = Math.floor(lat * 20);
      let cand = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const arr = bucket.get(`${bx + dx}_${by + dy}`);
          if (arr) cand = cand.concat(arr);
        }
      }
      if (!cand.length) cand = zones;
      let best = cand[0];
      let bestD = Infinity;
      for (const z of cand) {
        const d = distM(lng, lat, z.centroid_lng, z.centroid_lat);
        if (d < bestD) {
          bestD = d;
          best = z;
        }
      }
      return { zone: best, d: bestD };
    }

    // heat scenes: ride + delivery only (size control)
    for (const cell of cells) {
      if (cell.is_valid === false) continue;
      const { zone, d } = nn(cell.cell_lng, cell.cell_lat);
      // influence radius ~ zone size + buffer
      const R = Math.max(zone.rx_m || 800, zone.ry_m || 800) * 1.8;
      const decay = d > R * 2.5 ? 0.08 : Math.max(0.12, 1 - d / (R * 2.5));
      for (const tod of TIMES) {
        for (const scene of ["ride", "delivery"]) {
          const { demand_base, supply_base } = zoneBases(zone, scene, tod);
          heatRows.push({
            grid_id: cell.grid_id,
            zone_id: zone.zone_id,
            unit_kind: "fine_grid",
            cell_m: cell.cell_m,
            scene,
            time_of_day: tod,
            demand_base: clamp100(demand_base * decay),
            supply_base: clamp100(supply_base * Math.min(1.05, decay + 0.08))
          });
        }
      }
    }
  } else {
    console.warn(
      "grids_fine.json missing — metrics_heat_fine skipped; D may rasterize zones client-side"
    );
  }

  const chargers = scatterEntities(zones, "charger", CHARGER_TARGET);
  const stores = scatterEntities(zones, "store", STORE_TARGET);

  if (chargers.length < 800 || chargers.length > 1500) {
    console.error("charger count out of PRD band:", chargers.length);
    process.exit(1);
  }
  if (stores.length < 1500 || stores.length > 3000) {
    console.error("store count out of PRD band:", stores.length);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_ZONE), { recursive: true });
  fs.writeFileSync(
    OUT_ZONE,
    JSON.stringify({
      version: "0.2.0",
      synthetic: true,
      unit_kind_primary: "zone",
      scenes: SCENES,
      time_of_day_keys: TIMES,
      zone_id_rule: zdoc.zone_id_rule || "sh:z:{type}:{slug}",
      count: allZoneRows.length,
      rows: allZoneRows
    })
  );
  fs.writeFileSync(
    OUT_RIDE,
    JSON.stringify(
      writeMetricsDoc("ride", byScene.ride, {
        depth: "deep",
        note: "zone-primary; grid_id aliases zone_id for legacy loaders"
      })
    )
  );
  fs.writeFileSync(
    OUT_DEL,
    JSON.stringify(writeMetricsDoc("delivery", byScene.delivery, { depth: "deep" }))
  );
  fs.writeFileSync(
    OUT_CHG,
    JSON.stringify(writeMetricsDoc("chg", byScene.chg, { depth: "medium" }))
  );
  fs.writeFileSync(
    OUT_O2O,
    JSON.stringify(writeMetricsDoc("o2o", byScene.o2o, { depth: "medium" }))
  );
  fs.writeFileSync(
    OUT_HEAT,
    JSON.stringify({
      version: "0.2.0",
      synthetic: true,
      unit_kind: "fine_grid",
      purpose: "heat_mode_fine_grid",
      scenes: ["ride", "delivery"],
      time_of_day_keys: TIMES,
      grid_id_rule: "sh:f:{cell_m}:{row}:{col}",
      fine_cells_source: fineCount,
      count: heatRows.length,
      note: "Same indicator family as zone metrics; decay from nearest zone centroid. KDE left to D.",
      rows: heatRows
    })
  );
  fs.writeFileSync(
    OUT_CHG_ENT,
    JSON.stringify(
      {
        version: "0.2.0",
        synthetic: true,
        brand: "小李充电",
        crs: "GCJ-02",
        count: chargers.length,
        entities: chargers
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    OUT_STORE,
    JSON.stringify(
      {
        version: "0.2.0",
        synthetic: true,
        brand: "小李门店",
        crs: "GCJ-02",
        count: stores.length,
        entities: stores
      },
      null,
      2
    )
  );

  console.log(
    `synthetic(zone): zones=${zones.length} zone_rows=${allZoneRows.length} heat=${heatRows.length} chargers=${chargers.length} stores=${stores.length}`
  );
  console.log("  → metrics_zone / ride / delivery / chg / o2o / heat_fine");
  console.log("  → entities_charger / entities_store");
}

main();
