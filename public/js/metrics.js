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

  const FORMULA_CHG =
    "gap = demand - supply (scene=chg)\n" +
    "demand/supply × weather_chg × node_chg\n" +
    "小李充电 · Synthetic · 非 ML";

  const FORMULA_DELIVERY =
    "gap = demand - supply (scene=delivery)\n" +
    "supply ÷ difficulty_delivery（拥堵抬难度、缩时效圈）\n" +
    "门店+需求热力+路网 · Synthetic";

  const FORMULA_O2O =
    "到店 demand（商圈面）· 单店聚焦覆盖/围栏\n" +
    "不千店同亮 · LOD + storeFocus · Synthetic";

  const SITING_WEIGHTS = {
    demand: 0.35,
    supply_gap: 0.25,
    competition: 0.2,
    access: 0.1,
    anti_cannibal: 0.1
  };
  const SITING_R_M = 1500;

  function round1(n) {
    return Math.round(n * 10) / 10;
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

  /** ETA ring radius m — shrinks when difficulty rises (fulfillment). */
  function etaRadiusM(baseM, difficulty) {
    const base = baseM != null ? baseM : 1800;
    const d = difficulty != null && difficulty > 0 ? difficulty : 1;
    return Math.max(400, Math.round(base / d));
  }

  /** O2O coverage radius by store type (m). */
  function storeCoverageM(store) {
    const t = (store && store.store_type) || "";
    if (/flagship|mall/.test(t)) return 1500;
    if (/community|neighborhood/.test(t)) return 800;
    return 1100;
  }

  /**
   * S5 score on zone centroids (explainable weights).
   * zoneList: computed zone metrics; chargers for cannibal.
   */
  function scoreSitingCandidates(zoneRow, zoneById, zoneList, chargers) {
    const zid = zoneRow.zone_id || zoneRow.grid_id;
    const z = zoneById.get(zid);
    if (!z || z.centroid_lat == null) return null;
    const byId = new Map();
    (zoneList || []).forEach(function (m) {
      if (m && m.zone_id) byId.set(m.zone_id, m);
    });
    const ch = chargers || [];

    function nearZones(lat, lng, rM) {
      const out = [];
      zoneById.forEach(function (zz, id) {
        if (zz.centroid_lat == null) return;
        const d = haversineM(lat, lng, zz.centroid_lat, zz.centroid_lng);
        if (d <= rM) out.push({ id: id, z: zz, d: d, m: byId.get(id) });
      });
      return out;
    }

    function scoreAt(cand) {
      const neigh = nearZones(cand.lat, cand.lng, SITING_R_M);
      let dSum = 0;
      let gSum = 0;
      let n = 0;
      neigh.forEach(function (x) {
        if (!x.m || !x.m.ok) return;
        dSum += x.m.demand || 0;
        gSum += Math.max(0, x.m.gap || 0);
        n += 1;
      });
      const demandScore = clamp01(n ? dSum / n : cand.seedDemand || 40);
      const gapScore = clamp01(n ? gSum / n : cand.seedGap || 20);

      let selfCnt = 0;
      let nearestSelf = Infinity;
      ch.forEach(function (e) {
        if (e.lat == null) return;
        const d = haversineM(cand.lat, cand.lng, e.lat, e.lng);
        if (d > SITING_R_M) return;
        if (String(e.brand || "").indexOf("小李") >= 0) {
          selfCnt += 1;
          if (d < nearestSelf) nearestSelf = d;
        }
      });
      if (!isFinite(nearestSelf)) nearestSelf = SITING_R_M + 400;

      let competition = selfCnt === 0 ? 42 : selfCnt <= 2 ? 72 : selfCnt <= 5 ? 55 : 32;
      let access = 48;
      if ((z.zone_type || "") === "retail" || (z.zone_type || "") === "office")
        access += 18;
      if ((z.labels || []).indexOf("hub") >= 0) access += 20;
      access = clamp01(access);

      let cannibal = 8;
      if (selfCnt === 0) cannibal = 6;
      else if (nearestSelf < 400) cannibal = 82;
      else if (nearestSelf < 900) cannibal = 48;
      else cannibal = 18;
      cannibal = clamp01(cannibal + selfCnt * 4);

      const w = SITING_WEIGHTS;
      const total =
        w.demand * demandScore +
        w.supply_gap * gapScore +
        w.competition * competition +
        w.access * access +
        w.anti_cannibal * (100 - cannibal);

      const subs = {
        demand: round1(demandScore),
        supply_gap: round1(gapScore),
        competition: round1(competition),
        access: round1(access),
        anti_cannibal: round1(100 - cannibal)
      };

      const parts = [];
      if (subs.supply_gap >= 50) parts.push("环内补能缺口仍高");
      else parts.push("环内缺口中等");
      if (selfCnt === 0) parts.push("近距无小李站、蚕食低");
      else if (nearestSelf > 900) parts.push("距已有站较远、蚕食可控");
      else parts.push("距已有站偏近、蚕食偏高");
      if (subs.access >= 65) parts.push("商服/枢纽可达较好");

      return {
        cand_id: cand.cand_id,
        label: cand.label,
        lng: cand.lng,
        lat: cand.lat,
        zone_id: zid,
        R_m: SITING_R_M,
        total: round1(total),
        subscores: subs,
        buffer: {
          neigh_n: n,
          self_cnt: selfCnt,
          nearest_self_m: Math.round(nearestSelf)
        },
        reason_text:
          cand.label +
          "：" +
          parts.join("；") +
          "。权重可解释（非 ML），雨天不作定址主依据。"
      };
    }

    const dLat = 0.008;
    const dLng = 0.01;
    const cands = [
      {
        cand_id: "A",
        label: "候选 A · 缺口区心",
        lat: z.centroid_lat,
        lng: z.centroid_lng,
        seedDemand: zoneRow.demand,
        seedGap: zoneRow.gap
      },
      {
        cand_id: "B",
        label: "候选 B · 廊道侧偏移",
        lat: z.centroid_lat + dLat * 0.35,
        lng: z.centroid_lng + dLng * 0.4,
        seedDemand: zoneRow.demand * 0.92,
        seedGap: (zoneRow.gap || 0) * 1.05
      }
    ];
    const results = cands.map(scoreAt);
    const sorted = results.slice().sort(function (a, b) {
      return b.total - a.total;
    });
    const win = sorted[0];
    const lose = sorted[1];
    let one =
      "推荐 " + win.cand_id + "（" + win.total.toFixed(1) + "）";
    if (lose) {
      const dCan =
        win.subscores.anti_cannibal - lose.subscores.anti_cannibal;
      one +=
        " 优于 " +
        lose.cand_id +
        "（" +
        lose.total.toFixed(1) +
        "）：" +
        (dCan >= 3 ? "更低蚕食" : "综合分项更均衡") +
        "。";
    }
    return {
      zone_id: zid,
      results: results,
      winner: win.cand_id,
      one_liner: one,
      weights: SITING_WEIGHTS
    };
  }

  /**
   * Quality issues mock — 主数据/入口/路网距；不含终端 GPS。
   */
  function mockQualityIssues(stores, chargers) {
    const issues = [];
    const rules = [
      {
        code: "ENTRY_MISSING",
        severity: "P0",
        title: "入口点缺失",
        detail: "主数据无标准入口，导航到路口后难进店/进站"
      },
      {
        code: "ROAD_TOO_FAR",
        severity: "P1",
        title: "距路网过远",
        detail: "实体相对干道代理偏远，到达体验差"
      },
      {
        code: "NAME_ALIAS",
        severity: "P1",
        title: "命名别名不一致",
        detail: "展示名与主数据别名未对齐（合成）"
      },
      {
        code: "FENCE_DRIFT",
        severity: "P0",
        title: "围栏中心偏移",
        detail: "核销围栏相对主数据坐标偏移（主数据问题，非终端 GPS）"
      }
    ];

    function pushFrom(list, objectKind, brandPrefix) {
      (list || []).forEach(function (e, idx) {
        if (idx % 17 !== 0 && idx % 23 !== 0) return;
        const rule = rules[idx % rules.length];
        const tag = e.zone_id
          ? String(e.zone_id).split(":").slice(-1)[0]
          : "片区";
        issues.push({
          issue_id: "iss_" + e.entity_id + "_" + rule.code,
          entity_id: e.entity_id,
          object: objectKind,
          display_name: brandPrefix + "·" + tag,
          brand: e.brand || brandPrefix,
          code: rule.code,
          severity: rule.severity,
          title: rule.title,
          detail: rule.detail,
          lng: e.lng,
          lat: e.lat,
          out_of_scope: "device_gps_drift",
          legend_group: "数据质量"
        });
      });
    }

    pushFrom(chargers, "charger", "小李充电");
    pushFrom(stores, "store", "小李门店");
    issues.sort(function (a, b) {
      if (a.severity === b.severity) return a.code.localeCompare(b.code);
      return a.severity === "P0" ? -1 : 1;
    });
    return issues;
  }

  function qualityColor(sev) {
    if (sev === "P0") return "#a855f7";
    if (sev === "P1") return "#f59e0b";
    return "#94a3b8";
  }

  global.LBSMetrics = {
    FORMULA_RIDE: FORMULA_RIDE,
    FORMULA_GENERIC: FORMULA_GENERIC,
    FORMULA_CHG: FORMULA_CHG,
    FORMULA_DELIVERY: FORMULA_DELIVERY,
    FORMULA_O2O: FORMULA_O2O,
    SITING_WEIGHTS: SITING_WEIGHTS,
    SITING_R_M: SITING_R_M,
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
    roadClassVisible: roadClassVisible,
    etaRadiusM: etaRadiusM,
    storeCoverageM: storeCoverageM,
    scoreSitingCandidates: scoreSitingCandidates,
    mockQualityIssues: mockQualityIssues,
    qualityColor: qualityColor,
    haversineM: haversineM
  };
})(typeof window !== "undefined" ? window : globalThis);
