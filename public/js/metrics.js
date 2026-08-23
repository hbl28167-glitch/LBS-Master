(function (global) {
  "use strict";

  const FORMULA_RIDE =
    "gap = demand - supply\n" +
    "demand = demand_base × weather.demand_ride × node_coeff\n" +
    "supply = supply_base × weather.supply_ride × node_coeff\n" +
    "(scene=ride · norm=identity · Synthetic)";

  function coeffsFor(weatherDoc, calendarDoc, weather, nodeKey, scene) {
    const wKey = weather || "clear";
    const nKey = nodeKey || "baseline";
    const w =
      (weatherDoc && weatherDoc.coeffs && weatherDoc.coeffs[wKey]) ||
      (weatherDoc && weatherDoc.coeffs && weatherDoc.coeffs.clear) ||
      {};
    const node =
      (calendarDoc && calendarDoc.nodes && calendarDoc.nodes[nKey]) ||
      (calendarDoc && calendarDoc.nodes && calendarDoc.nodes.baseline) ||
      {};
    const sc = scene === "chg" ? "chg" : "ride";
    const dMul = w["demand_" + sc];
    const sMul = w["supply_" + sc];
    const nMul = node["node_coeff_" + sc];
    if (dMul == null || sMul == null) {
      return {
        ok: false,
        error: "missing weather coefficients for " + wKey + "/" + sc,
        demandMul: null,
        supplyMul: null,
        nodeMul: null
      };
    }
    return {
      ok: true,
      error: null,
      demandMul: Number(dMul),
      supplyMul: Number(sMul),
      nodeMul: nMul == null ? 1 : Number(nMul),
      weather: wKey,
      node: nKey,
      scene: sc
    };
  }

  function applyRow(row, c) {
    if (!row) return null;
    if (row.supply_base == null || row.demand_base == null) {
      return {
        ok: false,
        error: "row missing demand_base or supply_base — gap disabled",
        demand: null,
        supply: null,
        gap: null
      };
    }
    if (!c || !c.ok) {
      return {
        ok: false,
        error: (c && c.error) || "coefficients unavailable — gap disabled",
        demand: null,
        supply: null,
        gap: null
      };
    }
    const demand = row.demand_base * c.demandMul * c.nodeMul;
    const supply = row.supply_base * c.supplyMul * c.nodeMul;
    return {
      ok: true,
      error: null,
      demand: demand,
      supply: supply,
      gap: demand - supply,
      demand_base: row.demand_base,
      supply_base: row.supply_base,
      grid_id: row.grid_id,
      scene: row.scene,
      time_of_day: row.time_of_day
    };
  }

  /** Build Map grid_id -> row for a TOD slice. */
  function indexByGrid(rows, timeOfDay, scene) {
    const map = new Map();
    if (!rows) return map;
    const tod = timeOfDay || "wd_pm_peak";
    const sc = scene || "ride";
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.time_of_day === tod && r.scene === sc) {
        map.set(r.grid_id, r);
      }
    }
    return map;
  }

  function actionFor(computed) {
    if (!computed || !computed.ok) return "monitor";
    const g = computed.gap;
    const d = computed.demand;
    const s = computed.supply;
    if (g >= 25 && s < d * 0.75) return "shift_fleet";
    if (g >= 15 && d >= 50) return "shift_fleet";
    if (g >= 10 && d < 40) return "stimulate_demand";
    if (g < -10) return "rebalance";
    if (g >= 5) return "shift_fleet";
    return "monitor";
  }

  function topShortage(computedList, n) {
    const lim = n || 15;
    return computedList
      .filter(function (x) {
        return x && x.ok && x.gap > 0;
      })
      .sort(function (a, b) {
        return b.gap - a.gap;
      })
      .slice(0, lim)
      .map(function (x) {
        return Object.assign({}, x, { action: actionFor(x) });
      });
  }

  function colorForMetric(value, metric, min, max) {
    if (value == null || isNaN(value)) return "#334155";
    const lo = min == null ? 0 : min;
    const hi = max == null ? 100 : max;
    const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo || 1)));
    if (metric === "supply") {
      return lerpColor([30, 64, 175], [52, 211, 153], t);
    }
    if (metric === "demand") {
      return lerpColor([55, 48, 163], [251, 146, 60], t);
    }
    // gap: blue (surplus) -> neutral -> red (shortage)
    if (value < 0) {
      const tn = Math.max(0, Math.min(1, (-value) / 40));
      return lerpColor([51, 65, 85], [56, 189, 248], tn);
    }
    return lerpColor([51, 65, 85], [239, 68, 68], t);
  }

  function lerpColor(a, b, t) {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return "rgb(" + r + "," + g + "," + bl + ")";
  }

  global.LBSMetrics = {
    FORMULA_RIDE: FORMULA_RIDE,
    coeffsFor: coeffsFor,
    applyRow: applyRow,
    indexByGrid: indexByGrid,
    actionFor: actionFor,
    topShortage: topShortage,
    colorForMetric: colorForMetric
  };
})(typeof window !== "undefined" ? window : globalThis);
