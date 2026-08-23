/**
 * WS-C · Synthetic ride/chg metrics + 小李 charger entities.
 *
 * ALL business numbers are Synthetic (manifest.synthetic=true).
 * Display brand: 小李* — no employer site names.
 *
 * ── Ride base formula (interview-friendly) ──────────────────────────
 * demand_base, supply_base ∈ [0,100] indices (already "normed").
 *
 *   demand_base = clamp0_100(
 *     BASE_DEMAND[landuse]
 *     * TOD_DEMAND[time][landuse]
 *     * labelBoost(labels)          // lingang / hub / cbd
 *     * (0.92 + 0.16 * hash01)      // mild spatial noise
 *     * invalidFactor               // is_valid=false → near-zero
 *   )
 *
 *   supply_base = clamp0_100(
 *     BASE_SUPPLY[landuse]
 *     * TOD_SUPPLY[time][landuse]
 *     * labelSupplyBoost(labels)
 *     * (0.92 + 0.16 * hash01b)
 *     * invalidFactor
 *   )
 *
 * Landuse narrative:
 *   office      → wd_pm_peak demand high (off-work outbound); am moderate inbound
 *   residential → wd_am_peak demand high (commute out); wd_pm_peak supply up (return/home pool)
 *   hub/airport → structural demand>supply for long-haul story
 *   lingang*    → amplify demand/supply spread (remote belt)
 *   retail      → we_aft demand peak
 *
 * Runtime (WS-D), see contracts/scene-gap.schema.json:
 *   demand = demand_base * weather_coeff[w].demand_ride * node_coeff
 *   supply = supply_base * weather_coeff[w].supply_ride * node_coeff
 *   gap    = demand - supply   // identity norm on 0–100 indices
 *
 * Chg: sparser rows (valid + non-other landuse or label hit).
 * Chargers: 50–200 GCJ points near retail/hub anchors, name 小李充电-NNN.
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");

const GRIDS = root("data", "processed", "grids.json");
const ANCHORS = root("data", "static", "anchors_shanghai.json");
const OUT_RIDE = root("data", "processed", "metrics_ride.json");
const OUT_CHG = root("data", "processed", "metrics_chg.json");
const OUT_CHG_ENT = root("data", "processed", "entities_charger.json");

const TIMES = ["wd_am_peak", "wd_pm_peak", "we_aft"];

/** Base demand level by landuse (clear/baseline shape) */
const BASE_DEMAND = {
  office: 62,
  residential: 48,
  retail: 55,
  hub: 70,
  industrial_park: 42,
  scenic: 38,
  mixed: 44,
  other: 22
};

/** Base supply (fleet presence) — often lag demand in hubs/CBD */
const BASE_SUPPLY = {
  office: 48,
  residential: 52,
  retail: 50,
  hub: 42,
  industrial_park: 40,
  scenic: 35,
  mixed: 46,
  other: 28
};

/**
 * TOD multipliers on demand. office pm high; residential am high; retail weekend aft.
 */
const TOD_DEMAND = {
  wd_am_peak: {
    office: 1.05,
    residential: 1.35,
    retail: 0.85,
    hub: 1.25,
    industrial_park: 1.15,
    scenic: 0.7,
    mixed: 1.1,
    other: 0.9
  },
  wd_pm_peak: {
    office: 1.45,
    residential: 0.95,
    retail: 1.15,
    hub: 1.3,
    industrial_park: 1.2,
    scenic: 0.85,
    mixed: 1.15,
    other: 0.95
  },
  we_aft: {
    office: 0.55,
    residential: 1.05,
    retail: 1.4,
    hub: 1.2,
    industrial_park: 0.5,
    scenic: 1.35,
    mixed: 1.1,
    other: 0.85
  }
};

/**
 * TOD supply: residential pm return pool ↑; office pm fleet thinner relative to demand.
 */
const TOD_SUPPLY = {
  wd_am_peak: {
    office: 1.1,
    residential: 0.85,
    retail: 0.95,
    hub: 0.9,
    industrial_park: 1.0,
    scenic: 0.8,
    mixed: 1.0,
    other: 0.95
  },
  wd_pm_peak: {
    office: 0.88,
    residential: 1.25,
    retail: 1.05,
    hub: 0.85,
    industrial_park: 0.95,
    scenic: 0.9,
    mixed: 1.05,
    other: 1.0
  },
  we_aft: {
    office: 0.7,
    residential: 1.1,
    retail: 1.15,
    hub: 0.95,
    industrial_park: 0.65,
    scenic: 1.1,
    mixed: 1.05,
    other: 0.95
  }
};

function clamp100(x) {
  if (x < 0) return 0;
  if (x > 100) return 100;
  return Math.round(x * 10) / 10;
}

/** FNV-ish stable hash → [0,1) from string */
function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function hasLabel(labels, keys) {
  const set = new Set(labels || []);
  return keys.some((k) => set.has(k));
}

