(function () {
  "use strict";

  const $ = function (id) {
    return document.getElementById(id);
  };

  let data = null;
  let mapApp = null;
  let zoneById = new Map();
  let zonesGeo = null;
  let fineLoaded = false;
  let fineLoading = false;
  let lastCongStats = { share: 0, difficulty: 1 };
  let qualityIssues = [];
  let lastSiting = null;
  let storeById = new Map();
  let siteById = new Map();
  let lastAccessResult = null;
  let lastAccessCompare = null;
  let energySortKey = "gap_near";
  let accessBusy = false;

  const PACK_LABEL = {
    overview: "区域总览",
    o2o: "到店",
    ride: "出行",
    fulfillment: "履约",
    energy: "能源",
    governance: "治理"
  };

  function cfg() {
    return window.LBS_CONFIG || { amapKey: "" };
  }

  function showBanner(msg, on) {
    const el = $("banner-key");
    if (!el) return;
    if (!on || !msg) {
      el.classList.remove("show");
      el.textContent = "";
      return;
    }
    el.textContent = msg;
    el.classList.add("show");
  }

  function setStatus(t) {
    const el = $("status");
    if (el) el.textContent = t || "";
  }

  function metricRowsForPack(pack) {
    if (!data) return [];
    if (pack === "ride") return (data.metrics_ride && data.metrics_ride.rows) || [];
    if (pack === "fulfillment")
      return (data.metrics_delivery && data.metrics_delivery.rows) || [];
    if (pack === "energy") return (data.metrics_chg && data.metrics_chg.rows) || [];
    if (pack === "o2o") return (data.metrics_o2o && data.metrics_o2o.rows) || [];
    // overview uses ride gap as stage metric
    return (data.metrics_ride && data.metrics_ride.rows) || [];
  }

  function sceneForPack(pack) {
    return AppContext.PACK_SCENE[pack] || "ride";
  }

  function analysisOf(ctx) {
    const as = (ctx && ctx.analysis_scene) || {};
    return {
      time_scenario: LBSMetrics.normalizeTimeScenario(
        as.time_scenario || ctx.time_of_day || "wd_pm_peak"
      ),
      weather: as.weather || ctx.weather || "clear"
    };
  }

  function computeOpts(ctx) {
    const a = analysisOf(ctx);
    return {
      weatherDoc: data.weather,
      calendarDoc: data.calendar,
      congDoc: data.congestion,
      weather: a.weather,
      nodeKey: ctx.season_or_node,
      time_of_day: a.time_scenario,
      scene: sceneForPack(ctx.active_pack)
    };
  }

  function sceneBundle(ctx) {
    const a = analysisOf(ctx);
    return LBSMetrics.difficultyFromScene(
      data && data.congestion,
      data && data.scenario_ci,
      a.time_scenario,
      a.weather,
      sceneForPack(ctx.active_pack)
    );
  }

  function timeLabel(ts) {
    const map = {
      wd_night: "工作日·夜间",
      wd_am_peak: "工作日·早高峰",
      wd_day_offpeak: "工作日·平峰",
      wd_pm_peak: "工作日·晚高峰",
      we_day: "周末·日间",
      we_night: "周末·夜间"
    };
    return map[ts] || ts;
  }

  function weatherLabel(w) {
    return w === "rain" ? "雨" : w === "extreme" ? "极端" : "晴";
  }

  function computeZoneList(ctx) {
    const rows = metricRowsForPack(ctx.active_pack);
    const sc = LBSMetrics.sceneKey(sceneForPack(ctx.active_pack));
    const idx = LBSMetrics.indexZoneRows(rows, ctx.time_of_day, sc);
    const opts = computeOpts(ctx);
    const list = [];
    idx.forEach(function (row, zid) {
      const z = zoneById.get(zid);
      const labels = (z && z.labels) || [];
      const m = LBSMetrics.applyRow(
        row,
        Object.assign({}, opts, { labels: labels })
      );
      if (m) {
        m.name = (z && z.name) || zid;
        m.zone_type = (z && z.zone_type) || m.zone_type;
        m.labels = labels;
        list.push(m);
      }
    });
    return list;
  }

  function updateCongestionDerived(ctx) {
    const sc = sceneForPack(ctx.active_pack);
    const bundle = LBSMetrics.difficultyBundle(
      data.congestion,
      ctx.weather,
      ctx.time_of_day,
      sc
    );
    // estimate share blocked from city index
    const share = Math.min(0.95, Math.max(0.05, bundle.congestion_index * 0.9));
    const narrative = buildNarrative(ctx, bundle.difficulty, share);
    lastCongStats = { share: share, difficulty: bundle.difficulty };
    AppContext.set({
      congestion: {
        share_blocked: share,
        difficulty_coeff: bundle.difficulty,
        narrative: narrative
      }
    });
    // avoid double notify loop: set already notifies; callers should not re-enter
  }

  function buildNarrative(ctx, diff, share, cityCi) {
    const a = analysisOf(ctx);
    const chip =
      timeLabel(a.time_scenario) +
      " · " +
      weatherLabel(a.weather) +
      " · CI≈" +
      (cityCi != null ? Number(cityCi).toFixed(2) : "—");
    if (ctx.selected_road_id) {
      return "已选路段 · " + chip + " · 难度×" + diff.toFixed(2);
    }
    if (ctx.selected_zone_id) {
      const z = zoneById.get(ctx.selected_zone_id);
      return (
        "区「" +
        ((z && z.name) || ctx.selected_zone_id) +
        "」· " +
        chip
      );
    }
    if (ctx.selected_site_id || ctx.storeFocusId) {
      return (
        "站点 " +
        (ctx.selected_site_id || ctx.storeFocusId) +
        " · " +
        chip
      );
    }
    if (ctx.active_pack === "ride") {
      return "出行缺口同屏 · " + chip + " · 难度×" + diff.toFixed(2);
    }
    if (ctx.active_pack === "fulfillment") {
      return "履约时效受路阻抗 · " + chip;
    }
    if (ctx.active_pack === "o2o") {
      return ctx.storeFocusMode
        ? "到店单店聚焦 · " + chip
        : "到店网络浏览 · " + chip;
    }
    if (ctx.active_pack === "energy") {
      if (ctx.selected_site_id && lastAccessResult && lastAccessResult.ok) {
        const n10 = LBSAccess.countInBand(lastAccessResult, 10);
        return (
          "点站圈 10min 覆盖 " +
          n10 +
          " 区 · " +
          chip +
          (lastAccessCompare
            ? " · Δ区 " + lastAccessCompare.delta_coverage_count
            : "")
        );
      }
      return (
        "能源看板 " +
        chargerCount() +
        " 站 · KPI+功率 · " +
        chip +
        " · 点站等时圈"
      );
    }
    if (ctx.active_pack === "governance") {
      return "治理质量点 · " + chip + " · 不处理终端 GPS";
    }
    return "总览定语境 · " + chip + " · 压力上界看晚峰×雨";
  }

  function paintStory(ctx) {
    const t = $("story-t");
    const d = $("story-d");
    const sm1 = $("sm-obj");
    const sm2 = $("sm-ci");
    const sm3 = $("sm-diff");
    const cong = ctx.congestion || {};
    const a = analysisOf(ctx);
    if (t) {
      t.textContent =
        (PACK_LABEL[ctx.active_pack] || "") +
        " · " +
        timeLabel(a.time_scenario) +
        " · " +
        weatherLabel(a.weather);
    }
    if (d) {
      d.textContent =
        cong.narrative ||
        "两卡情景驱动路网色与难度；镜头仅 flyTo。";
    }
    if (sm1) {
      sm1.textContent =
        ctx.selected_road_id
          ? "路段 " + ctx.selected_road_id
          : ctx.selected_zone_id
            ? ctx.selected_zone_id.split(":").slice(-1)[0]
            : ctx.selected_site_id || ctx.storeFocusId
              ? ctx.selected_site_id || ctx.storeFocusId
              : "—";
    }
    if (sm2) {
      sm2.textContent =
        cong.city_ci != null ? Number(cong.city_ci).toFixed(2) : "—";
    }
    if (sm3) {
      sm3.textContent =
        "×" +
        (cong.difficulty_coeff != null
          ? Number(cong.difficulty_coeff).toFixed(2)
          : "1.00");
    }
    if ($("scene-chip")) {
      $("scene-chip").textContent =
        timeLabel(a.time_scenario) +
        " · " +
        weatherLabel(a.weather) +
        " · CI≈" +
        (cong.city_ci != null ? Number(cong.city_ci).toFixed(2) : "—");
    }
  }

  function storeList() {
    return (data && data.stores && (data.stores.entities || data.stores)) || [];
  }
  function chargerList() {
    const c = data && data.chargers;
    if (!c) return [];
    // 05.2: prefer site unit
    if (Array.isArray(c.sites) && c.sites.length) return c.sites;
    if (Array.isArray(c.entities)) return c.entities;
    return Array.isArray(c) ? c : [];
  }
  function chargerCount() {
    const c = data && data.chargers;
    if (c && c.site_count != null) return c.site_count;
    return chargerList().length;
  }
  function storeCount() {
    return storeList().length;
  }

  function paintMap(ctx) {
    if (!mapApp || !data) return;
    const layers = ctx.layer_set || [];
    const has = function (k) {
      return layers.indexOf(k) >= 0;
    };
    const pack = ctx.active_pack;

    mapApp.showLayer("basemap", has("basemap"));
    mapApp.showLayer("water", has("water"));
    mapApp.showLayer("zones", has("zones"));
    mapApp.showLayer(
      "heat",
      has("heat") || has("heat_grid") || has("heat_kde")
    );
    mapApp.showLayer("roads", has("roads") || has("road_cong"));
    mapApp.showLayer(
      "points",
      has("stores") || has("chargers") || has("quality")
    );
    mapApp.showLayer("overlay", has("overlay") || has("fence"));

    if (ctx.selected_zone_id) mapApp.setZoneSelection(ctx.selected_zone_id);

    // heat by pack metric
    const list = computeZoneList(ctx);
    const byZone = new Map();
    let maxG = 40;
    list.forEach(function (m) {
      if (m.ok && m.gap != null) maxG = Math.max(maxG, m.gap);
      if (m.ok && m.demand != null) maxG = Math.max(maxG, m.demand);
    });
    list.forEach(function (m) {
      if (!m.ok) return;
      let val = m.gap;
      let labelPrefix = "gap ";
      if (pack === "o2o") {
        val = m.demand;
        labelPrefix = "demand ";
      }
      if (ctx.metric_key === "ride_demand") val = m.demand;
      if (ctx.metric_key === "ride_supply") val = m.supply;
      if (val == null) return;
      byZone.set(m.zone_id, {
        value: val,
        fill: LBSMetrics.heatFill(val, 0, Math.max(40, maxG)),
        label:
          labelPrefix +
          Number(val).toFixed(1) +
          (m.supply != null
            ? " · d=" + m.demand.toFixed(0) + " s=" + m.supply.toFixed(0)
            : "")
      });
    });

    const heatMode = ctx.heatRenderMode || "poly";
    if (pack === "governance") {
      mapApp.clearHeat();
    } else if (heatMode === "poly") {
      if (has("heat")) mapApp.renderZoneHeat(zonesGeo, byZone);
      else mapApp.clearHeat();
    } else if (heatMode === "grid") {
      ensureFineHeat(ctx, list);
    } else if (heatMode === "kde") {
      const pts = [];
      list.forEach(function (m) {
        const z = zoneById.get(m.zone_id);
        if (!z || !m.ok) return;
        const v = pack === "o2o" ? m.demand : m.gap != null ? m.gap : m.demand;
        if (v == null || v < 5) return;
        pts.push({
          lat: z.centroid_lat,
          lng: z.centroid_lng,
          radius: 600 + Math.min(1800, v * 20),
          fill: LBSMetrics.heatFill(v, 0, 80)
        });
      });
      mapApp.renderKde(pts);
    }

    // roads — fulfillment/ride/energy default on with cong
    const a = analysisOf(ctx);
    const bundle = sceneBundle(ctx);
    const roadsOn =
      has("roads") ||
      has("road_cong") ||
      pack === "fulfillment" ||
      pack === "ride";
    mapApp.rebuildRoads({
      mode: ctx.roadDisplayMode || "cong",
      lod: ctx.lodLevel || "district",
      cityIndex: bundle.congestion_index,
      weather: a.weather,
      tod: a.time_scenario,
      time_scenario: a.time_scenario,
      difficulty: bundle.difficulty,
      scenarioCi: data.scenario_ci,
      anchorsDoc: data.typical_road_anchors,
      show: roadsOn
    });
    if (ctx.selected_road_id) mapApp.highlightRoad(ctx.selected_road_id);

    // points + overlays by pack
    mapApp.clearOverlay();

    if (pack === "governance") {
      const qpts = qualityIssues.map(function (iss) {
        return Object.assign({}, iss, {
          entity_id: iss.issue_id,
          name: iss.display_name + " · " + iss.severity,
          _fill: LBSMetrics.qualityColor(iss.severity)
        });
      });
      mapApp.setPoints(qpts, "quality", "block", null);
      return;
    }

    if (pack === "energy" || has("chargers")) {
      const sites = chargerList();
      const focusId = ctx.selected_site_id || null;
      mapApp.setPoints(
        sites,
        "charger",
        ctx.lodLevel,
        focusId ? { focusId: focusId, mode: "dim" } : null
      );
      if (focusId && lastAccessResult && lastAccessResult.ok) {
        mapApp.setIsochrones(lastAccessResult.bands, { fillOpacity: 0.14 });
      } else if (ctx.siting_open && lastSiting && lastSiting.results) {
        mapApp.setSitingMarkers(lastSiting.results, lastSiting.winner);
      }
      return;
    }

    if (pack === "o2o" || pack === "fulfillment" || has("stores")) {
      const st = storeList();
      if (pack === "o2o" && ctx.storeFocusMode && ctx.storeFocusId) {
        mapApp.setPoints(st, "store", ctx.lodLevel, {
          focusId: ctx.storeFocusId,
          mode: "dim"
        });
        const ent = storeById.get(ctx.storeFocusId);
        if (ent) {
          const cov = LBSMetrics.storeCoverageM(ent);
          const fence = Math.round(cov * 0.55);
          mapApp.setOverlayRings([
            {
              lat: ent.lat,
              lng: ent.lng,
              r: cov,
              color: "#56b6c2",
              dash: "6 4",
              fillOpacity: 0.1,
              label: "客流覆盖 · " + cov + "m"
            },
            {
              lat: ent.lat,
              lng: ent.lng,
              r: fence,
              color: "#c678dd",
              dash: "2 3",
              fillOpacity: 0.08,
              weight: 2,
              label: "核销围栏 · " + fence + "m"
            }
          ]);
        }
      } else if (pack === "fulfillment") {
        mapApp.setPoints(st, "store", ctx.lodLevel, null);
        // ETA ring: selected zone or hub default; shrinks with difficulty
        let lat = null;
        let lng = null;
        let baseR = 1800;
        if (ctx.selected_zone_id && zoneById.get(ctx.selected_zone_id)) {
          const z = zoneById.get(ctx.selected_zone_id);
          lat = z.centroid_lat;
          lng = z.centroid_lng;
        } else if (ctx.selected_entity && storeById.get(ctx.selected_entity)) {
          const e = storeById.get(ctx.selected_entity);
          lat = e.lat;
          lng = e.lng;
          baseR = 1500;
        } else {
          // default demo ring near first high-gap zone
          const top = LBSMetrics.topShortage(list, 1)[0];
          if (top && zoneById.get(top.zone_id)) {
            const z = zoneById.get(top.zone_id);
            lat = z.centroid_lat;
            lng = z.centroid_lng;
          }
        }
        if (lat != null) {
          const r = LBSMetrics.etaRadiusM(baseR, bundle.difficulty);
          mapApp.setEtaRing([lat, lng], r, {
            color: bundle.difficulty >= 1.15 ? "#f07178" : "#56b6c2",
            label:
              "履约时效圈 · " +
              r +
              "m（难度 ×" +
              bundle.difficulty.toFixed(2) +
              "，雨/高峰缩小）"
          });
        }
      } else {
        mapApp.setPoints(st, "store", ctx.lodLevel, null);
      }
      return;
    }

    mapApp.setPoints([], "store", ctx.lodLevel, null);
  }

  function ensureFineHeat(ctx, zoneList) {
    if (fineLoaded && data.heat_fine && data.grids_fine) {
      paintFine(ctx);
      return;
    }
    if (fineLoading) return;
    fineLoading = true;
    setStatus("加载细格热力…");
    LBSData.loadHeatFine().then(function (res) {
      fineLoading = false;
      data.heat_fine = res.heat_fine;
      data.grids_fine = res.grids_fine;
      fineLoaded = !!(res.heat_fine && res.grids_fine);
      if (!fineLoaded) {
        showBanner(
          "细格热力数据未拷贝到 public/data（可能 gitignore 大文件）。已回退区面热力。运行 npm run copy:public-data 后重试。",
          true
        );
        AppContext.set({ heatRenderMode: "poly" });
        return;
      }
      paintFine(AppContext.get());
      setStatus("细格热力已加载");
    });
  }

  function accessCtx() {
    const gapIds = new Set();
    computeZoneList(
      Object.assign({}, AppContext.get(), { active_pack: "energy" })
    ).forEach(function (m) {
      if (m.ok && m.gap != null && m.gap >= 12) gapIds.add(m.zone_id);
    });
    const qcOk =
      data.manifest &&
      (data.manifest.roads_qc_pass === true ||
        (data.roads && data.roads.features && data.roads.features.length > 1000));
    return {
      roads: data.roads,
      scenarioCi: data.scenario_ci,
      anchorsDoc: data.typical_road_anchors,
      zoneById: zoneById,
      gapZoneIds: gapIds,
      roadsQcOk: !!qcOk
    };
  }

  function energyKpis(ctx) {
    const sites = chargerList();
    let totalKw = 0;
    let openN = 0;
    let highUtil = 0;
    sites.forEach(function (s) {
      totalKw += Number(s.total_rated_kw || s.max_power_kw || s.power_kw || 0);
      if (s.status === "open" || !s.status) openN += 1;
      if ((s.utilization_synth || 0) >= 0.7) highUtil += 1;
    });
    const gaps = LBSMetrics.topShortage(
      computeZoneList(
        Object.assign({}, ctx, { active_pack: "energy" })
      ),
      50
    );
    // rough 10min cover rate when site selected
    let coverRate = "—";
    if (lastAccessResult && lastAccessResult.ok) {
      const n10 = LBSAccess.countInBand(lastAccessResult, 10);
      const nAll = lastAccessResult.zone_coverage
        ? lastAccessResult.zone_coverage.length
        : 1;
      coverRate = Math.round((n10 / Math.max(1, nAll)) * 100) + "%";
    }
    return {
      site_n: sites.length,
      total_mw: Math.round((totalKw / 1000) * 10) / 10,
      open_rate: sites.length
        ? Math.round((openN / sites.length) * 100) + "%"
        : "—",
      gap_zones: gaps.length,
      high_util: highUtil,
      cover_10: coverRate
    };
  }

  function sortSites(list, ctx) {
    const gapByZone = new Map();
    computeZoneList(
      Object.assign({}, ctx, { active_pack: "energy" })
    ).forEach(function (m) {
      if (m.ok) gapByZone.set(m.zone_id, m.gap || 0);
    });
    const arr = list.slice();
    const key = energySortKey || "gap_near";
    arr.sort(function (a, b) {
      if (key === "power") {
        return (
          (b.total_rated_kw || b.max_power_kw || 0) -
          (a.total_rated_kw || a.max_power_kw || 0)
        );
      }
      if (key === "util") {
        return (b.utilization_synth || 0) - (a.utilization_synth || 0);
      }
      if (key === "name") {
        return String(a.name || "").localeCompare(String(b.name || ""), "zh");
      }
      // gap_near
      return (gapByZone.get(b.zone_id) || 0) - (gapByZone.get(a.zone_id) || 0);
    });
    return arr;
  }

  function paintEnergyBoard(ctx) {
    const tabE = $("tab-energy");
    if (tabE) tabE.classList.remove("hidden");
    const pe = $("panel-energy");
    const pl = $("panel-list");
    const pr = $("panel-road");
    // default show energy board (unless user on road tab)
    const showEnergy = ctx.side_panel !== "road";
    if (pe) pe.classList.toggle("hidden", !showEnergy);
    if (pl) pl.classList.add("hidden");
    if (pr) pr.classList.toggle("hidden", ctx.side_panel !== "road");
    document.querySelectorAll(".side-tabs button").forEach(function (b) {
      const p = b.getAttribute("data-panel");
      b.classList.toggle(
        "on",
        showEnergy ? p === "energy" : p === ctx.side_panel
      );
    });
    if (!showEnergy) return;

    const kpi = energyKpis(ctx);
    const kpiEl = $("energy-kpi");
    if (kpiEl) {
      kpiEl.innerHTML =
        kpiCell(kpi.site_n, "站点数 (site)") +
        kpiCell(kpi.total_mw + " MW", "功率能力") +
        kpiCell(kpi.gap_zones, "缺口区数") +
        kpiCell(kpi.cover_10, "10min 区覆盖") +
        kpiCell(kpi.open_rate, "开放率 Synth") +
        kpiCell(kpi.high_util, "高负荷站数");
    }

    const listEl = $("energy-list");
    if (!listEl) return;
    listEl.innerHTML = "";
    const sorted = sortSites(chargerList(), ctx).slice(0, 80);
    const gapByZone = new Map();
    computeZoneList(
      Object.assign({}, ctx, { active_pack: "energy" })
    ).forEach(function (m) {
      if (m.ok) gapByZone.set(m.zone_id, m.gap || 0);
    });
    sorted.forEach(function (s) {
      const id = s.site_id || s.entity_id;
      const row = document.createElement("div");
      row.className =
        "energy-row" + (ctx.selected_site_id === id ? " sel" : "");
      const gap = gapByZone.get(s.zone_id);
      const z = zoneById.get(s.zone_id);
      row.innerHTML =
        '<div class="er-name">' +
        (s.name || id) +
        '</div><div><span class="pill mid">' +
        (s.power_tier_label || (s.max_power_kw || s.power_kw || "—") + "kW") +
        "</span></div>" +
        '<div class="er-meta">' +
        ((z && z.name) || s.zone_id || "—") +
        " · " +
        (s.stall_count || s.stalls || "?") +
        " 桩 · 总" +
        (s.total_rated_kw || "—") +
        "kW · 利用 " +
        Math.round((s.utilization_synth || 0) * 100) +
        "%" +
        (gap != null ? " · 邻缺口 " + gap.toFixed(0) : "") +
        "</div>";
      row.addEventListener("click", function () {
        selectEnergySite(id);
      });
      listEl.appendChild(row);
    });

    paintEnergyDetail(ctx);
  }

  function kpiCell(v, lab) {
    return (
      '<div class="kpi-item"><div class="kv">' +
      v +
      '</div><div class="kl">' +
      lab +
      "</div></div>"
    );
  }

  function selectEnergySite(siteId) {
    const site = siteById.get(siteId);
    if (!site) return;
    lastAccessCompare = null;
    if (AppContext.get().active_pack !== "energy") {
      AppContext.switchPack("energy");
    }
    AppContext.set({
      selected_site_id: siteId,
      selected_entity: siteId,
      selected_zone_id: site.zone_id || null,
      side_panel: "energy"
    });
    mapApp.focusLatLng(site.lat, site.lng, 14);
    runSiteAccess(site);
  }

  function runSiteAccess(site) {
    if (!site || !global.LBSAccess) return;
    if (accessBusy) return;
    accessBusy = true;
    setStatus("计算服务等时圈…");
    // defer so UI paints
    setTimeout(function () {
      try {
        const ctx = AppContext.get();
        const a = analysisOf(ctx);
        const res = LBSAccess.fromPoint(
          {
            source: {
              kind: "site",
              id: site.site_id || site.entity_id,
              lat: site.lat,
              lng: site.lng
            },
            analysis_scene: a,
            bands_min: [5, 10, 15],
            include_zone_eta: true,
            max_radius_m: 12000
          },
          accessCtx()
        );
        lastAccessResult = res;
        if (!res.ok) {
          showBanner(
            "等时圈失败：" + (res.message || res.error_code) + "（Synthetic 规则）",
            true
          );
        } else {
          showBanner("", false);
        }
        paintMap(AppContext.get());
        paintEnergyDetail(AppContext.get());
        paintStory(AppContext.get());
        setStatus(
          res.ok
            ? "等时圈就绪 · " +
                (res.stats && res.stats.elapsed_ms) +
                "ms · 10min 区 " +
                LBSAccess.countInBand(res, 10)
            : "等时圈不可用"
        );
      } catch (e) {
        console.error(e);
        setStatus("等时圈异常");
      }
      accessBusy = false;
    }, 30);
  }

  function paintEnergyDetail(ctx) {
    const box = $("energy-detail");
    const cover = $("energy-cover");
    if (!box) return;
    const sid = ctx.selected_site_id;
    if (!sid) {
      box.innerHTML =
        "<h3>点选站点</h3><div class='v'>列表/地图单位 = <strong>site</strong>（小李充电站）。含功率结构。点站 → 5/10/15min 服务圈 + 覆盖区表。可用「情景Δ」对比平峰晴 vs 晚峰雨。</div>";
      if (cover) cover.innerHTML = "";
      return;
    }
    const s = siteById.get(sid);
    if (!s) return;
    const z = zoneById.get(s.zone_id);
    const a = analysisOf(ctx);
    let html =
      "<h3>" +
      (s.name || sid) +
      "</h3>" +
      "<div class='k'>site_id / 区</div><div class='v'><code>" +
      sid +
      "</code> · " +
      ((z && z.name) || s.zone_id || "—") +
      "</div>" +
      "<div class='k'>功率（Must）</div><div class='v'>" +
      (s.power_structure_label || s.power_tier_label || "—") +
      " · 峰值 " +
      (s.max_power_kw || s.power_kw || "—") +
      "kW · 站额定总 " +
      (s.total_rated_kw || "—") +
      "kW · " +
      (s.stall_count || s.stalls || "?") +
      " 桩</div>" +
      "<div class='k'>状态 · 利用 (Synthetic)</div><div class='v'>" +
      (s.status || "open") +
      " · " +
      Math.round((s.utilization_synth || 0) * 100) +
      "% · " +
      (s.open_hours || "") +
      "</div>" +
      "<div class='k'>analysis_scene</div><div class='v'>" +
      a.time_scenario +
      " · " +
      a.weather +
      "</div>";

    if (lastAccessResult && lastAccessResult.ok) {
      const n5 = LBSAccess.countInBand(lastAccessResult, 5);
      const n10 = LBSAccess.countInBand(lastAccessResult, 10);
      const n15 = LBSAccess.countInBand(lastAccessResult, 15);
      html +=
        "<div class='k'>服务圈覆盖区数</div><div class='v'>5min <b>" +
        n5 +
        "</b> · 10min <b>" +
        n10 +
        "</b> · 15min <b>" +
        n15 +
        "</b></div>" +
        "<div class='iso-legend'>" +
        "<span><i style='background:#22c55e'></i>5min</span>" +
        "<span><i style='background:#eab308'></i>10min</span>" +
        "<span><i style='background:#f97316'></i>15min</span>" +
        " · 非导航 · Synthetic</div>";
      if (lastAccessResult.warnings && lastAccessResult.warnings.length) {
        html +=
          "<div class='k'>诚实声明</div><div class='v'>" +
          lastAccessResult.warnings.join(" · ") +
          "</div>";
      }
    } else if (lastAccessResult && !lastAccessResult.ok) {
      html +=
        "<div class='err' style='margin-top:8px'>" +
        (lastAccessResult.message || lastAccessResult.error_code) +
        "</div>";
    } else {
      html += "<div class='v' style='margin-top:8px'>计算服务圈中…</div>";
    }

    if (lastAccessCompare) {
      html +=
        "<div class='delta-card'>" +
        LBSAccess.adviceTemplate(
          s,
          lastAccessCompare,
          s.power_structure_label || s.power_tier_label
        ) +
        "<br/>A=" +
        lastAccessCompare.scene_a.time_scenario +
        "/" +
        lastAccessCompare.scene_a.weather +
        " (" +
        lastAccessCompare.coverage_count_a +
        "区) → B=" +
        lastAccessCompare.scene_b.time_scenario +
        "/" +
        lastAccessCompare.scene_b.weather +
        " (" +
        lastAccessCompare.coverage_count_b +
        "区)</div>";
    }

    html +=
      "<p style='margin-top:8px'>" +
      "<button type='button' id='btn-rerun-iso'>重算圈</button> " +
      "<button type='button' id='btn-compare-site'>平峰晴 vs 晚峰雨 Δ</button> " +
      "<button type='button' id='btn-clear-site'>取消选站</button>" +
      "</p>";
    box.innerHTML = html;

    if (cover) {
      if (lastAccessResult && lastAccessResult.ok) {
        const rows = lastAccessResult.zone_coverage
          .filter(function (z) {
            return z.in_band && (z.in_band["10"] || z.in_band["15"]);
          })
          .sort(function (a, b) {
            return (a.eta_min || 99) - (b.eta_min || 99);
          })
          .slice(0, 12);
        let t =
          "<div class='k'>覆盖区表（≤15min，Top12）</div><table><thead><tr><th>区</th><th>类型</th><th>ETA</th><th>缺口</th></tr></thead><tbody>";
        rows.forEach(function (z) {
          t +=
            "<tr><td>" +
            (z.name || z.zone_id) +
            "</td><td>" +
            (z.zone_type || "—") +
            "</td><td>" +
            (z.eta_min != null ? z.eta_min + "′" : "—") +
            "</td><td>" +
            (z.is_gap ? "<span class='pill hi'>缺口</span>" : "—") +
            "</td></tr>";
        });
        t += "</tbody></table>";
        cover.innerHTML = t;
      } else cover.innerHTML = "";
    }

    const b1 = $("btn-rerun-iso");
    if (b1)
      b1.onclick = function () {
        runSiteAccess(s);
      };
    const b2 = $("btn-compare-site");
    if (b2)
      b2.onclick = function () {
        runSceneCompare(s);
      };
    const b3 = $("btn-clear-site");
    if (b3)
      b3.onclick = function () {
        lastAccessResult = null;
        lastAccessCompare = null;
        AppContext.set({ selected_site_id: null });
        mapApp.clearOverlay();
      };
  }

  function runSceneCompare(site) {
    if (!site || !global.LBSAccess) return;
    setStatus("情景对比计算中…");
    setTimeout(function () {
      const cmp = LBSAccess.compareScenes(
        site,
        { time_scenario: "wd_day_offpeak", weather: "clear" },
        { time_scenario: "wd_pm_peak", weather: "rain" },
        accessCtx(),
        10
      );
      lastAccessCompare = cmp;
      // show pressure scene rings
      if (cmp.result_b && cmp.result_b.ok) {
        lastAccessResult = cmp.result_b;
        AppContext.setAnalysisScene("wd_pm_peak", "rain");
      } else {
        paintEnergyDetail(AppContext.get());
      }
      setStatus(
        "Δ 10min 覆盖 " +
          cmp.coverage_count_a +
          "→" +
          cmp.coverage_count_b +
          "（" +
          (cmp.delta_coverage_count >= 0 ? "+" : "") +
          cmp.delta_coverage_count +
          "）"
      );
    }, 40);
  }

  function paintFine(ctx) {
    if (!data.heat_fine || !data.grids_fine) return;
    const sc = LBSMetrics.sceneKey(sceneForPack(ctx.active_pack));
    const tod = ctx.time_of_day;
    const gmap = new Map();
    (data.grids_fine.grids || []).forEach(function (g) {
      gmap.set(g.grid_id, g);
    });
    const opts = computeOpts(ctx);
    const cells = [];
    const rows = data.heat_fine.rows || [];
    // sample rows for current tod+scene
    let n = 0;
    for (let i = 0; i < rows.length && n < 12000; i++) {
      const r = rows[i];
      if (r.time_of_day !== tod) continue;
      if (LBSMetrics.sceneKey(r.scene) !== sc) continue;
      // stride
      if (i % 3 !== 0) continue;
      const m = LBSMetrics.applyRow(r, opts);
      if (!m || !m.ok || m.gap == null || m.gap < 4) continue;
      const g = gmap.get(r.grid_id);
      if (!g) continue;
      cells.push({
        lng: g.cell_lng,
        lat: g.cell_lat,
        cell_m: g.cell_m || 300,
        fill: LBSMetrics.heatFill(m.gap, 0, 60)
      });
      n++;
    }
    mapApp.renderFineHeat(cells);
  }

  function paintList(ctx) {
    const tbody = $("tbody");
    const sideTitle = $("side-title");
    const sideMeta = $("side-meta");
    const formula = $("formula-box");
    if (sideTitle) {
      sideTitle.textContent =
        ctx.active_pack === "ride"
          ? "出行缺口"
          : ctx.active_pack === "fulfillment"
            ? "履约 · 需求/时效"
            : ctx.active_pack === "energy"
              ? "能源运营看板"
              : ctx.active_pack === "o2o"
                ? ctx.storeFocusMode
                  ? "到店 · 单店聚焦"
                  : "到店 · 商圈/门店"
                : ctx.active_pack === "governance"
                  ? "数据质量 · 问题列表"
                  : "区列表 · KPI";
    }
    if (sideMeta) {
      sideMeta.textContent =
        "情景 " +
        ctx.scenario +
        " · " +
        ctx.weather +
        " · " +
        ctx.time_of_day +
        " · Synthetic";
    }
    if (formula) {
      if (ctx.active_pack === "ride" || ctx.active_pack === "overview")
        formula.textContent = LBSMetrics.FORMULA_RIDE;
      else if (ctx.active_pack === "fulfillment")
        formula.textContent = LBSMetrics.FORMULA_DELIVERY;
      else if (ctx.active_pack === "energy")
        formula.textContent = LBSMetrics.FORMULA_CHG;
      else if (ctx.active_pack === "o2o")
        formula.textContent = LBSMetrics.FORMULA_O2O;
      else if (ctx.active_pack === "governance")
        formula.textContent =
          "图例标题「数据质量」≠ 经营色\n处理：主数据入口/围栏/路网距\n不处理：终端 GPS 漂移";
      else formula.textContent = LBSMetrics.FORMULA_GENERIC;
    }

    if (!tbody) return;
    tbody.innerHTML = "";

    // clear siting host if leaving energy siting
    const sitingHost = $("siting-host");
    if (sitingHost && !(ctx.active_pack === "energy" && ctx.siting_open)) {
      sitingHost.innerHTML = "";
      sitingHost.style.display = "none";
    }

    if (ctx.active_pack === "energy") {
      // energy uses dedicated panel; still allow zone gap rows under siting
      if (ctx.siting_open && ctx.siting_zone_id) {
        /* fall through after board for siting host */
      } else {
        paintEnergyBoard(ctx);
        return;
      }
      paintEnergyBoard(ctx);
      if (ctx.siting_open && ctx.siting_zone_id) renderSitingHost(ctx.siting_zone_id);
      return;
    }

    if (ctx.active_pack === "governance") {
      const note = document.createElement("tr");
      note.innerHTML =
        "<td colspan='3'><div class='gov-banner'>图例 · <strong>数据质量</strong>（紫 P0 / 琥珀 P1）· 与经营缺口红分色<br/>边界：<strong>不处理终端 GPS 漂移</strong></div></td>";
      tbody.appendChild(note);
      if (!qualityIssues.length) {
        const tr = document.createElement("tr");
        tr.innerHTML = "<td colspan='3'>暂无问题实体</td>";
        tbody.appendChild(tr);
        return;
      }
      qualityIssues.slice(0, 40).forEach(function (iss) {
        const tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" +
          iss.display_name +
          "</td><td><span class='pill " +
          (iss.severity === "P0" ? "hi" : "mid") +
          "'>" +
          iss.severity +
          "</span> " +
          iss.code +
          "</td><td>" +
          iss.title +
          "</td>";
        tr.addEventListener("click", function () {
          if (iss.lat != null) mapApp.focusLatLng(iss.lat, iss.lng, 15);
          window.__lastIssue = iss;
          AppContext.set({ selected_entity: iss.issue_id, side_panel: "list" });
        });
        tbody.appendChild(tr);
      });
      return;
    }

    if (ctx.active_pack === "o2o" && ctx.storeFocusMode && ctx.storeFocusId) {
      const ent = storeById.get(ctx.storeFocusId);
      const tr = document.createElement("tr");
      tr.className = "sel";
      tr.innerHTML =
        "<td colspan='3'><strong>" +
        ((ent && ent.name) || ctx.storeFocusId) +
        "</strong> · 单店聚焦中<br/>" +
        "<button type='button' class='linkish' id='btn-exit-focus-list'>退出聚焦</button> · " +
        "覆盖 " +
        LBSMetrics.storeCoverageM(ent) +
        "m · 围栏示意</td>";
      tbody.appendChild(tr);
      setTimeout(function () {
        const b = $("btn-exit-focus-list");
        if (b)
          b.onclick = function () {
            AppContext.set({ storeFocusId: null, storeFocusMode: false });
          };
      }, 0);
      // still show nearby retail zones for客流
      const list = computeZoneList(ctx)
        .filter(function (x) {
          return x.ok;
        })
        .sort(function (a, b) {
          return b.demand - a.demand;
        })
        .slice(0, 8);
      list.forEach(function (r) {
        const row = document.createElement("tr");
        row.innerHTML =
          "<td>" +
          (r.name || r.zone_id) +
          "</td><td>" +
          (r.zone_type || "—") +
          "</td><td><span class='pill lo'>客流 " +
          r.demand.toFixed(0) +
          "</span></td>";
        row.addEventListener("click", function () {
          AppContext.set({ selected_zone_id: r.zone_id });
        });
        tbody.appendChild(row);
      });
      return;
    }

    const list = computeZoneList(ctx);
    let rows = [];
    if (ctx.active_pack === "o2o") {
      rows = list
        .filter(function (x) {
          return x.ok;
        })
        .sort(function (a, b) {
          return b.demand - a.demand;
        })
        .slice(0, 20)
        .map(function (x) {
          return Object.assign({}, x, { action: "focus_store", display: x.demand });
        });
    } else {
      rows = LBSMetrics.topShortage(list, 20);
    }

    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td colspan='3'>当前切片无列表数据</td>";
      tbody.appendChild(tr);
      return;
    }

    rows.forEach(function (r) {
      const tr = document.createElement("tr");
      if (ctx.selected_zone_id === r.zone_id) tr.className = "sel";
      const metric =
        ctx.active_pack === "o2o"
          ? "客流 " + (r.demand != null ? r.demand.toFixed(1) : "—")
          : r.gap != null
            ? "gap " + r.gap.toFixed(1)
            : "d " + (r.demand != null ? r.demand.toFixed(1) : "—");
      const pill =
        r.gap != null && r.gap >= 25
          ? "hi"
          : r.gap != null && r.gap >= 10
            ? "mid"
            : ctx.active_pack === "o2o"
              ? "mid"
              : "lo";
      let extra = "";
      if (ctx.active_pack === "energy") {
        extra =
          " <button type='button' class='linkish btn-site' data-zid='" +
          r.zone_id +
          "'>发起选址</button>";
      }
      if (ctx.active_pack === "fulfillment") {
        const er = LBSMetrics.etaRadiusM(
          1800,
          (ctx.congestion && ctx.congestion.difficulty_coeff) || r.difficulty || 1
        );
        extra = " <span class='tag monitor'>圈~" + er + "m</span>";
      }
      if (ctx.active_pack === "o2o") {
        extra =
          " <button type='button' class='linkish btn-focus-zone' data-zid='" +
          r.zone_id +
          "'>区内门店</button>";
      }
      tr.innerHTML =
        "<td>" +
        (r.name || r.zone_id) +
        "</td><td>" +
        (r.zone_type || "—") +
        "</td><td><span class='pill " +
        pill +
        "'>" +
        metric +
        "</span> " +
        (r.action && ctx.active_pack !== "o2o"
          ? "<span class='tag " + r.action + "'>" + r.action + "</span>"
          : "") +
        extra +
        "</td>";
      tr.addEventListener("click", function (ev) {
        if (
          ev.target &&
          (ev.target.classList.contains("btn-site") ||
            ev.target.classList.contains("btn-focus-zone"))
        )
          return;
        AppContext.set({ selected_zone_id: r.zone_id, side_panel: "list" });
        const z = zoneById.get(r.zone_id);
        if (z) mapApp.focusLatLng(z.centroid_lat, z.centroid_lng, 13);
      });
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-site").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        openSiting(btn.getAttribute("data-zid"));
      });
    });
    tbody.querySelectorAll(".btn-focus-zone").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        focusFirstStoreInZone(btn.getAttribute("data-zid"));
      });
    });

    if (ctx.active_pack === "energy" && ctx.siting_open && ctx.siting_zone_id) {
      renderSitingHost(ctx.siting_zone_id);
    }
  }

  function focusFirstStoreInZone(zid) {
    const st = storeList().filter(function (e) {
      return e.zone_id === zid;
    });
    if (!st.length) {
      AppContext.set({ selected_zone_id: zid });
      setStatus("该商圈暂无挂接门店点，已选中区面");
      return;
    }
    const ent = st[0];
    AppContext.set({
      storeFocusId: ent.entity_id,
      storeFocusMode: true,
      selected_entity: ent.entity_id,
      selected_zone_id: zid
    });
    mapApp.focusLatLng(ent.lat, ent.lng, 15);
    setStatus("单店聚焦 · " + (ent.name || ent.entity_id));
  }

  function openSiting(zoneId) {
    if (AppContext.get().active_pack !== "energy") {
      AppContext.switchPack("energy");
    }
    AppContext.set({
      siting_open: true,
      siting_zone_id: zoneId,
      selected_zone_id: zoneId
    });
    const z = zoneById.get(zoneId);
    if (z) mapApp.focusLatLng(z.centroid_lat, z.centroid_lng, 13);
    setStatus("S5 选址 · R=1.5km · " + zoneId);
  }

  function renderSitingHost(zoneId) {
    let host = $("siting-host");
    if (!host) {
      const wrap = $("panel-list");
      if (!wrap) return;
      host = document.createElement("div");
      host.id = "siting-host";
      host.className = "siting-host";
      wrap.insertBefore(host, wrap.firstChild);
    }
    host.style.display = "";
    const list = computeZoneList(AppContext.get());
    const row = list.find(function (x) {
      return x.zone_id === zoneId;
    });
    if (!row) {
      host.innerHTML = "<div class='err'>缺口区无指标</div>";
      return;
    }
    const scored = LBSMetrics.scoreSitingCandidates(
      row,
      zoneById,
      list,
      chargerList()
    );
    lastSiting = scored;
    if (!scored) {
      host.innerHTML = "<div class='err'>无法评分</div>";
      return;
    }
    const w = scored.weights;
    let html =
      "<div class='siting-card'>" +
      "<div class='siting-head'><strong>S5 选址 · R=1.5km</strong>" +
      "<button type='button' id='btn-close-siting' class='linkish'>关闭</button></div>" +
      "<div class='meta'>缺口区 <code>" +
      zoneId +
      "</code> · 权重 D" +
      w.demand +
      "/G" +
      w.supply_gap +
      "/C" +
      w.competition +
      "/A" +
      w.access +
      "/反蚕食" +
      w.anti_cannibal +
      " · 非 ML</div>" +
      "<div class='siting-verdict'>" +
      scored.one_liner +
      "</div>";
    scored.results.forEach(function (r) {
      const win = r.cand_id === scored.winner ? " win" : "";
      html +=
        "<div class='cand" +
        win +
        "'><div><b>" +
        r.label +
        (win ? " · 推荐" : "") +
        "</b> <span class='pill hi'>" +
        r.total.toFixed(1) +
        "</span></div>" +
        "<div class='meta'>D " +
        r.subscores.demand +
        " · Gap " +
        r.subscores.supply_gap +
        " · Comp " +
        r.subscores.competition +
        " · Acc " +
        r.subscores.access +
        " · 反蚕食 " +
        r.subscores.anti_cannibal +
        "</div>" +
        "<p class='reason'>" +
        r.reason_text +
        "</p></div>";
    });
    html += "</div>";
    host.innerHTML = html;
    const close = $("btn-close-siting");
    if (close)
      close.onclick = function () {
        lastSiting = null;
        AppContext.set({ siting_open: false, siting_zone_id: null });
      };
    if (mapApp) mapApp.setSitingMarkers(scored.results, scored.winner);
  }

  function paintRoadPanel(ctx) {
    const name = $("rd-name");
    const grade = $("rd-grade");
    const cong = $("rd-cong");
    const rctx = $("rd-ctx");
    const impact = $("rd-impact");
    const zones = $("rd-zones");
    if (!ctx.selected_road_id) {
      if (name) name.textContent = "未选中路段";
      if (grade) grade.textContent = "点击地图上的道路";
      if (cong) cong.textContent = "—";
      if (rctx) rctx.textContent = "—";
      if (impact) {
        impact.className = "impact";
        impact.textContent =
          "选中路段后，这里用业务语言说明：拥堵如何抬高出行等待、压缩履约时效圈、影响补能到达。";
      }
      if (zones) zones.textContent = "—";
      return;
    }
    // details filled on click via lastRoadDetail
    if (window.__lastRoadDetail) {
      const d = window.__lastRoadDetail;
      if (name) name.textContent = d.name;
      if (grade) grade.textContent = d.grade;
      if (cong) cong.textContent = d.congLabel + "（整段一色）";
      if (rctx) rctx.textContent = d.scene || "—";
      if (impact) {
        impact.className =
          "impact " + (d.cong >= 0.65 ? "bad" : d.cong >= 0.4 ? "warn" : "");
        impact.textContent = d.impact;
      }
      if (zones) zones.textContent = d.zones || "邻近功能区（示意关联）";
    }
  }

  function paintDetail(ctx) {
    const box = $("detail-zone");
    if (!box) return;

    if (ctx.active_pack === "governance" && window.__lastIssue) {
      const iss = window.__lastIssue;
      box.innerHTML =
        "<h3>" +
        iss.display_name +
        "</h3>" +
        "<div class='k'>等级 / 码</div><div class='v'>" +
        iss.severity +
        " · " +
        iss.code +
        " · " +
        iss.title +
        "</div>" +
        "<div class='k'>说明</div><div class='v'>" +
        iss.detail +
        "</div>" +
        "<div class='gov-banner'>边界：不处理终端 GPS 漂移（out_of_scope=" +
        iss.out_of_scope +
        "）· 图例「数据质量」</div>";
      return;
    }

    if (ctx.storeFocusMode && ctx.storeFocusId) {
      const ent = storeById.get(ctx.storeFocusId);
      const cov = LBSMetrics.storeCoverageM(ent);
      const z = ent && ent.zone_id ? zoneById.get(ent.zone_id) : null;
      const list = computeZoneList(ctx);
      const zm =
        z &&
        list.find(function (x) {
          return x.zone_id === ent.zone_id;
        });
      box.innerHTML =
        "<h3>单店聚焦</h3>" +
        "<div class='k'>门店</div><div class='v'>" +
        ((ent && ent.name) || ctx.storeFocusId) +
        " · " +
        ((ent && ent.store_type) || "—") +
        "</div>" +
        "<div class='k'>覆盖 / 围栏</div><div class='v'>客流圈 " +
        cov +
        "m · 核销围栏 ~" +
        Math.round(cov * 0.55) +
        "m</div>" +
        "<div class='k'>所在商圈客流</div><div class='v'>" +
        ((z && z.name) || (ent && ent.zone_id) || "—") +
        (zm && zm.ok ? " · demand " + zm.demand.toFixed(1) : "") +
        "</div>" +
        "<div class='k'>说明</div><div class='v'>其它店已淡化；地图显示覆盖+围栏。退出后恢复 LOD 门店密度。</div>" +
        "<p style='margin-top:8px'><button type='button' id='btn-exit-focus'>退出聚焦</button></p>";
      const b = $("btn-exit-focus");
      if (b)
        b.onclick = function () {
          AppContext.set({ storeFocusId: null, storeFocusMode: false });
        };
      return;
    }

    if (ctx.active_pack === "fulfillment" && ctx.selected_zone_id) {
      const z = zoneById.get(ctx.selected_zone_id);
      const list = computeZoneList(ctx);
      const m = list.find(function (x) {
        return x.zone_id === ctx.selected_zone_id;
      });
      const diff =
        (ctx.congestion && ctx.congestion.difficulty_coeff) ||
        (m && m.difficulty) ||
        1;
      const r = LBSMetrics.etaRadiusM(1800, diff);
      box.innerHTML =
        "<h3>履约 · " +
        ((z && z.name) || ctx.selected_zone_id) +
        "</h3>" +
        (m && m.ok
          ? "<div class='k'>demand / supply / gap</div><div class='v'>" +
            m.demand.toFixed(1) +
            " / " +
            (m.supply != null ? m.supply.toFixed(1) : "—") +
            " / " +
            (m.gap != null ? m.gap.toFixed(1) : "—") +
            "</div>"
          : "") +
        "<div class='k'>时效圈</div><div class='v'>" +
        r +
        "m（难度 ×" +
        Number(diff).toFixed(2) +
        "；雨天/高峰缩小）</div>" +
        "<div class='k'>叙事</div><div class='v'>门店+需求热力+路网默认开。点路段看配送难度；拥堵↑则圈收缩、超时风险↑。</div>";
      return;
    }

    if (ctx.active_pack === "energy" && ctx.selected_zone_id) {
      const z = zoneById.get(ctx.selected_zone_id);
      const list = computeZoneList(ctx);
      const m = list.find(function (x) {
        return x.zone_id === ctx.selected_zone_id;
      });
      box.innerHTML =
        "<h3>能源 · " +
        ((z && z.name) || ctx.selected_zone_id) +
        "</h3>" +
        (m && m.ok
          ? "<div class='k'>chg demand/supply/gap</div><div class='v'>" +
            m.demand.toFixed(1) +
            " / " +
            (m.supply != null ? m.supply.toFixed(1) : "—") +
            " / " +
            (m.gap != null ? m.gap.toFixed(1) : "—") +
            "</div>"
          : "") +
        "<div class='k'>站网</div><div class='v'>小李充电 " +
        chargerCount() +
        " 站 · Synthetic</div>" +
        "<p style='margin-top:8px'><button type='button' class='primary' id='btn-detail-siting'>发起选址</button></p>";
      const bs = $("btn-detail-siting");
      if (bs)
        bs.onclick = function () {
          openSiting(ctx.selected_zone_id);
        };
      return;
    }

    if (ctx.selected_zone_id) {
      const z = zoneById.get(ctx.selected_zone_id);
      const list = computeZoneList(ctx);
      const m = list.find(function (x) {
        return x.zone_id === ctx.selected_zone_id;
      });
      const corr = corridorForZone(z);
      box.innerHTML =
        "<h3>" +
        ((z && z.name) || ctx.selected_zone_id) +
        "</h3>" +
        "<div class='k'>类型 / 分级</div><div class='v'>" +
        ((z && z.zone_type) || "—") +
        " · " +
        ((z && z.grade) || "—") +
        "</div>" +
        (m && m.ok
          ? "<div class='k'>demand / supply / gap</div><div class='v'>" +
            m.demand.toFixed(1) +
            " / " +
            (m.supply != null ? m.supply.toFixed(1) : "—") +
            " / " +
            (m.gap != null ? m.gap.toFixed(1) : "—") +
            "</div>"
          : "") +
        "<div class='k'>" +
        (corr.title || "空间说明") +
        "</div><div class='v'>" +
        (corr.body || "") +
        "</div>";
      return;
    }
    box.innerHTML =
      "<h3>提示</h3><div class='v'>① 路网拥堵/等级/业务难度<br/>② 出行：供需 TopN<br/>③ 到店：点店单店聚焦<br/>④ 履约：时效圈随雨天缩小<br/>⑤ 能源：缺口→选址<br/>⑥ 治理：数据质量分色</div>";
  }

  function corridorForZone(z) {
    const rules = (data.corridor && data.corridor.rules) || [];
    if (!z) {
      return (
        rules.find(function (r) {
          return r.id === "default";
        }) || { title: "", body: "" }
      );
    }
    const labels = z.labels || [];
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      if (r.id === "default") continue;
      if (r.match_labels) {
        for (let j = 0; j < r.match_labels.length; j++) {
          if (labels.indexOf(r.match_labels[j]) >= 0) return r;
        }
      }
      if (r.match_landuse && r.match_landuse.indexOf(z.zone_type) >= 0)
        return r;
    }
    return (
      rules.find(function (r) {
        return r.id === "default";
      }) || { title: "区面", body: z.name || "" }
    );
  }

  function syncChrome(ctx) {
    const a = analysisOf(ctx);
    document.querySelectorAll(".nav button[data-pack]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-pack") === ctx.active_pack);
    });
    if ($("sel-time")) $("sel-time").value = a.time_scenario;
    if ($("sel-weather")) $("sel-weather").value = a.weather;
    if ($("sel-node")) $("sel-node").value = ctx.season_or_node;
    if ($("trend-wd"))
      $("trend-wd").classList.toggle("on", (ctx.trend_series || "weekday") === "weekday");
    if ($("trend-we"))
      $("trend-we").classList.toggle("on", ctx.trend_series === "weekend");
    document.querySelectorAll("[data-rm]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-rm") === ctx.roadDisplayMode);
    });
    document.querySelectorAll("[data-heat]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-heat") === ctx.heatRenderMode);
    });
    const ls = ctx.layer_set || [];
    if ($("ly-basemap")) $("ly-basemap").checked = ls.indexOf("basemap") >= 0;
    if ($("ly-water")) $("ly-water").checked = ls.indexOf("water") >= 0;
    if ($("ly-road"))
      $("ly-road").checked =
        ls.indexOf("roads") >= 0 || ls.indexOf("road_cong") >= 0;
    if ($("ly-zone")) $("ly-zone").checked = ls.indexOf("zones") >= 0;
    if ($("ly-heat")) $("ly-heat").checked = ls.indexOf("heat") >= 0;
    if ($("ly-overlay"))
      $("ly-overlay").checked =
        ls.indexOf("overlay") >= 0 || ls.indexOf("fence") >= 0;
    if ($("legend-float") && $("ly-legend")) {
      $("legend-float").classList.toggle("hidden", !$("ly-legend").checked);
    }
    if ($("ly-poi")) {
      $("ly-poi").checked =
        ls.indexOf("stores") >= 0 ||
        ls.indexOf("chargers") >= 0 ||
        ls.indexOf("quality") >= 0;
      const lab = $("ly-poi").parentElement;
      if (lab) {
        const nodes = lab.childNodes;
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].nodeType === 3) {
            nodes[i].textContent =
              ctx.active_pack === "energy"
                ? " 小李充电"
                : ctx.active_pack === "governance"
                  ? " 质量点"
                  : " 站/店实体";
          }
        }
      }
    }
    document.querySelectorAll(".side-tabs button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-panel") === ctx.side_panel);
    });
    const tabE = $("tab-energy");
    if (tabE) {
      if (ctx.active_pack === "energy") tabE.classList.remove("hidden");
      else tabE.classList.add("hidden");
    }
    if (ctx.active_pack === "energy") {
      const showE = ctx.side_panel !== "road";
      if ($("panel-energy"))
        $("panel-energy").classList.toggle("hidden", !showE);
      if ($("panel-list")) $("panel-list").classList.add("hidden");
      if ($("panel-road"))
        $("panel-road").classList.toggle("hidden", ctx.side_panel !== "road");
    } else {
      if ($("panel-energy")) $("panel-energy").classList.add("hidden");
      if ($("panel-list"))
        $("panel-list").classList.toggle("hidden", ctx.side_panel !== "list");
      if ($("panel-road"))
        $("panel-road").classList.toggle("hidden", ctx.side_panel !== "road");
    }
    if ($("scene-badge")) {
      const a2 = analysisOf(ctx);
      $("scene-badge").innerHTML =
        "<code>" +
        a2.time_scenario +
        "×" +
        a2.weather +
        "</code> · " +
        ctx.active_pack;
    }
    const lt = $("legend-title");
    const lb = $("legend-body");
    if (lt && lb) {
      if (ctx.active_pack === "governance") {
        lt.textContent = "图例 · 数据质量（≠经营色）";
        lb.innerHTML =
          "<span><i class='sw' style='background:#a855f7'></i>P0 主数据</span>" +
          "<span><i class='sw' style='background:#f59e0b'></i>P1 入口/路网</span>";
      } else if (ctx.roadDisplayMode === "grade") {
        lt.textContent = "图例 · 道路等级";
        lb.innerHTML =
          "<span><i class='sw' style='background:#38bdf8'></i>快速/高速</span>" +
          "<span><i class='sw' style='background:#60a5fa'></i>主干</span>" +
          "<span><i class='sw' style='background:#94a3b8'></i>次干</span>" +
          "<span><i class='sw' style='background:#64748b'></i>三级</span>";
      } else if (ctx.roadDisplayMode === "biz") {
        lt.textContent = "图例 · 业务难度";
        lb.innerHTML =
          "<span><i class='sw' style='background:#3dd68c'></i>易匹配</span>" +
          "<span><i class='sw' style='background:#e6c07b'></i>承压</span>" +
          "<span><i class='sw' style='background:#f07178'></i>高难度</span>";
      } else {
        lt.textContent = "图例 · 路况四档（CI）";
        lb.innerHTML =
          "<span><i class='sw' style='background:#3dd68c'></i>畅通</span>" +
          "<span><i class='sw' style='background:#e6c07b'></i>缓慢</span>" +
          "<span><i class='sw' style='background:#fb923c'></i>拥堵</span>" +
          "<span><i class='sw' style='background:#f07178'></i>严重</span>";
      }
    }
  }

  function paintTrend(ctx) {
    const svg = $("trend-svg");
    if (!svg || !data || !data.ci_series_24h) return;
    const seriesKey =
      ctx.trend_series === "weekend" ? "weekend" : "weekday";
    const series = data.ci_series_24h[seriesKey];
    if (!series || !series.city_CI) return;
    const vals = series.city_CI.slice();
    const a = analysisOf(ctx);
    const wf =
      (data.scenario_ci &&
        data.scenario_ci.weather_f &&
        data.scenario_ci.weather_f[a.weather]) ||
      1;
    const scaled = vals.map(function (v) {
      return v * wf;
    });
    const w = 280;
    const h = 72;
    const pad = 8;
    const minV = 0.8;
    const maxV = 2.4;
    const n = scaled.length;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const x = pad + (i / (n - 1)) * (w - pad * 2);
      const t = (scaled[i] - minV) / (maxV - minV);
      const y = h - pad - Math.max(0, Math.min(1, t)) * (h - pad * 2);
      pts.push([x, y]);
    }
    let dLine = "";
    let dArea = "";
    pts.forEach(function (p, i) {
      dLine += (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1) + " ";
    });
    dArea =
      dLine +
      "L" +
      pts[n - 1][0].toFixed(1) +
      "," +
      (h - pad) +
      " L" +
      pts[0][0].toFixed(1) +
      "," +
      (h - pad) +
      " Z";
    // cursor: first hour mapped to current time_scenario
    let curH = 18;
    const mapH = series.time_scenario_by_hour || [];
    for (let i = 0; i < mapH.length; i++) {
      if (mapH[i] === a.time_scenario) {
        curH = i;
        break;
      }
    }
    const cx = pad + (curH / (n - 1)) * (w - pad * 2);
    const cy = pts[curH] ? pts[curH][1] : h / 2;
    svg.innerHTML =
      '<path class="trend-area" d="' +
      dArea +
      '"/>' +
      '<path class="trend-line" d="' +
      dLine +
      '"/>' +
      '<line class="trend-cursor" x1="' +
      cx.toFixed(1) +
      '" y1="' +
      pad +
      '" x2="' +
      cx.toFixed(1) +
      '" y2="' +
      (h - pad) +
      '"/>' +
      '<circle class="trend-dot" cx="' +
      cx.toFixed(1) +
      '" cy="' +
      cy.toFixed(1) +
      '" r="3.5"/>' +
      '<text x="8" y="10">CI</text>' +
      '<text x="250" y="70">24h</text>';
    if ($("trend-foot")) {
      $("trend-foot").textContent =
        timeLabel(a.time_scenario) +
        " · " +
        weatherLabel(a.weather) +
        " · 竖线=当前档 · 点击曲线切换时间";
    }
    svg.onclick = function (ev) {
      const rect = svg.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * w;
      const idx = Math.round(((x - pad) / (w - pad * 2)) * (n - 1));
      const i = Math.max(0, Math.min(n - 1, idx));
      const ts =
        (mapH[i] && LBSMetrics.normalizeTimeScenario(mapH[i])) ||
        a.time_scenario;
      AppContext.setAnalysisScene(ts, a.weather);
    };
  }

  let suppressCongWrite = false;
  let lastSceneKey = "";

  function onState(ctx) {
    // re-run isochrone when analysis_scene changes with a selected site
    const sk =
      (ctx.analysis_scene &&
        ctx.analysis_scene.time_scenario + "|" + ctx.analysis_scene.weather) ||
      "";
    if (
      ctx.active_pack === "energy" &&
      ctx.selected_site_id &&
      sk &&
      sk !== lastSceneKey &&
      !accessBusy
    ) {
      lastSceneKey = sk;
      const site = siteById.get(ctx.selected_site_id);
      if (site) runSiteAccess(site);
    } else if (sk) {
      lastSceneKey = sk;
    }

    if (!suppressCongWrite && data) {
      const bundle = sceneBundle(ctx);
      const cityCi = bundle.congestion_index;
      const share = Math.min(
        0.95,
        Math.max(0.08, (cityCi - 0.9) / 1.8)
      );
      const narrative = buildNarrative(
        ctx,
        bundle.difficulty,
        share,
        cityCi
      );
      const prev = ctx.congestion || {};
      if (
        prev.difficulty_coeff !== bundle.difficulty ||
        prev.city_ci !== cityCi ||
        prev.narrative !== narrative
      ) {
        suppressCongWrite = true;
        AppContext.set({
          congestion: {
            share_blocked: share,
            difficulty_coeff: bundle.difficulty,
            narrative: narrative,
            city_ci: cityCi
          }
        });
        suppressCongWrite = false;
        return;
      }
    }
    syncChrome(ctx);
    paintStory(ctx);
    paintTrend(ctx);
    paintMap(ctx);
    paintList(ctx);
    paintRoadPanel(ctx);
    paintDetail(ctx);
  }

  function bindUi() {
    document.querySelectorAll(".nav button[data-pack]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        AppContext.switchPack(btn.getAttribute("data-pack"));
        setStatus("已切换 · " + (PACK_LABEL[btn.getAttribute("data-pack")] || ""));
      });
    });
    function applyTwoCards() {
      const ts = ($("sel-time") && $("sel-time").value) || "wd_pm_peak";
      const w = ($("sel-weather") && $("sel-weather").value) || "clear";
      AppContext.setAnalysisScene(ts, w);
    }
    if ($("sel-time")) $("sel-time").onchange = applyTwoCards;
    if ($("sel-weather")) $("sel-weather").onchange = applyTwoCards;
    if ($("sel-node"))
      $("sel-node").onchange = function () {
        AppContext.set({ season_or_node: $("sel-node").value });
      };
    document.querySelectorAll("[data-rm]").forEach(function (b) {
      b.addEventListener("click", function () {
        AppContext.set({ roadDisplayMode: b.getAttribute("data-rm") });
      });
    });
    document.querySelectorAll("[data-heat]").forEach(function (b) {
      b.addEventListener("click", function () {
        AppContext.set({ heatRenderMode: b.getAttribute("data-heat") });
      });
    });
    if ($("trend-wd"))
      $("trend-wd").onclick = function () {
        AppContext.set({ trend_series: "weekday" });
      };
    if ($("trend-we"))
      $("trend-we").onclick = function () {
        AppContext.set({ trend_series: "weekend" });
      };
    function layerPatch() {
      const ctx = AppContext.get();
      const set = [];
      if ($("ly-basemap") && $("ly-basemap").checked) set.push("basemap");
      if ($("ly-water") && $("ly-water").checked) set.push("water");
      if ($("ly-road") && $("ly-road").checked) {
        set.push("roads");
        set.push("road_cong");
      }
      if ($("ly-zone") && $("ly-zone").checked) set.push("zones");
      if ($("ly-heat") && $("ly-heat").checked) set.push("heat");
      if ($("ly-overlay") && $("ly-overlay").checked) {
        set.push("overlay");
        if (ctx.active_pack === "o2o") set.push("fence");
      }
      if ($("ly-poi") && $("ly-poi").checked) {
        if (ctx.active_pack === "energy") set.push("chargers");
        else if (ctx.active_pack === "governance") set.push("quality");
        else set.push("stores");
      }
      AppContext.set({ layer_set: set });
      if ($("legend-float") && $("ly-legend")) {
        $("legend-float").classList.toggle("hidden", !$("ly-legend").checked);
      }
    }
    [
      "ly-basemap",
      "ly-water",
      "ly-road",
      "ly-zone",
      "ly-heat",
      "ly-poi",
      "ly-overlay",
      "ly-legend"
    ].forEach(function (id) {
      if ($(id)) $(id).onchange = layerPatch;
    });
    document.querySelectorAll(".side-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        AppContext.set({ side_panel: b.getAttribute("data-panel") });
      });
    });
    if ($("btn-export")) $("btn-export").onclick = exportSnapshot;
    if ($("energy-sort"))
      $("energy-sort").onchange = function () {
        energySortKey = $("energy-sort").value;
        if (AppContext.get().active_pack === "energy") {
          paintEnergyBoard(AppContext.get());
        }
      };
    if ($("btn-energy-compare"))
      $("btn-energy-compare").onclick = function () {
        const ctx = AppContext.get();
        const sid = ctx.selected_site_id;
        if (!sid) {
          setStatus("请先点选一座站再做情景Δ");
          return;
        }
        const site = siteById.get(sid);
        if (site) runSceneCompare(site);
      };
    // 镜头 = 仅 flyTo，禁止改 analysis_scene
    if ($("btn-lens-lz"))
      $("btn-lens-lz").onclick = function () {
        mapApp.focusLatLng(31.239, 121.495, 13);
        setStatus("镜头 · 陆家嘴（未改 analysis_scene）");
      };
    if ($("btn-lens-hq"))
      $("btn-lens-hq").onclick = function () {
        mapApp.focusLatLng(31.194, 121.32, 13);
        setStatus("镜头 · 虹桥（未改 analysis_scene）");
      };
    if ($("btn-lens-lg"))
      $("btn-lens-lg").onclick = function () {
        mapApp.focusLatLng(30.907, 121.933, 12);
        setStatus("镜头 · 临港（未改 analysis_scene）");
      };
  }

  function exportSnapshot() {
    const ctx = AppContext.get();
    const list = computeZoneList(ctx);
    const top = LBSMetrics.topShortage(list, 50);
    const snapId =
      "snap_" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      "_" +
      (ctx.analysis_scene
        ? ctx.analysis_scene.time_scenario + "_" + ctx.analysis_scene.weather
        : ctx.scenario);
    AppContext.set({ snapshot_id: snapId });
    const payload = {
      snapshot_id: snapId,
      exported_at: new Date().toISOString(),
      synthetic: true,
      brand_note: "小李* · no employer site names",
      formula:
        ctx.active_pack === "energy"
          ? LBSMetrics.FORMULA_CHG
          : LBSMetrics.FORMULA_RIDE,
      context: AppContext.exportContext(),
      energy:
        ctx.active_pack === "energy"
          ? {
              selected_site_id: ctx.selected_site_id,
              kpi: energyKpis(ctx),
              access: lastAccessResult
                ? {
                    ok: lastAccessResult.ok,
                    stats: lastAccessResult.stats,
                    warnings: lastAccessResult.warnings,
                    cover_10: LBSAccess.countInBand(lastAccessResult, 10),
                    cover_15: LBSAccess.countInBand(lastAccessResult, 15)
                  }
                : null,
              compare: lastAccessCompare
                ? {
                    scene_a: lastAccessCompare.scene_a,
                    scene_b: lastAccessCompare.scene_b,
                    coverage_count_a: lastAccessCompare.coverage_count_a,
                    coverage_count_b: lastAccessCompare.coverage_count_b,
                    delta_coverage_count: lastAccessCompare.delta_coverage_count,
                    advice: lastAccessCompare
                      ? LBSAccess.adviceTemplate(
                          siteById.get(ctx.selected_site_id) || {},
                          lastAccessCompare,
                          null
                        )
                      : null
                  }
                : null
            }
          : null,
      rows: top.map(function (r) {
        return {
          zone_id: r.zone_id,
          name: r.name,
          demand: round2(r.demand),
          supply: r.supply != null ? round2(r.supply) : null,
          gap: r.gap != null ? round2(r.gap) : null,
          action: r.action,
          zone_type: r.zone_type,
          difficulty: r.difficulty
        };
      })
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = snapId + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
    setStatus("已导出 " + a.download);
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function nearestZones(latlng, n) {
    if (!latlng) return [];
    const arr = [];
    zoneById.forEach(function (z) {
      const d =
        Math.pow(z.centroid_lat - latlng[0], 2) +
        Math.pow(z.centroid_lng - latlng[1], 2);
      arr.push({ z: z, d: d });
    });
    arr.sort(function (a, b) {
      return a.d - b.d;
    });
    return arr.slice(0, n || 3).map(function (x) {
      return x.z.name;
    });
  }

  async function boot() {
    setStatus("加载数据…");
    bindUi();
    const amapKey = (cfg().amapKey || "").trim();
    mapApp = LBSMap.createMapApp("map", {
      amapKey: amapKey,
      onBasemapFallback: function (reason) {
        showBanner(
          "高德瓦片加载异常（" +
            reason +
            "）。请检查网络或在 public/config.local.js 填写 amapKey 后 Ctrl+F5。可在左侧关闭「高德底图」仅看业务层。",
          true
        );
      },
      onZoom: function (z) {
        const lod = LBSMetrics.lodFromZoom(z);
        if (AppContext.get().lodLevel !== lod) {
          AppContext.set({ lodLevel: lod });
        } else {
          const ctx = AppContext.get();
          const a = analysisOf(ctx);
          const bundle = sceneBundle(ctx);
          mapApp.rebuildRoads({
            mode: ctx.roadDisplayMode,
            lod: lod,
            cityIndex: bundle.congestion_index,
            weather: a.weather,
            tod: a.time_scenario,
            time_scenario: a.time_scenario,
            difficulty: bundle.difficulty,
            scenarioCi: data && data.scenario_ci,
            anchorsDoc: data && data.typical_road_anchors,
            show: true
          });
        }
      }
    });

    if (!amapKey) {
      showBanner(
        "未配置高德 Key（public/config.local.js 的 amapKey 为空）。已优先试高德瓦片；不稳定时请填开放平台 Key 后 Ctrl+F5。",
        true
      );
    }

    try {
      data = await LBSData.loadCore();
    } catch (e) {
      console.error(e);
      showBanner(
        "无法加载 public/data/*。请 npm run copy:public-data 后 npm run serve。",
        true
      );
      setStatus("数据加载失败");
      return;
    }

    zonesGeo = data.zonesGeo;
    const zlist =
      (data.zonesMeta && data.zonesMeta.zones) ||
      (zonesGeo &&
        zonesGeo.features &&
        zonesGeo.features.map(function (f) {
          return f.properties;
        })) ||
      [];
    zlist.forEach(function (z) {
      if (z && z.zone_id) zoneById.set(z.zone_id, z);
    });

    // QC banner
    const qcOk =
      data.manifest &&
      (data.manifest.roads_qc_pass === true ||
        data.manifest.road_features > 1000);
    if (!qcOk) {
      showBanner("路网分析状态未知：请确认 roads QC。仍可浏览底图与区面。", true);
    }

    mapApp.setWater(data.water);
    mapApp.setZones(zonesGeo, { showType: true });
    if (data.roads) mapApp.setRoads(data.roads);
    mapApp.map.setView([31.23, 121.48], 12);

    mapApp.setHandlers({
      onRoadClick: function (id, props, cong, _f, ll, meta) {
        const ctx = AppContext.get();
        const a = analysisOf(ctx);
        const bundle = sceneBundle(ctx);
        const hw = props.highway || "";
        const m =
          meta ||
          LBSMetrics.wayCI(props, {
            scenarioCi: data.scenario_ci,
            anchorsDoc: data.typical_road_anchors,
            time_scenario: a.time_scenario,
            weather: a.weather
          });
        const gradeLabel =
          hw +
          (props.ref ? " / " + props.ref : "") +
          (m.anchor ? " · 锚点「" + m.anchor.label_zh + "」" : "");
        const band = LBSMetrics.congClassLabel(m.cong_class);
        const names = nearestZones(ll || [31.23, 121.48], 3);
        window.__lastRoadDetail = {
          name: props.name || props.ref || "osm:" + id,
          grade: gradeLabel,
          cong: cong,
          congLabel:
            band +
            " · CI " +
            m.ci.toFixed(2) +
            " · ~" +
            m.speed_kmh.toFixed(0) +
            " km/h（合成）",
          impact: LBSMetrics.roadImpactCopy(
            cong,
            gradeLabel,
            bundle.difficulty,
            ctx.active_pack,
            m
          ),
          zones: names.join("、") || "—",
          scene:
            timeLabel(a.time_scenario) + " · " + weatherLabel(a.weather)
        };
        AppContext.set({
          selected_road_id: id,
          side_panel: "road"
        });
        mapApp.highlightRoad(id);
      },
      onZoneClick: function (zid) {
        AppContext.set({ selected_zone_id: zid, side_panel: "list" });
      },
      onStoreClick: function (ent) {
        const pack = AppContext.get().active_pack;
        if (pack === "governance") {
          const iss = qualityIssues.find(function (x) {
            return x.issue_id === ent.entity_id || x.entity_id === ent.entity_id;
          });
          if (iss) {
            window.__lastIssue = iss;
            AppContext.set({ selected_entity: iss.issue_id });
          }
          return;
        }
        if (pack === "energy") {
          const sid = ent.site_id || ent.entity_id;
          selectEnergySite(sid);
          return;
        }
        // o2o / fulfillment → single-store focus
        if (pack !== "o2o") AppContext.switchPack("o2o");
        AppContext.set({
          storeFocusId: ent.entity_id,
          storeFocusMode: true,
          selected_entity: ent.entity_id,
          selected_zone_id: ent.zone_id || AppContext.get().selected_zone_id
        });
        if (ent.lat != null) mapApp.focusLatLng(ent.lat, ent.lng, 15);
        setStatus("单店聚焦 · " + (ent.name || ent.entity_id));
      }
    });

    AppContext.subscribe(function (ctx) {
      if (!data) return;
      onState(ctx);
    });

    // index stores + sites + quality mock
    storeList().forEach(function (e) {
      if (e && e.entity_id) storeById.set(e.entity_id, e);
    });
    chargerList().forEach(function (e) {
      const id = e.site_id || e.entity_id;
      if (id) siteById.set(id, e);
    });
    qualityIssues = LBSMetrics.mockQualityIssues(storeList(), chargerList());

    AppContext.setAnalysisScene("wd_pm_peak", "clear");
    AppContext.switchPack("overview");
    onState(AppContext.get());

    // zone geometry debt banner (05.2: should be road-hugged polygons)
    const gm =
      (data.zonesMeta && data.zonesMeta.by_geometry_method) || {};
    const hull = gm.road_convex_hull || 0;
    const fb = gm.irregular_fallback || 0;
    if (fb > hull * 0.25) {
      showBanner(
        "区面几何债：fallback 过多（hull=" +
          hull +
          " fallback=" +
          fb +
          "），部分仍可能像圆泡。数据见 HANDOFF-B-zones。",
        true
      );
    }
    if (!data.scenario_ci || !data.ci_series_24h) {
      showBanner(
        "缺少 scenario_ci / ci_series_24h：路色与趋势用默认表。请 npm run copy:public-data。",
        true
      );
    }

    if ($("synth-note")) {
      $("synth-note").textContent =
        data.manifest && data.manifest.synthetic
          ? "Synthetic · 小李* · 店" +
            storeCount() +
            "/充" +
            chargerCount() +
            " · 无雇主站名"
          : "Synthetic";
    }
    const sitesN =
      (data.chargers && (data.chargers.site_count || data.chargers.count)) ||
      chargerCount();
    setStatus(
      "就绪 · zones " +
        zoneById.size +
        " · 站 " +
        sitesN +
        " · roads " +
        ((data.roads && data.roads.features && data.roads.features.length) || 0) +
        " · 05.2 两卡情景"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
