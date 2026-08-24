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

  function computeOpts(ctx) {
    return {
      weatherDoc: data.weather,
      calendarDoc: data.calendar,
      congDoc: data.congestion,
      weather: ctx.weather,
      nodeKey: ctx.season_or_node,
      time_of_day: ctx.time_of_day,
      scene: sceneForPack(ctx.active_pack)
    };
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

  function buildNarrative(ctx, diff, share) {
    const pack = PACK_LABEL[ctx.active_pack] || ctx.active_pack;
    const w = ctx.weather === "rain" ? "雨天" : "晴天";
    const tod =
      ctx.time_of_day === "wd_am_peak"
        ? "早高峰"
        : ctx.time_of_day === "we_aft"
          ? "周末下午"
          : "晚高峰";
    if (ctx.selected_road_id) {
      return (
        pack +
        " · 已选路段：路况与难度系数联动（" +
        w +
        tod +
        "，×" +
        diff.toFixed(2) +
        "）"
      );
    }
    if (ctx.active_pack === "ride") {
      return (
        "出行：" +
        w +
        tod +
        "需求×运力同屏；拥堵抬高匹配难度 ×" +
        diff.toFixed(2) +
        "（拥堵路约 " +
        Math.round(share * 100) +
        "%）"
      );
    }
    if (ctx.active_pack === "fulfillment") {
      return (
        "履约：门店+需求热力+路网；拥堵压缩时效圈（难度 ×" +
        diff.toFixed(2) +
        "）"
      );
    }
    if (ctx.active_pack === "o2o") {
      return "到店：商圈面+门店；点单店进入聚焦，避免千店同亮";
    }
    if (ctx.active_pack === "energy") {
      return "能源：小李充电站网 + 区缺口；路网解释到达走廊";
    }
    if (ctx.active_pack === "governance") {
      return "治理：质量叙事可讲（与经营分色）；不处理终端 GPS 漂移";
    }
    return (
      "总览：底图 + 路网 + 类型区面 + 面热力。点路段读业务难度（" +
      w +
      tod +
      "）"
    );
  }

  function paintStory(ctx) {
    const t = $("story-t");
    const d = $("story-d");
    const sm1 = $("sm-obj");
    const sm2 = $("sm-cong");
    const sm3 = $("sm-diff");
    const cong = ctx.congestion || {};
    if (t) {
      t.textContent =
        (PACK_LABEL[ctx.active_pack] || "") +
        " · 情景" +
        ctx.scenario +
        " · " +
        (ctx.weather === "rain" ? "雨" : "晴");
    }
    if (d) {
      d.textContent =
        cong.narrative ||
        "默认看见路网（拥堵/等级/业务难度）+ 区面 + 面热力。点一条路看右侧「路段分析」。";
    }
    if (sm1) {
      sm1.textContent =
        ctx.selected_road_id
          ? "路段 " + ctx.selected_road_id
          : ctx.selected_zone_id
            ? ctx.selected_zone_id.split(":").slice(-1)[0]
            : ctx.storeFocusId
              ? ctx.storeFocusId
              : "—";
    }
    if (sm2) {
      const sh =
        cong.share_blocked != null
          ? Math.round(cong.share_blocked * 100) + "%"
          : "—";
      sm2.textContent = sh;
    }
    if (sm3) {
      sm3.textContent =
        "×" +
        (cong.difficulty_coeff != null
          ? Number(cong.difficulty_coeff).toFixed(2)
          : "1.00");
    }
  }

  function paintMap(ctx) {
    if (!mapApp || !data) return;
    const layers = ctx.layer_set || [];
    const has = function (k) {
      return layers.indexOf(k) >= 0;
    };

    mapApp.showLayer("water", true);
    mapApp.showLayer("zones", has("zones"));
    mapApp.showLayer("heat", has("heat") || has("heat_grid") || has("heat_kde"));
    mapApp.showLayer("roads", has("roads") || has("road_cong"));
    mapApp.showLayer(
      "points",
      has("stores") || has("chargers") || ctx.storeFocusMode
    );

    if (ctx.selected_zone_id) mapApp.setZoneSelection(ctx.selected_zone_id);

    // heat
    const list = computeZoneList(ctx);
    const byZone = new Map();
    let minG = 0;
    let maxG = 40;
    list.forEach(function (m) {
      if (m.ok && m.gap != null) {
        maxG = Math.max(maxG, m.gap);
        minG = Math.min(minG, m.gap);
      }
    });
    list.forEach(function (m) {
      if (!m.ok) return;
      let val = m.gap;
      if (ctx.active_pack === "o2o") val = m.demand;
      if (ctx.metric_key === "ride_demand") val = m.demand;
      if (ctx.metric_key === "ride_supply") val = m.supply;
      if (val == null) return;
      byZone.set(m.zone_id, {
        value: val,
        fill: LBSMetrics.heatFill(val, 0, Math.max(40, maxG)),
        label:
          (ctx.active_pack === "o2o" ? "demand " : "gap ") +
          Number(val).toFixed(1) +
          (m.supply != null
            ? " · d=" + m.demand.toFixed(0) + " s=" + m.supply.toFixed(0)
            : "")
      });
    });

    const heatMode = ctx.heatRenderMode || "poly";
    if (heatMode === "poly" && (has("heat") || true)) {
      if (has("heat")) mapApp.renderZoneHeat(zonesGeo, byZone);
      else mapApp.clearHeat();
    } else if (heatMode === "grid") {
      ensureFineHeat(ctx, list);
    } else if (heatMode === "kde") {
      const pts = [];
      list.forEach(function (m) {
        const z = zoneById.get(m.zone_id);
        if (!z || !m.ok) return;
        const v = m.gap != null ? m.gap : m.demand;
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

    // roads
    const bundle = LBSMetrics.difficultyBundle(
      data.congestion,
      ctx.weather,
      ctx.time_of_day,
      sceneForPack(ctx.active_pack)
    );
    mapApp.rebuildRoads({
      mode: ctx.roadDisplayMode || "cong",
      lod: ctx.lodLevel || "district",
      cityIndex: bundle.congestion_index,
      weather: ctx.weather,
      tod: ctx.time_of_day,
      difficulty: bundle.difficulty,
      show: has("roads") || has("road_cong")
    });
    if (ctx.selected_road_id) mapApp.highlightRoad(ctx.selected_road_id);

    // points
    if (ctx.active_pack === "energy" || has("chargers")) {
      const ch =
        (data.chargers && (data.chargers.entities || data.chargers)) || [];
      mapApp.setPoints(
        Array.isArray(ch) ? ch : [],
        "charger",
        ctx.lodLevel,
        null
      );
    } else if (
      ctx.active_pack === "o2o" ||
      ctx.active_pack === "fulfillment" ||
      has("stores")
    ) {
      const st =
        (data.stores && (data.stores.entities || data.stores)) || [];
      mapApp.setPoints(
        Array.isArray(st) ? st : [],
        "store",
        ctx.lodLevel,
        ctx.storeFocusMode ? ctx.storeFocusId : null
      );
      if (ctx.storeFocusMode && ctx.storeFocusId) {
        const ent = (Array.isArray(st) ? st : []).find(function (e) {
          return e.entity_id === ctx.storeFocusId;
        });
        if (ent) {
          mapApp.setEtaRing([ent.lat, ent.lng], 1200);
          mapApp.focusLatLng(ent.lat, ent.lng, 15);
        }
      } else if (ctx.active_pack === "fulfillment" && ctx.selected_zone_id) {
        const z = zoneById.get(ctx.selected_zone_id);
        if (z) {
          const r = 1800 / Math.max(0.8, bundle.difficulty);
          mapApp.setEtaRing([z.centroid_lat, z.centroid_lng], r);
        } else mapApp.clearOverlay();
      } else {
        mapApp.clearOverlay();
      }
    } else {
      mapApp.setPoints([], "store", ctx.lodLevel, null);
      mapApp.clearOverlay();
    }
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
            ? "履约缺口"
            : ctx.active_pack === "energy"
              ? "补能缺口"
              : ctx.active_pack === "o2o"
                ? "到店 / 商圈"
                : ctx.active_pack === "governance"
                  ? "治理问题（示意）"
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
      formula.textContent =
        ctx.active_pack === "ride" || ctx.active_pack === "overview"
          ? LBSMetrics.FORMULA_RIDE
          : LBSMetrics.FORMULA_GENERIC;
    }

    if (!tbody) return;
    tbody.innerHTML = "";

    if (ctx.active_pack === "governance") {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td colspan='3'><div class='err' style='margin:0'>治理包最小可讲态：经营/质量分色规则在；不处理终端 GPS。完整问题单见 WS-E 深化。</div></td>";
      tbody.appendChild(tr);
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
          return Object.assign({}, x, { action: "monitor", display: x.demand });
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
        r.gap != null
          ? "gap " + r.gap.toFixed(1)
          : "d " + (r.demand != null ? r.demand.toFixed(1) : "—");
      const pill =
        r.gap != null && r.gap >= 25
          ? "hi"
          : r.gap != null && r.gap >= 10
            ? "mid"
            : "lo";
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
        (r.action
          ? "<span class='tag " + r.action + "'>" + r.action + "</span>"
          : "") +
        "</td>";
      tr.addEventListener("click", function () {
        AppContext.set({ selected_zone_id: r.zone_id, side_panel: "list" });
        const z = zoneById.get(r.zone_id);
        if (z) mapApp.focusLatLng(z.centroid_lat, z.centroid_lng, 13);
      });
      tbody.appendChild(tr);
    });
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
      if (rctx)
        rctx.textContent =
          "情景" +
          ctx.scenario +
          " · " +
          ctx.weather +
          " · " +
          ctx.time_of_day;
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
    if (ctx.storeFocusMode && ctx.storeFocusId) {
      box.innerHTML =
        "<h3>单店聚焦</h3><div class='k'>门店</div><div class='v'>" +
        ctx.storeFocusId +
        "</div><div class='k'>说明</div><div class='v'>主要渲染该店 + 覆盖圈；其它店已淡化。点「退出聚焦」返回 LOD。</div>" +
        "<p style='margin-top:8px'><button type='button' id='btn-exit-focus'>退出聚焦</button></p>";
      const b = $("btn-exit-focus");
      if (b)
        b.onclick = function () {
          AppContext.set({ storeFocusId: null, storeFocusMode: false });
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
      "<h3>提示</h3><div class='v'>① 切换拥堵/等级/业务难度<br/>② 点过江或临港走廊路段<br/>③ 切雨天情景看路色与难度系数<br/>④ 出行包看供需 TopN 并导出</div>";
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
    document.querySelectorAll(".nav button[data-pack]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-pack") === ctx.active_pack);
    });
    if ($("sel-tod")) $("sel-tod").value = ctx.time_of_day;
    if ($("sel-node")) $("sel-node").value = ctx.season_or_node;
    if ($("sel-scenario")) $("sel-scenario").value = ctx.scenario;
    document.querySelectorAll("[data-rm]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-rm") === ctx.roadDisplayMode);
    });
    document.querySelectorAll("[data-heat]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-heat") === ctx.heatRenderMode);
    });
    const ls = ctx.layer_set || [];
    if ($("ly-road")) $("ly-road").checked = ls.indexOf("roads") >= 0 || ls.indexOf("road_cong") >= 0;
    if ($("ly-zone")) $("ly-zone").checked = ls.indexOf("zones") >= 0;
    if ($("ly-heat")) $("ly-heat").checked = ls.indexOf("heat") >= 0;
    if ($("ly-poi"))
      $("ly-poi").checked =
        ls.indexOf("stores") >= 0 || ls.indexOf("chargers") >= 0;
    document.querySelectorAll(".side-tabs button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-panel") === ctx.side_panel);
    });
    if ($("panel-list"))
      $("panel-list").classList.toggle("hidden", ctx.side_panel !== "list");
    if ($("panel-road"))
      $("panel-road").classList.toggle("hidden", ctx.side_panel !== "road");
    if ($("scene-badge")) {
      $("scene-badge").innerHTML =
        "scene <code>" +
        ctx.active_scene +
        "</code> · " +
        ctx.active_pack;
    }
    // legend
    const lt = $("legend-title");
    const lb = $("legend-body");
    if (lt && lb) {
      if (ctx.roadDisplayMode === "grade") {
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
        lt.textContent = "图例 · 拥堵（整段 way）";
        lb.innerHTML =
          "<span><i class='sw' style='background:#3dd68c'></i>畅通</span>" +
          "<span><i class='sw' style='background:#e6c07b'></i>缓行</span>" +
          "<span><i class='sw' style='background:#f07178'></i>拥堵</span>";
      }
    }
  }

  let suppressCongWrite = false;

  function onState(ctx) {
    if (!suppressCongWrite) {
      // refresh derived congestion without infinite loop
      const sc = sceneForPack(ctx.active_pack);
      const bundle = LBSMetrics.difficultyBundle(
        data && data.congestion,
        ctx.weather,
        ctx.time_of_day,
        sc
      );
      const share = Math.min(0.95, Math.max(0.05, (bundle.congestion_index || 0.5) * 0.9));
      const narrative = buildNarrative(ctx, bundle.difficulty, share);
      const prev = ctx.congestion || {};
      if (
        prev.difficulty_coeff !== bundle.difficulty ||
        prev.share_blocked !== share ||
        prev.narrative !== narrative
      ) {
        suppressCongWrite = true;
        AppContext.set({
          congestion: {
            share_blocked: share,
            difficulty_coeff: bundle.difficulty,
            narrative: narrative
          }
        });
        suppressCongWrite = false;
        return; // will re-enter
      }
    }
    syncChrome(ctx);
    paintStory(ctx);
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
    if ($("sel-tod"))
      $("sel-tod").onchange = function () {
        AppContext.set({ time_of_day: $("sel-tod").value });
      };
    if ($("sel-node"))
      $("sel-node").onchange = function () {
        AppContext.set({ season_or_node: $("sel-node").value });
      };
    if ($("sel-scenario"))
      $("sel-scenario").onchange = function () {
        AppContext.applyScenario($("sel-scenario").value);
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
    function layerPatch() {
      const ctx = AppContext.get();
      const set = ["basemap"];
      if ($("ly-road") && $("ly-road").checked) {
        set.push("roads");
        set.push("road_cong");
      }
      set.push("water");
      if ($("ly-zone") && $("ly-zone").checked) set.push("zones");
      if ($("ly-heat") && $("ly-heat").checked) set.push("heat");
      if ($("ly-poi") && $("ly-poi").checked) {
        if (ctx.active_pack === "energy") set.push("chargers");
        else set.push("stores");
      }
      AppContext.set({ layer_set: set });
    }
    ["ly-road", "ly-zone", "ly-heat", "ly-poi"].forEach(function (id) {
      if ($(id)) $(id).onchange = layerPatch;
    });
    document.querySelectorAll(".side-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        AppContext.set({ side_panel: b.getAttribute("data-panel") });
      });
    });
    if ($("btn-export")) $("btn-export").onclick = exportSnapshot;
    if ($("btn-story-river"))
      $("btn-story-river").onclick = function () {
        AppContext.applyScenario("A");
        AppContext.set({
          time_of_day: "wd_pm_peak",
          roadDisplayMode: "cong",
          active_pack: "overview"
        });
        AppContext.switchPack("overview");
        mapApp.focusLatLng(31.239, 121.495, 13);
        setStatus("叙事镜头 · 晚高峰过江");
      };
    if ($("btn-story-rain"))
      $("btn-story-rain").onclick = function () {
        AppContext.switchPack("ride");
        AppContext.applyScenario("B");
        AppContext.set({ time_of_day: "wd_pm_peak", roadDisplayMode: "cong" });
        setStatus("叙事镜头 · 雨天出行");
      };
    if ($("btn-story-hub"))
      $("btn-story-hub").onclick = function () {
        AppContext.switchPack("fulfillment");
        AppContext.applyScenario("A");
        mapApp.focusLatLng(31.194, 121.32, 13);
        setStatus("叙事镜头 · 虹桥脉冲");
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
      ctx.scenario;
    AppContext.set({ snapshot_id: snapId });
    const payload = {
      snapshot_id: snapId,
      exported_at: new Date().toISOString(),
      synthetic: true,
      brand_note: "小李* · no employer site names",
      formula: LBSMetrics.FORMULA_RIDE,
      context: AppContext.exportContext(),
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
      onZoom: function (z) {
        const lod = LBSMetrics.lodFromZoom(z);
        if (AppContext.get().lodLevel !== lod) {
          AppContext.set({ lodLevel: lod });
        } else {
          // still rebuild roads weights
          const ctx = AppContext.get();
          const bundle = LBSMetrics.difficultyBundle(
            data && data.congestion,
            ctx.weather,
            ctx.time_of_day,
            sceneForPack(ctx.active_pack)
          );
          mapApp.rebuildRoads({
            mode: ctx.roadDisplayMode,
            lod: lod,
            cityIndex: bundle.congestion_index,
            weather: ctx.weather,
            tod: ctx.time_of_day,
            difficulty: bundle.difficulty,
            show: true
          });
        }
      }
    });

    if (!amapKey) {
      showBanner(
        "未配置高德 Key：fallback 底图。复制 config.local.example.js → config.local.js 填写 amapKey。",
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
      onRoadClick: function (id, props, cong, _f, ll) {
        const ctx = AppContext.get();
        const bundle = LBSMetrics.difficultyBundle(
          data.congestion,
          ctx.weather,
          ctx.time_of_day,
          sceneForPack(ctx.active_pack)
        );
        const hw = props.highway || "";
        const gradeLabel = hw + (props.ref ? " / " + props.ref : "");
        const band = cong < 0.4 ? "畅通" : cong < 0.65 ? "缓行" : "拥堵";
        const names = nearestZones(ll || [31.23, 121.48], 3);
        window.__lastRoadDetail = {
          name: props.name || props.ref || "osm:" + id,
          grade: gradeLabel,
          cong: cong,
          congLabel: band + " · index " + cong.toFixed(2),
          impact: LBSMetrics.roadImpactCopy(
            cong,
            gradeLabel,
            bundle.difficulty,
            ctx.active_pack
          ),
          zones: names.join("、") || "—"
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
        if (AppContext.get().active_pack === "o2o" || AppContext.get().active_pack === "fulfillment") {
          AppContext.switchPack("o2o");
          AppContext.set({
            storeFocusId: ent.entity_id,
            storeFocusMode: true,
            selected_entity: ent.entity_id
          });
        }
      }
    });

    AppContext.subscribe(function (ctx) {
      if (!data) return;
      onState(ctx);
    });

    AppContext.applyScenario("A");
    AppContext.switchPack("overview");
    // force initial paint after switch
    onState(AppContext.get());

    if ($("synth-note")) {
      $("synth-note").textContent =
        data.manifest && data.manifest.synthetic
          ? "Synthetic · 小李* · 无雇主站名"
          : "Synthetic";
    }
    setStatus(
      "就绪 · zones " +
        zoneById.size +
        " · roads " +
        ((data.roads && data.roads.features && data.roads.features.length) || 0) +
        " · " +
        (amapKey ? "高德底图" : "fallback 底图")
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
