(function (global) {
  "use strict";

  const FORMULA_RIDE =
    "gap = demand - supply\n" +
    "demand = demand_base × weather.demand_ride × node\n" +
    "supply = supply_base × weather.supply_ride × node / difficulty_ride\n" +
    "(scene=ride · zone unit · Synthetic)";

  const FORMULA_GENERIC =
    "gap = demand - supply (scene-specific coeffs)\n" +
    "supply path ÷ congestion.difficulty_*\n" +
    "Synthetic · zone-primary";

  function sceneKey(scene) {
    if (scene === "chg" || scene === "energy") return "chg";
    if (scene === "delivery" || scene === "fulfillment") return "delivery";
    if (scene === "o2o" || scene === "o2o_store") return "o2o";
    return "ride";
  }

  function weatherMul(weatherDoc, weather, scene) {
    const wKey = weather || "clear";
    const sc = sceneKey(scene);
    const w =
      (weatherDoc && weatherDoc.coeffs && weatherDoc.coeffs[wKey]) ||
      (weatherDoc && weatherDoc.coeffs && weatherDoc.coeffs.clear) ||
      {};
    let d = w["demand_" + sc];
    let s = w["supply_" + sc];
    if (d == null && sc === "delivery") d = w.demand_ride;
    if (s == null && sc === "delivery") s = w.supply_ride;
    if (d == null && sc === "o2o") d = w.demand_ride != null ? w.demand_ride : 1;
    if (s == null && sc === "o2o") s = w.supply_ride != null ? w.supply_ride : 1;
    if (d == null) d = 1;
    if (s == null) s = 1;
    return { demand: Number(d), supply: Number(s), weather: wKey, scene: sc };
  }

  function nodeMul(calendarDoc, nodeKey, scene) {
    const nKey = nodeKey || "baseline";
    const node =
      (calendarDoc && calendarDoc.nodes && calendarDoc.nodes[nKey]) ||
      (calendarDoc && calendarDoc.nodes && calendarDoc.nodes.baseline) ||
      {};
    const sc = sceneKey(scene);
    let m = node["node_coeff_" + sc];
    if (m == null) m = node.node_coeff_ride;
    if (m == null) m = 1;
    return Number(m);
  }

  function difficultyBundle(congDoc, weather, tod, scene) {
    const w = weather || "clear";
    const t = tod || "wd_pm_peak";
    const sc = sceneKey(scene);
    const city =
      (congDoc &&
        congDoc.scopes &&
        congDoc.scopes.citywide &&
        congDoc.scopes.citywide[w] &&
        congDoc.scopes.citywide[w][t]) ||
      {};
    let diff = 1;
    if (sc === "ride") diff = city.difficulty_ride != null ? city.difficulty_ride : 1;
    else if (sc === "delivery")
      diff = city.difficulty_delivery != null ? city.difficulty_delivery : 1;
    else if (sc === "o2o")
      diff = city.difficulty_o2o != null ? city.difficulty_o2o : 1;
    else if (sc === "chg") diff = 1.05;
    return {
      congestion_index: city.congestion_index != null ? city.congestion_index : 0.5,
      difficulty: Number(diff) || 1,
      scene: sc
    };
  }

  function corridorExtra(congDoc, labels, scene) {
    if (!congDoc || !congDoc.scopes || !labels || !labels.length) return 1;
    const sc = sceneKey(scene);
    let extra = 1;
    const keys = Object.keys(congDoc.scopes);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k === "citywide") continue;
      const scope = congDoc.scopes[k];
      const labs = scope.labels || [];
      let hit = false;
      for (let j = 0; j < labs.length; j++) {
        if (labels.indexOf(labs[j]) >= 0) {
          hit = true;
          break;
        }
      }
      if (!hit) continue;
      const field =
        sc === "delivery"
          ? "extra_difficulty_delivery"
          : "extra_difficulty_ride";
      if (scope[field] != null) extra *= Number(scope[field]);
    }
    return extra;
  }

  function applyRow(row, opts) {
    const o = opts || {};
    if (!row) return null;
    if (row.demand_base == null) {
      return {
        ok: false,
        error: "missing demand_base",
        demand: null,
        supply: null,
        gap: null
      };
    }
    if (row.supply_base == null && o.requireSupply !== false) {
      return {
        ok: false,
        error: "missing supply_base — gap disabled",
        demand: null,
        supply: null,
        gap: null
      };
    }
    const wm = weatherMul(o.weatherDoc, o.weather, o.scene || row.scene);
    const nm = nodeMul(o.calendarDoc, o.nodeKey, o.scene || row.scene);
    const diffBase = difficultyBundle(
      o.congDoc,
      o.weather,
      o.time_of_day || row.time_of_day,
      o.scene || row.scene
    );
    const labels = o.labels || row.labels || [];
    const diff =
      diffBase.difficulty *
      corridorExtra(o.congDoc, labels, o.scene || row.scene);
    const demand = row.demand_base * wm.demand * nm;
    let supply = null;
    let gap = null;
    if (row.supply_base != null) {
      supply = (row.supply_base * wm.supply * nm) / (diff || 1);
      gap = demand - supply;
    }
    return {
      ok: true,
      error: null,
      demand: demand,
      supply: supply,
      gap: gap,
      demand_base: row.demand_base,
      supply_base: row.supply_base,
      zone_id: row.zone_id || row.grid_id,
      grid_id: row.grid_id || row.zone_id,
      scene: row.scene,
      time_of_day: row.time_of_day,
      zone_type: row.zone_type,
      grade: row.grade,
      difficulty: diff,
      congestion_index: diffBase.congestion_index
    };
  }

  function indexZoneRows(rows, timeOfDay, scene) {
    const map = new Map();
    if (!rows) return map;
    const tod = timeOfDay || "wd_pm_peak";
    const sc = sceneKey(scene);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.time_of_day === tod && sceneKey(r.scene) === sc) {
        map.set(r.zone_id || r.grid_id, r);
      }
    }
    return map;
  }

  function actionFor(computed) {
    if (!computed || !computed.ok || computed.gap == null) return "monitor";
    const g = computed.gap;
    const d = computed.demand;
    const s = computed.supply;
    if (g >= 25 && s != null && s < d * 0.75) return "shift_fleet";
    if (g >= 15 && d >= 50) return "shift_fleet";
    if (g >= 10 && d < 40) return "stimulate_demand";
    if (g < -10) return "rebalance";
    if (g >= 5) return "shift_fleet";
    return "monitor";
  }

  function topShortage(list, n) {
    const lim = n || 15;
    return list
      .filter(function (x) {
        return x && x.ok && x.gap != null && x.gap > 0;
      })
      .sort(function (a, b) {
        return b.gap - a.gap;
      })
      .slice(0, lim)
      .map(function (x) {
        return Object.assign({}, x, { action: actionFor(x) });
      });
  }

  /** Per-way synthetic congestion 0–1 from class × city index × hash */
  function wayCongestion(props, cityIndex, weather, tod) {
    const hw = (props && props.highway) || "tertiary";
    const base = cityIndex != null ? cityIndex : 0.5;
    let classBias = 0.1;
    if (/motorway|trunk/.test(hw)) classBias = 0.22;
    else if (/primary/.test(hw)) classBias = 0.18;
    else if (/secondary/.test(hw)) classBias = 0.12;
    else if (/tertiary/.test(hw)) classBias = 0.08;
    const id = String((props && (props.osm_id || props.name)) || hw);
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
    const jitter = (h / 1000) * 0.25 - 0.08;
    let rainBoost = weather === "rain" ? 0.12 : weather === "extreme" ? 0.2 : 0;
    let peakBoost = /peak/.test(tod || "") ? 0.08 : 0;
    // Cross-river / bridge name hints
    const name = ((props && props.name) || "") + "";
    if (/桥|隧道|过江|越江|长江|黄浦/.test(name)) {
      rainBoost += 0.06;
      peakBoost += 0.05;
    }
    if (/临港|两港|东海/.test(name)) peakBoost += 0.04;
    return Math.max(0, Math.min(1, base * 0.75 + classBias + jitter + rainBoost + peakBoost));
  }

  function congColor(v) {
    if (v < 0.4) return "#3dd68c";
    if (v < 0.65) return "#e6c07b";
    return "#f07178";
  }

  function gradeColor(hw) {
    const h = hw || "";
    if (/motorway/.test(h)) return "#38bdf8";
    if (/trunk/.test(h)) return "#22d3ee";
    if (/primary/.test(h)) return "#60a5fa";
    if (/secondary/.test(h)) return "#94a3b8";
    if (/tertiary/.test(h)) return "#64748b";
    return "#475569";
  }

  function gradeWeight(hw, zoom) {
    const h = hw || "";
    const z = zoom || 12;
    if (/motorway/.test(h)) return z >= 13 ? 4.2 : 3.4;
    if (/trunk/.test(h)) return z >= 13 ? 3.6 : 2.8;
    if (/primary/.test(h)) return z >= 13 ? 3 : 2.3;
    if (/secondary/.test(h)) return z >= 13 ? 2.2 : 1.7;
    if (/tertiary/.test(h)) return z >= 14 ? 1.6 : 1.2;
    return 1;
  }

  function bizColor(cong, difficulty) {
    const v = Math.min(1, cong * 0.7 + ((difficulty || 1) - 1) * 0.8);
    if (v < 0.35) return "#3dd68c";
    if (v < 0.55) return "#e6c07b";
    if (v < 0.75) return "#fb923c";
    return "#f07178";
  }

  function heatFill(value, min, max) {
    const lo = min == null ? 0 : min;
    const hi = max == null ? 80 : max;
    const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo || 1)));
    // cool blue -> hot red
    const r = Math.round(30 + t * 210);
    const g = Math.round(80 + (1 - t) * 40);
    const b = Math.round(180 - t * 120);
    return "rgba(" + r + "," + g + "," + b + ",0.45)";
  }

  function roadImpactCopy(cong, gradeLabel, difficulty, pack) {
    const band = cong < 0.4 ? "畅通" : cong < 0.65 ? "缓行" : "拥堵";
    const packZh =
      pack === "ride"
        ? "出行"
        : pack === "fulfillment"
          ? "履约"
          : pack === "energy"
            ? "补能到达"
            : pack === "o2o"
              ? "到店客流/到店"
              : "业务";
    if (band === "畅通") {
      return (
        "当前整段「" +
        band +
        "」。" +
        packZh +
        "匹配阻力较低（难度系数 ×" +
        difficulty.toFixed(2) +
        "）。可作对照基线；切换雨天/高峰看抬升。"
      );
    }
    if (band === "缓行") {
      return (
        "整段「" +
        band +
        "」（" +
        gradeLabel +
        "）。有效运力/时效被路况打折：出行等待抬升、履约 ETA 风险上升（×" +
        difficulty.toFixed(2) +
        "）。宜结合相邻区缺口做 shift_fleet / 时效圈收缩叙事。"
      );
    }
    return (
      "整段「" +
      band +
      "」抬高" +
      packZh +
      "难度（×" +
      difficulty.toFixed(2) +
      "）。账上有车/有骑手不等于匹配得上——过江与高峰叠加时更明显。右侧列表应对齐缺口 TopN，而非只看订单热力。"
    );
  }

  function lodFromZoom(z) {
    if (z <= 11) return "city";
    if (z <= 13) return "district";
    return "block";
  }

  function roadClassVisible(hw, lod) {
    const h = hw || "";
    if (lod === "city") {
      return /motorway|trunk|primary/.test(h);
    }
    if (lod === "district") {
      return /motorway|trunk|primary|secondary|tertiary/.test(h);
    }
    return true;
  }

  global.LBSMetrics = {
    FORMULA_RIDE: FORMULA_RIDE,
    FORMULA_GENERIC: FORMULA_GENERIC,
    sceneKey: sceneKey,
    applyRow: applyRow,
    indexZoneRows: indexZoneRows,
    actionFor: actionFor,
    topShortage: topShortage,
    difficultyBundle: difficultyBundle,
    wayCongestion: wayCongestion,
    congColor: congColor,
    gradeColor: gradeColor,
    gradeWeight: gradeWeight,
    bizColor: bizColor,
    heatFill: heatFill,
    roadImpactCopy: roadImpactCopy,
    lodFromZoom: lodFromZoom,
    roadClassVisible: roadClassVisible
  };
})(typeof window !== "undefined" ? window : globalThis);