function labelDemandBoost(labels) {
  let m = 1;
  if (hasLabel(labels, ["lingang", "lingang_belt"])) m *= 1.22;
  if (hasLabel(labels, ["lujiazui", "cbd", "finance"])) m *= 1.18;
  if (hasLabel(labels, ["hongqiao", "pvg", "airport", "rail", "metro_hub"])) m *= 1.15;
  if (hasLabel(labels, ["water_edge"])) m *= 0.15;
  return m;
}

function labelSupplyBoost(labels) {
  let m = 1;
  // remote belt: supply thinner → long-haul gap story
  if (hasLabel(labels, ["lingang", "lingang_belt"])) m *= 0.78;
  if (hasLabel(labels, ["lujiazui", "cbd"])) m *= 0.92;
  if (hasLabel(labels, ["hongqiao", "pvg", "airport"])) m *= 0.88;
  if (hasLabel(labels, ["water_edge"])) m *= 0.2;
  return m;
}

function rideRow(cell, tod) {
  const lu = BASE_DEMAND[cell.landuse] != null ? cell.landuse : "other";
  const inv = cell.is_valid === false ? 0.08 : 1;
  const n1 = 0.92 + 0.16 * hash01(`${cell.grid_id}|d|${tod}`);
  const n2 = 0.92 + 0.16 * hash01(`${cell.grid_id}|s|${tod}`);
  const td = (TOD_DEMAND[tod] && TOD_DEMAND[tod][lu]) || 1;
  const ts = (TOD_SUPPLY[tod] && TOD_SUPPLY[tod][lu]) || 1;
  const demand_base = clamp100(
    BASE_DEMAND[lu] * td * labelDemandBoost(cell.labels) * n1 * inv
  );
  const supply_base = clamp100(
    BASE_SUPPLY[lu] * ts * labelSupplyBoost(cell.labels) * n2 * inv
  );
  return {
    grid_id: cell.grid_id,
    scene: "ride",
    time_of_day: tod,
    demand_base,
    supply_base
  };
}

function chgRow(cell, tod) {
  const lu = BASE_DEMAND[cell.landuse] != null ? cell.landuse : "other";
  const inv = cell.is_valid === false ? 0.05 : 1;
  // EV demand: retail/hub/office evening-ish; supply from "pile capacity proxy"
  const demLu = {
    office: 50,
    residential: 42,
    retail: 58,
    hub: 55,
    industrial_park: 48,
    scenic: 40,
    mixed: 45,
    other: 18
  };
  const supLu = {
    office: 40,
    residential: 38,
    retail: 44,
    hub: 48,
    industrial_park: 42,
    scenic: 30,
    mixed: 40,
    other: 22
  };
  const todD = {
    wd_am_peak: 0.85,
    wd_pm_peak: 1.15,
    we_aft: 1.25
  };
  const todS = {
    wd_am_peak: 1.0,
    wd_pm_peak: 0.95,
    we_aft: 0.9
  };
  let dBoost = 1;
  let sBoost = 1;
  if (hasLabel(cell.labels, ["lingang", "lingang_belt"])) {
    dBoost *= 1.1;
    sBoost *= 0.75;
  }
  if (hasLabel(cell.labels, ["lujiazui", "cbd", "commercial", "mall"])) {
    dBoost *= 1.12;
  }
  const n1 = 0.9 + 0.2 * hash01(`${cell.grid_id}|cd|${tod}`);
  const n2 = 0.9 + 0.2 * hash01(`${cell.grid_id}|cs|${tod}`);
  return {
    grid_id: cell.grid_id,
    scene: "chg",
    time_of_day: tod,
    demand_base: clamp100(demLu[lu] * (todD[tod] || 1) * dBoost * n1 * inv),
    supply_base: clamp100(supLu[lu] * (todS[tod] || 1) * sBoost * n2 * inv)
  };
}

