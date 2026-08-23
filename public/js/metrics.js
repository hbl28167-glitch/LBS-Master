(function (global) {
  "use strict";

  const FORMULA_RIDE =
    "gap = demand - supply\n" +
    "demand = demand_base × weather.demand_ride × node_coeff\n" +
    "supply = supply_base × weather.supply_ride × node_coeff\n" +
    "(scene=ride · norm=identity · Synthetic)";

  const FORMULA_CHG =
    "gap = demand - supply\n" +
    "demand = demand_base × weather.demand_chg × node_coeff_chg\n" +
    "supply = supply_base × weather.supply_chg × node_coeff_chg\n" +
    "(scene=chg · 小李充电 · Synthetic · 非 ML)";

  /** S5 default weights — explainable, not ML */
  const SITING_WEIGHTS = {
    demand: 0.35,
    supply_gap: 0.25,
    competition: 0.2,
    access: 0.1,
    anti_cannibal: 0.1
  };
  const SITING_R_M = 1500;

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

  function parseGridId(id) {
    const p = String(id || "").split(":");
    if (p.length < 4) return null;
    return {
      prefix: p[0],
      cell_m: Number(p[1]),
      row: Number(p[2]),
      col: Number(p[3])
    };
  }

  function gridIdAt(parts, dRow, dCol) {
    if (!parts) return null;
    return (
      parts.prefix +
      ":" +
      parts.cell_m +
      ":" +
      (parts.row + dRow) +
      ":" +
      (parts.col + dCol)
    );
  }

  /** Neighbor cells within ~R (default 1.5km ≈ ±1 cell @ 1000m). */
  function neighborGridIds(gridId, rM) {
    const parts = parseGridId(gridId);
    if (!parts) return [];
    const cell = parts.cell_m || 1000;
    const R = rM == null ? SITING_R_M : rM;
    const steps = Math.max(1, Math.round(R / cell));
    const out = [];
    for (let dr = -steps; dr <= steps; dr++) {
      for (let dc = -steps; dc <= steps; dc++) {
        out.push(gridIdAt(parts, dr, dc));
      }
    }
    return out;
  }

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

  function clamp01(x) {
    return Math.max(0, Math.min(100, x));
  }

  /**
   * Buffer metrics + explainable score for one candidate near a gap cell.
   * opts: { gridById, computedById, chargers, rM }
   */
  function scoreCandidate(cand, gapGridId, opts) {
    const o = opts || {};
    const rM = o.rM != null ? o.rM : SITING_R_M;
    const w = Object.assign({}, SITING_WEIGHTS, o.weights || {});
    const gridById = o.gridById || new Map();
    const computedById = o.computedById || new Map();
    const chargers = o.chargers || [];
    const neigh = neighborGridIds(gapGridId, rM);
    let demandSum = 0;
    let gapSum = 0;
    let n = 0;
    neigh.forEach(function (gid) {
      const m = computedById.get(gid);
      if (!m || !m.ok) return;
      demandSum += m.demand;
      gapSum += Math.max(0, m.gap);
      n += 1;
    });
    const demandScore = clamp01(n ? demandSum / n : 0);
    const gapScore = clamp01(n ? gapSum / n : 0);

    let selfCnt = 0;
    let nearestSelf = Infinity;
    let compCnt = 0;
    chargers.forEach(function (e) {
      if (e.lng == null || e.lat == null) return;
      const d = haversineM(cand.lat, cand.lng, e.lat, e.lng);
      if (d > rM) return;
      const brand = String(e.brand || "");
      if (brand.indexOf("小李") >= 0) {
        selfCnt += 1;
        if (d < nearestSelf) nearestSelf = d;
      } else {
        compCnt += 1;
      }
    });
    if (!isFinite(nearestSelf)) nearestSelf = rM + 500;

    // competition: moderate density good; empty or overcrowded worse
    let competition = 55;
    if (compCnt === 0) competition = 40;
    else if (compCnt <= 2) competition = 78;
    else if (compCnt <= 5) competition = 60;
    else competition = 35;
    competition = clamp01(competition);

    // access: prefer cells with road-ish landuse / hub labels
    const g = gridById.get(cand.grid_id) || gridById.get(gapGridId) || {};
    const labels = g.labels || [];
    let access = 50;
    if (labels.indexOf("hub") >= 0 || labels.indexOf("metro") >= 0) access += 25;
    if (g.landuse === "retail" || g.landuse === "office") access += 15;
    if (g.landuse === "industrial") access -= 10;
    access = clamp01(access);

    // cannibal: closer self → higher penalty
    let cannibalPenalty = 0;
    if (selfCnt === 0) cannibalPenalty = 5;
    else if (nearestSelf < 400) cannibalPenalty = 85;
    else if (nearestSelf < 800) cannibalPenalty = 55;
    else if (nearestSelf < 1200) cannibalPenalty = 30;
    else cannibalPenalty = 12;
    cannibalPenalty = clamp01(cannibalPenalty + selfCnt * 5);

    const total =
      w.demand * demandScore +
      w.supply_gap * gapScore +
      w.competition * competition +
      w.access * access +
      w.anti_cannibal * (100 - cannibalPenalty);

    const subs = {
      demand: round1(demandScore),
      supply_gap: round1(gapScore),
      competition: round1(competition),
      access: round1(access),
      anti_cannibal: round1(100 - cannibalPenalty)
    };

    const reason = buildSitingReason(cand, subs, {
      selfCnt: selfCnt,
      nearestSelf: nearestSelf,
      compCnt: compCnt,
      gapScore: gapScore
    });

    return {
      cand_id: cand.cand_id,
      label: cand.label || cand.cand_id,
      lng: cand.lng,
      lat: cand.lat,
      grid_id: cand.grid_id || gapGridId,
      R_m: rM,
      weights: w,
      total: round1(total),
      subscores: subs,
      buffer: {
        neigh_n: n,
        demand_avg: round1(demandScore),
        gap_avg: round1(gapScore),
        self_cnt: selfCnt,
        comp_cnt: compCnt,
        nearest_self_m: Math.round(nearestSelf)
      },
      reason_text: reason
    };
  }

  function buildSitingReason(cand, subs, ctx) {
    const name = cand.label || "候选";
    const parts = [];
    if (subs.supply_gap >= 55) parts.push("环内补能缺口仍高");
    else parts.push("环内缺口中等");
    if (ctx.selfCnt === 0) parts.push("近距无小李站、蚕食低");
    else if (ctx.nearestSelf > 900) parts.push("距已有小李站较远、蚕食可控");
    else parts.push("距已有小李站偏近、蚕食偏高");
    if (ctx.compCnt >= 1 && ctx.compCnt <= 3) parts.push("竞品密度适中可验证需求");
    else if (ctx.compCnt === 0) parts.push("竞品空白需场勘验证真需求");
    else parts.push("竞品偏密、获客难度上升");
    if (subs.access >= 65) parts.push("枢纽/商服用地可达较好");
    return (
      name +
      "：" +
      parts.join("；") +
      "。权重可解释（非 ML），雨天/单日脉冲不作定址主依据。"
    );
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  /**
   * Build two candidates around a gap cell: A = cell center, B = neighbor offset.
   */
  function buildDefaultCandidates(gapGridId, gridById) {
    const g = gridById.get(gapGridId);
    if (!g || g.cell_lat == null) return [];
    const parts = parseGridId(gapGridId);
    const cell = (parts && parts.cell_m) || 1000;
    const dLat = cell / 111320;
    const dLng = cell / (111320 * Math.cos((g.cell_lat * Math.PI) / 180));

    // B: prefer neighbor with higher gap if available via optional hook; default NE offset
    let bGrid = g;
    let bId = gapGridId;
    const tryIds = [
      gridIdAt(parts, 0, 1),
      gridIdAt(parts, 1, 0),
      gridIdAt(parts, -1, 0),
      gridIdAt(parts, 0, -1),
      gridIdAt(parts, 1, 1)
    ];
    for (let i = 0; i < tryIds.length; i++) {
      const ng = gridById.get(tryIds[i]);
      if (ng && ng.is_valid !== false && ng.cell_lat != null) {
        bGrid = ng;
        bId = tryIds[i];
        break;
      }
    }

    return [
      {
        cand_id: "A",
        label: "候选 A · 缺口格心",
        lng: g.cell_lng,
        lat: g.cell_lat,
        grid_id: gapGridId
      },
      {
        cand_id: "B",
        label: "候选 B · 邻格偏移",
        lng: bGrid.cell_lng + dLng * 0.15,
        lat: bGrid.cell_lat + dLat * 0.1,
        grid_id: bId
      }
    ];
  }

  function compareSiting(results) {
    if (!results || !results.length) return null;
    const sorted = results.slice().sort(function (a, b) {
      return b.total - a.total;
    });
    const win = sorted[0];
    const lose = sorted[1];
    let oneLiner =
      "推荐 " +
      win.cand_id +
      "（" +
      win.total.toFixed(1) +
      "）";
    if (lose) {
      const dGap = win.subscores.supply_gap - lose.subscores.supply_gap;
      const dCan =
        win.subscores.anti_cannibal - lose.subscores.anti_cannibal;
      const drivers = [];
      if (Math.abs(dCan) >= Math.abs(dGap) && Math.abs(dCan) >= 3) {
        drivers.push(dCan > 0 ? "更低蚕食" : "蚕食更高");
      }
      if (Math.abs(dGap) >= 3) {
        drivers.push(dGap > 0 ? "覆盖更高缺口" : "缺口覆盖略弱");
      }
      if (!drivers.length) drivers.push("综合分项更均衡");
      oneLiner +=
        " 优于 " +
        lose.cand_id +
        "（" +
        lose.total.toFixed(1) +
        "）：" +
        drivers.join("、") +
        "。";
    } else {
      oneLiner += "。";
    }
    return { winner: win.cand_id, ranking: sorted, one_liner: oneLiner };
  }

  /**
   * Rule-mock quality issues on chargers (主数据 / 入口 / 路网距).
   * Does NOT include device GPS drift.
   */
  function mockQualityIssues(chargers, gridsDoc) {
    const list = chargers || [];
    const grids = (gridsDoc && gridsDoc.grids) || [];
    const issues = [];
    const codes = [
      {
        code: "ENTRY_MISSING",
        severity: "P0",
        title: "入口点缺失",
        detail: "主数据无标准入口坐标，导航到路口后难进站"
      },
      {
        code: "ROAD_TOO_FAR",
        severity: "P1",
        title: "距路网过远",
        detail: "站心相对干道代理偏远，到达体验差"
      },
      {
        code: "NAME_ALIAS",
        severity: "P1",
        title: "命名别名不一致",
        detail: "展示名与主数据别名未对齐（合成规则）"
      },
      {
        code: "STALL_META",
        severity: "P0",
        title: "桩位元数据未就绪",
        detail: "stalls/power 主数据字段待核验"
      }
    ];

    // pick a stable subset by entity index
    list.forEach(function (e, idx) {
      if (idx % 7 !== 0 && idx % 11 !== 0) return;
      const rule = codes[idx % codes.length];
      const display =
        "小李充电·" +
        (e.anchor_ref ? String(e.anchor_ref) : "片区") +
        "站";
      issues.push({
        issue_id: "iss_" + e.entity_id + "_" + rule.code,
        entity_id: e.entity_id,
        object: "charger",
        display_name: display,
        brand: "小李充电",
        code: rule.code,
        severity: rule.severity,
        title: rule.title,
        detail: rule.detail,
        lng: e.lng,
        lat: e.lat,
        // explicit boundary
        out_of_scope: "device_gps_drift",
        legend_group: "数据质量"
      });
    });

    // ensure at least a few if list short
    if (!issues.length && list.length) {
      const e = list[0];
      issues.push({
        issue_id: "iss_demo_entry",
        entity_id: e.entity_id,
        object: "charger",
        display_name: "小李充电·示范站",
        brand: "小李充电",
        code: "ENTRY_MISSING",
        severity: "P0",
        title: "入口点缺失",
        detail: "主数据无标准入口坐标",
        lng: e.lng,
        lat: e.lat,
        out_of_scope: "device_gps_drift",
        legend_group: "数据质量"
      });
    }

    issues.sort(function (a, b) {
      if (a.severity === b.severity) return a.code.localeCompare(b.code);
      return a.severity === "P0" ? -1 : 1;
    });
    return issues;
  }

  function colorForQuality(severity) {
    if (severity === "P0") return "#a855f7";
    if (severity === "P1") return "#f59e0b";
    return "#94a3b8";
  }

  global.LBSMetrics = {
    FORMULA_RIDE: FORMULA_RIDE,
    FORMULA_CHG: FORMULA_CHG,
    SITING_WEIGHTS: SITING_WEIGHTS,
    SITING_R_M: SITING_R_M,
    coeffsFor: coeffsFor,
    applyRow: applyRow,
    indexByGrid: indexByGrid,
    actionFor: actionFor,
    topShortage: topShortage,
    colorForMetric: colorForMetric,
    parseGridId: parseGridId,
    neighborGridIds: neighborGridIds,
    scoreCandidate: scoreCandidate,
    buildDefaultCandidates: buildDefaultCandidates,
    compareSiting: compareSiting,
    mockQualityIssues: mockQualityIssues,
    colorForQuality: colorForQuality,
    haversineM: haversineM
  };
})(typeof window !== "undefined" ? window : globalThis);
