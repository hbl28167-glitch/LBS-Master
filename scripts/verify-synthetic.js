/**
 * Gate C (05.1): zone metrics + dense entities + rain gap + congestion interface.
 *
 * Usage: node scripts/verify-synthetic.js [zone_id]
 */
const fs = require("fs");
const { root } = require("./lib/paths");

const ZONES = root("data", "processed", "zones_shanghai.json");
const RIDE = root("data", "processed", "metrics_ride.json");
const DEL = root("data", "processed", "metrics_delivery.json");
const CHG = root("data", "processed", "metrics_chg.json");
const O2O = root("data", "processed", "metrics_o2o.json");
const ZONE_M = root("data", "processed", "metrics_zone.json");
const HEAT = root("data", "processed", "metrics_heat_fine.json");
const ENT = root("data", "processed", "entities_charger.json");
const STORE = root("data", "processed", "entities_store.json");
const WEATHER = root("data", "static", "weather_coeff.json");
const CAL = root("data", "static", "calendar.json");
const CONG = root("data", "static", "congestion_coeff.json");

const NEED_TOD = ["wd_pm_peak", "wd_am_peak", "we_aft"];
const SCENES = ["ride", "delivery", "chg", "o2o"];

function load(p) {
  if (!fs.existsSync(p)) {
    console.error("missing", p);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * Runtime apply with congestion difficulty (identity norm on bases).
 * supply effective /= difficulty; gap = demand - supply_eff
 */
function applyRuntime(row, weatherKey, nodeKey, tod, weather, calendar, cong) {
  const scene = row.scene;
  const w = weather.coeffs[weatherKey];
  const node = calendar.nodes[nodeKey] || calendar.nodes.baseline;
  const dKey = `demand_${scene}`;
  const sKey = `supply_${scene}`;
  const nKey = `node_coeff_${scene}`;
  const node_coeff = node[nKey] != null ? node[nKey] : node.node_coeff_ride || 1;
  const dMul = w[dKey] != null ? w[dKey] : 1;
  const sMul = w[sKey] != null ? w[sKey] : 1;
  const city = cong.scopes.citywide[weatherKey][tod] ||
    cong.scopes.citywide[weatherKey].wd_pm_peak;
  const diffKey =
    scene === "delivery"
      ? "difficulty_delivery"
      : scene === "o2o"
        ? "difficulty_o2o"
        : "difficulty_ride";
  let difficulty = city[diffKey] != null ? city[diffKey] : 1;
  // corridor extras from zone labels / id
  const labels = row._labels || [];
  const labset = new Set(labels);
  for (const [ck, cv] of Object.entries(cong.scopes)) {
    if (!ck.startsWith("corridor_") || !cv.labels) continue;
    if (cv.labels.some((l) => labset.has(l) || String(row.zone_id || "").includes(l))) {
      const ek =
        scene === "delivery"
          ? "extra_difficulty_delivery"
          : "extra_difficulty_ride";
      if (cv[ek]) difficulty *= cv[ek];
    }
  }
  const demand = row.demand_base * dMul * node_coeff;
  const supply = (row.supply_base * sMul * node_coeff) / difficulty;
  return { demand, supply, gap: demand - supply, difficulty };
}

function main() {
  const zones = load(ZONES);
  const ride = load(RIDE);
  const del = load(DEL);
  const chg = load(CHG);
  const o2o = load(O2O);
  const zoneM = load(ZONE_M);
  const ent = load(ENT);
  const store = load(STORE);
  const weather = load(WEATHER);
  const calendar = load(CAL);
  const cong = load(CONG);
  const heat = fs.existsSync(HEAT) ? JSON.parse(fs.readFileSync(HEAT, "utf8")) : null;

  const errors = [];
  const zlist = zones.zones || [];
  const zids = new Set(zlist.map((z) => z.zone_id));

  if (!ride.synthetic) errors.push("metrics_ride missing synthetic:true");
  if (ride.unit_kind_primary !== "zone") {
    errors.push("metrics_ride should be zone-primary (unit_kind_primary=zone)");
  }
  if (!weather.coeffs.rain || weather.coeffs.rain.demand_ride < 1.1) {
    errors.push("rain.demand_ride must be >= 1.1");
  }
  if (!weather.coeffs.rain || weather.coeffs.rain.supply_ride > 0.85) {
    errors.push("rain.supply_ride must be <= 0.85");
  }
  if (!calendar.nodes.baseline || !calendar.nodes.national_day) {
    errors.push("calendar needs baseline + national_day");
  }
  if (!cong.scopes || !cong.scopes.citywide) {
    errors.push("congestion_coeff missing citywide scopes");
  }
  for (const sc of SCENES) {
    const w = weather.coeffs.clear;
    if (w[`demand_${sc}`] == null || w[`supply_${sc}`] == null) {
      errors.push(`weather clear missing demand/supply for ${sc}`);
    }
  }

  const byKey = new Map();
  for (const r of ride.rows || []) {
    byKey.set(`${r.zone_id || r.grid_id}|${r.time_of_day}`, r);
  }
  let missing = 0;
  for (const z of zlist) {
    for (const t of NEED_TOD) {
      if (!byKey.has(`${z.zone_id}|${t}`)) missing++;
    }
  }
  if (missing > 0) errors.push(`metrics_ride missing ${missing} zone×tod rows`);

  if (!(del.rows && del.rows.length >= zlist.length * NEED_TOD.length)) {
    errors.push("metrics_delivery incomplete vs zones");
  }
  if (!(chg.rows && chg.rows.length > 0)) errors.push("metrics_chg empty");
  if (!(o2o.rows && o2o.rows.length > 0)) errors.push("metrics_o2o empty");
  if (!(zoneM.rows && zoneM.rows.length >= zlist.length * NEED_TOD.length * SCENES.length)) {
    errors.push("metrics_zone incomplete");
  }

  let demo =
    zlist.find((z) => z.zone_id.includes("lujiazui") && z.zone_type === "office") ||
    zlist.find((z) => z.zone_type === "office") ||
    zlist[0];
  const argId = process.argv[2];
  if (argId) {
    const hit = zlist.find((z) => z.zone_id === argId);
    if (hit) demo = hit;
    else if (byKey.has(`${argId}|wd_pm_peak`)) {
      demo = { zone_id: argId, labels: [], zone_type: "?" };
    } else errors.push(`zone not found: ${argId}`);
  }

  const tod = "wd_pm_peak";
  const base = byKey.get(`${demo.zone_id}|${tod}`);
  if (!base) {
    errors.push(`no ride metrics for demo ${demo.zone_id} ${tod}`);
  } else {
    base._labels = demo.labels || [];
    const clear = applyRuntime(
      base,
      "clear",
      "baseline",
      tod,
      weather,
      calendar,
      cong
    );
    const rain = applyRuntime(
      base,
      "rain",
      "baseline",
      tod,
      weather,
      calendar,
      cong
    );
    console.log("--- demo clear vs rain (zone ride + congestion) ---");
    console.log(
      JSON.stringify(
        {
          zone_id: demo.zone_id,
          zone_type: demo.zone_type,
          grade: demo.grade,
          time_of_day: tod,
          demand_base: base.demand_base,
          supply_base: base.supply_base,
          clear,
          rain,
          gap_delta_rain_minus_clear: rain.gap - clear.gap
        },
        null,
        2
      )
    );
    if (!(rain.gap > clear.gap)) {
      errors.push(
        `rain gap (${rain.gap}) should be worse (>) than clear (${clear.gap})`
      );
    }
  }

  const nChg = (ent.entities || []).length;
  const nStore = (store.entities || []).length;
  if (nChg < 800 || nChg > 1500) {
    errors.push(`chargers ${nChg} not in 800–1500`);
  }
  if (nStore < 1500 || nStore > 3000) {
    errors.push(`stores ${nStore} not in 1500–3000`);
  }

  const banned = /特来电|星星充电|国家电网|小桔|NIO|特斯拉超充|E\.?充电|Starbucks|麦当劳|肯德基/i;
  for (const e of [...(ent.entities || []), ...(store.entities || [])]) {
    const nm = `${e.name || ""} ${e.brand || ""}`;
    if (!nm.includes("小李")) errors.push(`non-小李 entity ${e.entity_id}`);
    if (banned.test(nm)) errors.push(`banned brand on ${e.entity_id}`);
  }

  if (heat) {
    if (!heat.count || heat.count < 1000) {
      errors.push("metrics_heat_fine too small or empty");
    }
  } else {
    console.warn("WARN: metrics_heat_fine missing (D may rasterize zones)");
  }

  // orphan zone_id in metrics
  for (const r of (ride.rows || []).slice(0, 5)) {
    if (r.zone_id && !zids.has(r.zone_id)) {
      errors.push(`ride row zone_id not in zones: ${r.zone_id}`);
    }
  }

  if (errors.length) {
    console.error("verify-synthetic: FAIL");
    for (const e of errors) console.error(" -", e);
    process.exit(1);
  }
  console.log(
    `verify-synthetic: OK zones=${zids.size} ride=${ride.count} delivery=${del.count} chg=${chg.count} o2o=${o2o.count} heat=${heat ? heat.count : 0} chargers=${nChg} stores=${nStore}`
  );
}

main();
