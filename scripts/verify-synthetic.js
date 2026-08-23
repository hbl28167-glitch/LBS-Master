/**
 * Gate C checks:
 * 1) metrics_ride covers grids × required TOD
 * 2) fixed grid: rain gap worse than clear (ride)
 * 3) charger names are 小李* only (no employer brands)
 * 4) optional: print clear vs rain for a demo grid
 *
 * Usage: node scripts/verify-synthetic.js [grid_id]
 */
const fs = require("fs");
const { root } = require("./lib/paths");

const GRIDS = root("data", "processed", "grids.json");
const RIDE = root("data", "processed", "metrics_ride.json");
const CHG = root("data", "processed", "metrics_chg.json");
const ENT = root("data", "processed", "entities_charger.json");
const WEATHER = root("data", "static", "weather_coeff.json");
const CAL = root("data", "static", "calendar.json");

const NEED_TOD = ["wd_pm_peak", "wd_am_peak", "we_aft"];

function load(p) {
  if (!fs.existsSync(p)) {
    console.error("missing", p);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * Identity norm on 0–100 indices (see contracts/scene-gap).
 * gap = demand - supply  (higher = worse shortage)
 */
function applyRuntime(row, weatherKey, nodeKey, weather, calendar) {
  const w = weather.coeffs[weatherKey];
  const node = calendar.nodes[nodeKey] || calendar.nodes.baseline;
  const scene = row.scene;
  const dKey = scene === "chg" ? "demand_chg" : "demand_ride";
  const sKey = scene === "chg" ? "supply_chg" : "supply_ride";
  const nKey = scene === "chg" ? "node_coeff_chg" : "node_coeff_ride";
  let node_coeff = node[nKey] != null ? node[nKey] : 1;
  // landuse bias only if caller passes landuse via row._landuse
  if (row._landuse && node.demand_bias && node.demand_bias[row._landuse] != null) {
    // bias applies to demand path only for narrative pulse
  }
  const demand = row.demand_base * w[dKey] * node_coeff;
  const supply = row.supply_base * w[sKey] * node_coeff;
  const gap = demand - supply;
  return { demand, supply, gap };
}

function main() {
  const grids = load(GRIDS);
  const ride = load(RIDE);
  const chg = load(CHG);
  const ent = load(ENT);
  const weather = load(WEATHER);
  const calendar = load(CAL);

  const errors = [];

  if (!ride.synthetic) errors.push("metrics_ride missing synthetic:true");
  if (!weather.coeffs.clear || !weather.coeffs.rain || !weather.coeffs.extreme) {
    errors.push("weather_coeff missing clear/rain/extreme");
  }
  if (weather.coeffs.rain.demand_ride < 1.1) {
    errors.push("rain.demand_ride must be >= 1.1");
  }
  if (weather.coeffs.rain.supply_ride > 0.85) {
    errors.push("rain.supply_ride must be <= 0.85");
  }
  if (!calendar.nodes.baseline || !calendar.nodes.national_day) {
    errors.push("calendar needs baseline + national_day");
  }

  const gridIds = new Set((grids.grids || []).map((g) => g.grid_id));
  const byKey = new Map();
  for (const r of ride.rows || []) {
    byKey.set(`${r.grid_id}|${r.time_of_day}`, r);
  }

  let missing = 0;
  const sampleGrids = grids.grids || [];
  // full cover check on all grids for required TOD (may be heavy but 17k*3 ok)
  for (const g of sampleGrids) {
    for (const t of NEED_TOD) {
      if (!byKey.has(`${g.grid_id}|${t}`)) missing++;
    }
  }
  if (missing > 0) errors.push(`metrics_ride missing ${missing} grid×tod rows`);

  // prefer office lujiazui for rain gap demo
  let demo =
    sampleGrids.find(
      (g) => g.landuse === "office" && (g.labels || []).includes("lujiazui")
    ) ||
    sampleGrids.find((g) => g.landuse === "office") ||
    sampleGrids.find((g) => g.is_valid !== false);

  const argId = process.argv[2];
  if (argId) {
    const hit = sampleGrids.find((g) => g.grid_id === argId);
    if (hit) demo = hit;
    else errors.push(`grid not found: ${argId}`);
  }

  const tod = "wd_pm_peak";
  const base = byKey.get(`${demo.grid_id}|${tod}`);
  if (!base) {
    errors.push(`no ride metrics for demo ${demo.grid_id} ${tod}`);
  } else {
    const clear = applyRuntime(base, "clear", "baseline", weather, calendar);
    const rain = applyRuntime(base, "rain", "baseline", weather, calendar);
    console.log("--- demo clear vs rain ---");
    console.log(
      JSON.stringify(
        {
          grid_id: demo.grid_id,
          landuse: demo.landuse,
          labels: demo.labels,
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

  // chargers
  const n = (ent.entities || []).length;
  if (n < 50 || n > 200) errors.push(`chargers count ${n} not in 50–200`);
  const badName = (ent.entities || []).filter(
    (e) => !String(e.name || "").startsWith("小李") && !String(e.brand || "").startsWith("小李")
  );
  if (badName.length) errors.push(`non-小李 charger names: ${badName.length}`);

  // banned employer-ish tokens (soft list)
  const banned = /特来电|星星充电|国家电网|小桔|NIO|特斯拉超充|E\.?充电/i;
  for (const e of ent.entities || []) {
    if (banned.test(e.name || "") || banned.test(e.brand || "")) {
      errors.push(`banned brand text on ${e.entity_id}`);
    }
  }

  if (!(chg.rows && chg.rows.length > 0)) {
    errors.push("metrics_chg empty");
  }

  if (errors.length) {
    console.error("verify-synthetic: FAIL");
    for (const e of errors) console.error(" -", e);
    process.exit(1);
  }
  console.log(
    `verify-synthetic: OK grids=${gridIds.size} ride=${ride.count} chg=${chg.count} chargers=${n}`
  );
}

main();