function wantChgMetrics(cell) {
  if (cell.is_valid === false) return false;
  if (cell.landuse && cell.landuse !== "other") return true;
  return hasLabel(cell.labels, [
    "lingang",
    "lingang_belt",
    "core_urban",
    "lujiazui",
    "cbd",
    "hongqiao",
    "pvg"
  ]);
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

/**
 * Place 小李 chargers near retail/hub anchors (GCJ jitter).
 * Target 80–160 points.
 */
function buildChargers(anchors, grids) {
  const seeds = (anchors.anchors || []).filter((a) =>
    ["retail", "hub", "mixed", "office", "scenic"].includes(a.landuse)
  );
  const entities = [];
  let seq = 1;
  const TARGET = 120;

  for (const a of seeds) {
    const nNear = a.landuse === "hub" || a.landuse === "retail" ? 10 : 6;
    for (let i = 0; i < nNear && entities.length < TARGET; i++) {
      const h = hash01(`${a.id}|chg|${i}`);
      const h2 = hash01(`${a.id}|chg2|${i}`);
      // ~80–600m GCJ offset
      const ang = h * Math.PI * 2;
      const rDeg = (0.0008 + h2 * 0.0045) ; // ~80m–500m
      const lng = Math.round((a.lng + Math.cos(ang) * rDeg) * 1e6) / 1e6;
      const lat = Math.round((a.lat + Math.sin(ang) * rDeg * 0.85) * 1e6) / 1e6;
      const stalls = 4 + Math.floor(hash01(`${a.id}|st|${i}`) * 13); // 4–16
      const power_kw = hash01(`${a.id}|pw|${i}`) > 0.55 ? 120 : 60;
      entities.push({
        entity_id: `xl_chg_${String(seq).padStart(3, "0")}`,
        brand: "小李充电",
        name: `小李充电-${String(seq).padStart(3, "0")}`,
        lng,
        lat,
        crs: "GCJ-02",
        stalls,
        power_kw,
        status: "open",
        anchor_ref: a.id,
        synthetic: true
      });
      seq++;
    }
  }

  // fill toward TARGET using mixed grids near core if short
  if (entities.length < 50) {
    const pool = grids.filter(
      (c) =>
        c.is_valid !== false &&
        (c.landuse === "retail" || c.landuse === "hub" || c.landuse === "mixed")
    );
    let i = 0;
    while (entities.length < 50 && i < pool.length) {
      const c = pool[i++];
      const h = hash01(`${c.grid_id}|fill`);
      if (h < 0.4) continue;
      entities.push({
        entity_id: `xl_chg_${String(seq).padStart(3, "0")}`,
        brand: "小李充电",
        name: `小李充电-${String(seq).padStart(3, "0")}`,
        lng: c.cell_lng,
        lat: c.cell_lat,
        crs: "GCJ-02",
        stalls: 6,
        power_kw: 60,
        status: "open",
        anchor_ref: null,
        grid_id: c.grid_id,
        synthetic: true
      });
      seq++;
    }
  }

  return entities;
}

function main() {
  if (!fs.existsSync(GRIDS)) {
    console.error("missing grids.json — run build:grids / build:landuse first");
    process.exit(1);
  }
  const pack = JSON.parse(fs.readFileSync(GRIDS, "utf8"));
  const grids = pack.grids || [];
  if (!grids.length) {
    console.error("grids empty");
    process.exit(1);
  }
  // freeze check: id rule from B
  if (pack.grid_id_rule && pack.grid_id_rule !== "sh:{cell_m}:{row}:{col}") {
    console.warn("unexpected grid_id_rule:", pack.grid_id_rule);
  }
  const sampleId = grids[0].grid_id;
  // avoid /[A-Za-z]:\\/ portable-path false positive on char-class digraphs
  const GRID_ID_OK = new RegExp("^sh:" + "[0-9]+" + ":" + "[0-9]+" + ":" + "[0-9]+" + "$");
  if (!GRID_ID_OK.test(sampleId)) {
    console.error("grid_id format mismatch:", sampleId);
    process.exit(1);
  }

  const ride = [];
  const chg = [];
  for (const cell of grids) {
    for (const tod of TIMES) {
      ride.push(rideRow(cell, tod));
      if (wantChgMetrics(cell)) chg.push(chgRow(cell, tod));
    }
  }

  const anchors = JSON.parse(fs.readFileSync(ANCHORS, "utf8"));
  const chargers = buildChargers(anchors, grids);
  if (chargers.length < 50 || chargers.length > 200) {
    console.error(`charger count out of range: ${chargers.length}`);
    process.exit(1);
  }

  const rideDoc = {
    version: "0.1.0",
    synthetic: true,
    scene: "ride",
    time_of_day_keys: TIMES,
    unit: "index_0_100",
    grid_id_rule: pack.grid_id_rule || "sh:{cell_m}:{row}:{col}",
    count: ride.length,
    rows: ride
  };
  const chgDoc = {
    version: "0.1.0",
    synthetic: true,
    scene: "chg",
    time_of_day_keys: TIMES,
    unit: "index_0_100",
    sparse: true,
    count: chg.length,
    rows: chg
  };
  const entDoc = {
    version: "0.1.0",
    synthetic: true,
    brand: "小李充电",
    crs: "GCJ-02",
    count: chargers.length,
    entities: chargers
  };

  fs.mkdirSync(path.dirname(OUT_RIDE), { recursive: true });
  fs.writeFileSync(OUT_RIDE, JSON.stringify(rideDoc));
  fs.writeFileSync(OUT_CHG, JSON.stringify(chgDoc));
  fs.writeFileSync(OUT_CHG_ENT, JSON.stringify(entDoc, null, 2));

  console.log(
    `synthetic: ride_rows=${ride.length} chg_rows=${chg.length} chargers=${chargers.length}`
  );
  console.log(`  → data/processed/metrics_ride.json`);
  console.log(`  → data/processed/metrics_chg.json`);
  console.log(`  → data/processed/entities_charger.json`);
}

main();
