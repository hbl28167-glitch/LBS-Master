(function () {
  "use strict";

  const $ = function (id) {
    return document.getElementById(id);
  };

  const ui = {
    banner: $("banner"),
    status: $("status"),
    packOverview: $("nav-overview"),
    packRide: $("nav-ride"),
    packEnergy: $("nav-energy"),
    packGov: $("nav-gov"),
    sceneBadge: $("scene-badge"),
    sceneFormula: $("scene-formula"),
    selTod: $("sel-tod"),
    selNode: $("sel-node"),
    selScenario: $("sel-scenario"),
    btnExport: $("btn-export"),
    btnEnterRide: $("btn-enter-ride"),
    ovMetric: $("ov-metric"),
    layerDemand: $("layer-demand"),
    layerSupply: $("layer-supply"),
    layerGap: $("layer-gap"),
    layerRoads: $("layer-roads"),
    layerChgGap: $("layer-chg-gap"),
    layerChargers: $("layer-chargers"),
    layerRoadsE: $("layer-roads-e"),
    layerQuality: $("layer-quality"),
    layerChargersG: $("layer-chargers-g"),
    layerRoadsG: $("layer-roads-g"),
    rideLayers: $("ride-layers"),
    energyLayers: $("energy-layers"),
    govLayers: $("gov-layers"),
    ovControls: $("ov-controls"),
    listTitle: $("list-title"),
    listMeta: $("list-meta"),
    listBody: $("list-body"),
    detail: $("detail"),
    formulaBox: $("formula-box"),
    synthNote: $("synth-note"),
    sitingPanel: $("siting-panel")
  };

  let data = null;
  let mapApp = null;
  let gridById = new Map();
  let rideIndex = null;
  let chgIndex = null;
  let lastComputed = [];
  let lastComputedChg = [];
  let qualityIssues = [];
  let gapDisabledReason = null;
  let chgGapDisabledReason = null;
  let lastSiting = null;

  function cfg() {
    return (window.LBS_CONFIG && window.LBS_CONFIG) || { amapKey: "" };
  }

  function showBanner(msg, show) {
    if (!ui.banner) return;
    if (show === false || !msg) {
      ui.banner.classList.remove("show");
      ui.banner.textContent = "";
      return;
    }
    ui.banner.textContent = msg;
    ui.banner.classList.add("show");
  }

  function setStatus(t) {
    if (ui.status) ui.status.textContent = t || "";
  }

  function chargers() {
    return (data && data.entities_charger && data.entities_charger.entities) || [];
  }

  function corridorText(grid) {
    const rules = (data && data.corridor && data.corridor.rules) || [];
    if (!grid) {
      const d = rules.find(function (r) {
        return r.id === "default";
      });
      return d || { title: "路网解释", body: "" };
    }
    const labels = grid.labels || [];
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      if (r.id === "default") continue;
      if (r.match_labels) {
        for (let j = 0; j < r.match_labels.length; j++) {
          if (labels.indexOf(r.match_labels[j]) >= 0) return r;
        }
      }
      if (r.match_landuse && r.match_landuse.indexOf(grid.landuse) >= 0) {
        return r;
      }
    }
    return (
      rules.find(function (r) {
        return r.id === "default";
      }) || { title: "路网解释", body: "" }
    );
  }

  function rebuildRideIndex() {
    const ctx = AppContext.get();
    const rows = (data && data.metrics_ride && data.metrics_ride.rows) || [];
    rideIndex = LBSMetrics.indexByGrid(rows, ctx.time_of_day, "ride");
  }

  function rebuildChgIndex() {
    const ctx = AppContext.get();
    const rows = (data && data.metrics_chg && data.metrics_chg.rows) || [];
    chgIndex = LBSMetrics.indexByGrid(rows, ctx.time_of_day, "chg");
  }

  function currentCoeffs(scene) {
    const ctx = AppContext.get();
    const sc = scene || "ride";
    return LBSMetrics.coeffsFor(
      data.weather,
      data.calendar,
      ctx.weather,
      ctx.season_or_node,
      sc
    );
  }

  function computeAllRide() {
    const c = currentCoeffs("ride");
    gapDisabledReason = null;
    if (!c.ok) gapDisabledReason = c.error || "coefficients missing";
    if (!rideIndex || rideIndex.size === 0) {
      gapDisabledReason = gapDisabledReason || "no metrics for time_of_day";
    }
    const out = [];
    if (rideIndex) {
      rideIndex.forEach(function (row) {
        const computed = LBSMetrics.applyRow(row, c);
        if (computed) {
          if (!computed.ok && !gapDisabledReason) gapDisabledReason = computed.error;
          out.push(computed);
        }
      });
    }
    lastComputed = out;
    return { list: out, coeffs: c, gapDisabledReason: gapDisabledReason };
  }

  function computeAllChg() {
    const c = currentCoeffs("chg");
    chgGapDisabledReason = null;
    if (!c.ok) chgGapDisabledReason = c.error || "coefficients missing";
    if (!chgIndex || chgIndex.size === 0) {
      chgGapDisabledReason = chgGapDisabledReason || "no chg metrics for time_of_day";
    }
    const out = [];
    if (chgIndex) {
      chgIndex.forEach(function (row) {
        const computed = LBSMetrics.applyRow(row, c);
        if (computed) {
          if (!computed.ok && !chgGapDisabledReason) {
            chgGapDisabledReason = computed.error;
          }
          out.push(computed);
        }
      });
    }
    lastComputedChg = out;
    return { list: out, coeffs: c, gapDisabledReason: chgGapDisabledReason };
  }

  function paintMap() {
    if (!mapApp || !data) return;
    const ctx = AppContext.get();
    const pack = ctx.pack;

    if (pack === "gov") {
      paintGovMap(ctx);
      return;
    }
    if (pack === "energy") {
      paintEnergyMap(ctx);
      return;
    }

    // overview + ride (WS-D path — keep behavior)
    mapApp.clearQuality();
    mapApp.clearSiting();
    mapApp.clearEntities();

    const { list, gapDisabledReason: gdr } = computeAllRide();
    const byId = new Map();
    list.forEach(function (x) {
      if (x && x.grid_id) byId.set(x.grid_id, x);
    });

    let layers = ctx.layer_set || [];
    if (pack === "overview") layers = ["gap"];

    if (layers.indexOf("gap") >= 0 && gdr) {
      showBanner("gap 不可用：" + gdr + "（未将 demand 当作缺口）", true);
    } else if (!cfg().amapKey) {
      showBanner(
        "未配置高德 Key：已用 fallback 底图。复制 public/config.local.example.js → config.local.js 并填写 amapKey。",
        true
      );
    } else {
      showBanner("", false);
    }

    const items = [];
    const grids = (data.grids && data.grids.grids) || [];
    for (let i = 0; i < grids.length; i++) {
      const g = grids[i];
      if (!g.is_valid) continue;
      const m = byId.get(g.grid_id);
      if (!m || !m.ok) continue;

      let value = null;
      let fillMetric = "gap";
      if (pack === "overview") {
        if (ctx.ov_metric === "ride_demand") {
          value = m.demand;
          fillMetric = "demand";
        } else if (ctx.ov_metric === "ride_supply") {
          value = m.supply;
          fillMetric = "supply";
        } else {
          if (gdr) continue;
          value = m.gap;
          fillMetric = "gap";
        }
      } else {
        if (layers.indexOf("gap") >= 0 && !gdr) {
          value = m.gap;
          fillMetric = "gap";
        } else if (layers.indexOf("demand") >= 0) {
          value = m.demand;
          fillMetric = "demand";
        } else if (layers.indexOf("supply") >= 0) {
          value = m.supply;
          fillMetric = "supply";
        } else {
          continue;
        }
      }

      if (fillMetric === "gap" && Math.abs(value) < 3) continue;
      if (fillMetric !== "gap" && value < 8) continue;

      const maxV = fillMetric === "gap" ? 80 : 100;
      items.push({
        grid: g,
        value: value,
        fill: LBSMetrics.colorForMetric(value, fillMetric, 0, maxV),
        opacity: fillMetric === "gap" ? 0.62 : 0.5,
        label:
          fillMetric +
          "=" +
          value.toFixed(1) +
          (m.ok
            ? " · d=" + m.demand.toFixed(1) + " s=" + m.supply.toFixed(1)
            : "")
      });
    }

    mapApp.renderGrids(items, data.grids);
    mapApp.setSelected(ctx.selected_grid_id);
    const roadsOn =
      (ui.layerRoads && ui.layerRoads.checked) || layers.indexOf("roads") >= 0;
    mapApp.showRoads(!!roadsOn);
  }

  function paintEnergyMap(ctx) {
    mapApp.clearQuality();
    const { list, gapDisabledReason: gdr } = computeAllChg();
    const byId = new Map();
    list.forEach(function (x) {
      if (x && x.grid_id) byId.set(x.grid_id, x);
    });

    const showGap = !ui.layerChgGap || ui.layerChgGap.checked;
    const showChg = !ui.layerChargers || ui.layerChargers.checked;

    if (showGap && gdr) {
      showBanner("chg gap 不可用：" + gdr, true);
    } else if (!cfg().amapKey) {
      showBanner(
        "未配置高德 Key：已用 fallback 底图。能源包 scene=chg · Synthetic。",
        true
      );
    } else {
      showBanner("", false);
    }

    const items = [];
    if (showGap && !gdr) {
      const grids = (data.grids && data.grids.grids) || [];
      for (let i = 0; i < grids.length; i++) {
        const g = grids[i];
        if (!g.is_valid) continue;
        const m = byId.get(g.grid_id);
        if (!m || !m.ok) continue;
        if (m.gap < 3) continue;
        items.push({
          grid: g,
          value: m.gap,
          fill: LBSMetrics.colorForMetric(m.gap, "gap", 0, 80),
          opacity: 0.62,
          label:
            "chg_gap=" +
            m.gap.toFixed(1) +
            " · d=" +
            m.demand.toFixed(1) +
            " s=" +
            m.supply.toFixed(1)
        });
      }
    }
    mapApp.renderGrids(items, data.grids);
    mapApp.setSelected(ctx.selected_grid_id || ctx.siting_grid_id);

    mapApp.renderChargers(showChg ? chargers() : [], {
      visible: showChg,
      color: "#22c55e"
    });

    if (ctx.siting_open && lastSiting && lastSiting.results) {
      mapApp.renderSitingCandidates(lastSiting.results, {
        visible: true,
        winner: lastSiting.compare && lastSiting.compare.winner
      });
    } else {
      mapApp.clearSiting();
    }

    mapApp.showRoads(!!(ui.layerRoadsE && ui.layerRoadsE.checked));
  }

  function paintGovMap(ctx) {
    mapApp.clearSiting();
    mapApp.renderGrids([], data.grids);

    const showQ = !ui.layerQuality || ui.layerQuality.checked;
    const showChg = !ui.layerChargersG || ui.layerChargersG.checked;

    if (!cfg().amapKey) {
      showBanner(
        "未配置高德 Key · 治理图例「数据质量」· 不处理终端 GPS 漂移",
        true
      );
    } else {
      showBanner("治理边界：不处理终端 GPS 漂移（仅主数据/入口类）", true);
    }

    mapApp.renderChargers(showChg ? chargers() : [], {
      visible: showChg,
      color: "#4ade80",
      max: 120
    });
    mapApp.renderQualityIssues(showQ ? qualityIssues : [], { visible: showQ });
    mapApp.showRoads(!!(ui.layerRoadsG && ui.layerRoadsG.checked));
  }

  function renderList() {
    const ctx = AppContext.get();
    if (ctx.pack === "energy") {
      renderEnergyList(ctx);
      return;
    }
    if (ctx.pack === "gov") {
      renderGovList(ctx);
      return;
    }

    hideSitingPanel();
    const { list, gapDisabledReason: gdr } = computeAllRide();
    const top = gdr ? [] : LBSMetrics.topShortage(list, 15);

    if (ui.listTitle) {
      ui.listTitle.textContent =
        ctx.pack === "ride" ? "出行缺口 TopN" : "总览 · 缺口 TopN";
    }
    if (ui.listMeta) {
      ui.listMeta.textContent =
        "情景 " +
        ctx.scenario +
        " · " +
        ctx.weather +
        " · " +
        ctx.time_of_day +
        " · Synthetic";
    }
    if (ui.formulaBox) {
      ui.formulaBox.textContent =
        ctx.pack === "ride" || ctx.active_scene === "ride"
          ? LBSMetrics.FORMULA_RIDE
          : "OV 对照 ride_gap（与出行同一公式）\n" + LBSMetrics.FORMULA_RIDE;
    }
    if (ui.sceneBadge) {
      const scene =
        ctx.pack === "overview" ? "overview→ride_gap" : ctx.active_scene;
      ui.sceneBadge.innerHTML =
        "scene <code>" +
        scene +
        "</code> · 情景 <strong>" +
        ctx.scenario +
        "</strong>";
    }

    const body = ui.listBody;
    if (!body) return;
    body.innerHTML = "";

    if (gdr) {
      const err = document.createElement("div");
      err.className = "err";
      err.textContent =
        "gap 已禁用：" + gdr + "。禁止将 demand 单独显示为缺口。";
      body.appendChild(err);
      return;
    }

    if (!top.length) {
      const empty = document.createElement("div");
      empty.className = "meta";
      empty.textContent = "当前切片无正缺口。";
      body.appendChild(empty);
      return;
    }

    top.forEach(function (row, idx) {
      const el = document.createElement("div");
      el.className =
        "list-item" +
        (ctx.selected_grid_id === row.grid_id ? " active" : "");
      el.innerHTML =
        '<div class="title"><span>#' +
        (idx + 1) +
        " " +
        row.grid_id +
        '</span><span class="tag ' +
        row.action +
        '">' +
        row.action +
        "</span></div>" +
        '<div class="vals">' +
        "<span>gap " +
        row.gap.toFixed(1) +
        "</span><span>demand " +
        row.demand.toFixed(1) +
        "</span>" +
        "<span>supply " +
        row.supply.toFixed(1) +
        "</span><span>" +
        (gridById.get(row.grid_id) || {}).landuse +
        "</span></div>";
      el.addEventListener("click", function () {
        AppContext.set({ selected_grid_id: row.grid_id });
        const g = gridById.get(row.grid_id);
        if (g) mapApp.focusGrid(g);
      });
      body.appendChild(el);
    });

    renderDetailRide();
  }

  function renderEnergyList(ctx) {
    const { list, gapDisabledReason: gdr } = computeAllChg();
    const top = gdr ? [] : LBSMetrics.topShortage(list, 15);

    if (ui.listTitle) ui.listTitle.textContent = "能源 · chg 缺口 TopN";
    if (ui.listMeta) {
      ui.listMeta.textContent =
        "scene=chg · " +
        ctx.weather +
        " · " +
        ctx.time_of_day +
        " · 节点 " +
        ctx.season_or_node +
        " · 小李充电 Synthetic";
    }
    if (ui.formulaBox) ui.formulaBox.textContent = LBSMetrics.FORMULA_CHG;
    if (ui.sceneBadge) {
      ui.sceneBadge.innerHTML =
        "scene <code>chg</code> · 情景 <strong>" + ctx.scenario + "</strong>";
    }

    const body = ui.listBody;
    if (!body) return;
    body.innerHTML = "";

    if (gdr) {
      const err = document.createElement("div");
      err.className = "err";
      err.textContent = "chg gap 已禁用：" + gdr;
      body.appendChild(err);
      hideSitingPanel();
      return;
    }

    if (!top.length) {
      body.innerHTML = '<div class="meta">当前切片无正缺口。</div>';
    } else {
      top.forEach(function (row, idx) {
        const el = document.createElement("div");
        el.className =
          "list-item" +
          (ctx.selected_grid_id === row.grid_id ||
          ctx.siting_grid_id === row.grid_id
            ? " active"
            : "");
        el.innerHTML =
          '<div class="title"><span>#' +
          (idx + 1) +
          " " +
          row.grid_id +
          '</span><span class="tag shift_fleet">补能缺口</span></div>' +
          '<div class="vals">' +
          "<span>gap " +
          row.gap.toFixed(1) +
          "</span><span>demand " +
          row.demand.toFixed(1) +
          "</span>" +
          "<span>supply " +
          row.supply.toFixed(1) +
          "</span><span>" +
          ((gridById.get(row.grid_id) || {}).landuse || "—") +
          "</span></div>" +
          '<div class="row-actions"><button type="button" class="primary btn-siting" data-gid="' +
          row.grid_id +
          '">发起选址</button></div>';
        el.addEventListener("click", function (ev) {
          if (ev.target && ev.target.classList.contains("btn-siting")) return;
          AppContext.set({ selected_grid_id: row.grid_id });
          const g = gridById.get(row.grid_id);
          if (g) mapApp.focusGrid(g);
        });
        const btn = el.querySelector(".btn-siting");
        if (btn) {
          btn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            openSiting(row.grid_id);
          });
        }
        body.appendChild(el);
      });
    }

    renderDetailEnergy();
    if (ctx.siting_open && ctx.siting_grid_id) {
      renderSitingPanel(ctx.siting_grid_id);
    } else {
      hideSitingPanel();
    }
  }

  function renderGovList(ctx) {
    hideSitingPanel();
    if (ui.listTitle) ui.listTitle.textContent = "数据质量 · 问题列表";
    if (ui.listMeta) {
      ui.listMeta.textContent =
        "图例标题「数据质量」· 与经营色分色 · 不处理终端 GPS 漂移";
    }
    if (ui.formulaBox) {
      ui.formulaBox.textContent =
        "治理边界（只读）\n" +
        "· 处理：主数据入口/命名/桩位元数据、距路网过远\n" +
        "· 不处理：终端 GPS 漂移 (device_gps_drift)\n" +
        "· 展示品牌：小李充电 · Synthetic";
    }
    if (ui.sceneBadge) {
      ui.sceneBadge.innerHTML =
        "scene <code>gov</code> · 图例 <strong>数据质量</strong>";
    }

    const body = ui.listBody;
    if (!body) return;
    body.innerHTML = "";

    const note = document.createElement("div");
    note.className = "gov-boundary";
    note.textContent =
      "不处理终端 GPS 漂移 · 经营色（缺口红）与治理色（紫/琥珀）分图例标题";
    body.appendChild(note);

    if (!qualityIssues.length) {
      body.innerHTML += '<div class="meta">暂无问题（实体未加载）。</div>';
      if (ui.detail) {
        ui.detail.innerHTML =
          "<h3>数据质量</h3><p>规则 mock 问题列表；导出可用于周度例会。</p>";
      }
      return;
    }

    qualityIssues.forEach(function (iss, idx) {
      const el = document.createElement("div");
      el.className = "list-item";
      el.innerHTML =
        '<div class="title"><span>#' +
        (idx + 1) +
        " " +
        iss.display_name +
        '</span><span class="tag sev-' +
        iss.severity +
        '">' +
        iss.severity +
        "</span></div>" +
        '<div class="vals">' +
        "<span>" +
        iss.code +
        "</span><span>" +
        iss.title +
        "</span>" +
        "<span colspan>图例·数据质量</span></div>";
      el.addEventListener("click", function () {
        if (iss.lat != null) {
          mapApp.map.setView([iss.lat, iss.lng], 14, { animate: true });
        }
        if (ui.detail) {
          ui.detail.innerHTML =
            "<h3>" +
            iss.display_name +
            "</h3>" +
            "<p><strong>" +
            iss.severity +
            "</strong> · " +
            iss.code +
            " · " +
            iss.title +
            "</p>" +
            "<p>" +
            iss.detail +
            "</p>" +
            "<p class=\"gov-boundary\">边界：不处理终端 GPS 漂移（out_of_scope=" +
            iss.out_of_scope +
            "）</p>" +
            "<p>entity_id: <code>" +
            iss.entity_id +
            "</code></p>";
        }
      });
      body.appendChild(el);
    });

    if (ui.detail) {
      ui.detail.innerHTML =
        "<h3>数据质量说明</h3>" +
        "<p>共 " +
        qualityIssues.length +
        " 条规则 mock 问题（距路网过远、入口缺失等）。</p>" +
        "<p class=\"gov-boundary\">产品声明：不处理终端 GPS 漂移。</p>" +
        '<p><button type="button" class="primary" id="btn-export-p0">导出 P0 名单</button></p>';
      const b = $("btn-export-p0");
      if (b) b.addEventListener("click", exportP0);
    }
  }

  function renderDetailRide() {
    const ctx = AppContext.get();
    const box = ui.detail;
    if (!box) return;
    const gid = ctx.selected_grid_id;
    if (!gid) {
      box.innerHTML =
        "<h3>未选中网格</h3><p>在地图点选格子，或从 TopN 列表进入。</p>";
      return;
    }
    const g = gridById.get(gid);
    const c = currentCoeffs("ride");
    const base = rideIndex && rideIndex.get(gid);
    const m = LBSMetrics.applyRow(base, c);
    const corr = corridorText(g);
    let html =
      "<h3>" +
      gid +
      "</h3>" +
      "<p>landuse: <strong>" +
      ((g && g.landuse) || "-") +
      "</strong> · labels: " +
      ((g && g.labels && g.labels.join(", ")) || "—") +
      "</p>";
    if (!m || !m.ok) {
      html +=
        '<div class="err">该格指标不可用' +
        (m && m.error ? "：" + m.error : "") +
        "；gap 禁用。</div>";
    } else {
      html +=
        "<p>demand <strong>" +
        m.demand.toFixed(2) +
        "</strong> · supply <strong>" +
        m.supply.toFixed(2) +
        "</strong> · gap <strong>" +
        m.gap.toFixed(2) +
        "</strong></p>";
      html +=
        "<p>action: <span class=\"tag " +
        LBSMetrics.actionFor(m) +
        '">' +
        LBSMetrics.actionFor(m) +
        "</span> · base d/s " +
        m.demand_base +
        "/" +
        m.supply_base +
        "</p>";
    }
    html +=
      "<h3>" +
      (corr.title || "路网说明") +
      "</h3><p>" +
      (corr.body || "") +
      "</p>";
    if (ctx.pack === "overview") {
      html +=
        '<p><button type="button" class="primary" id="btn-detail-ride">进入出行（带选中格）</button></p>';
    }
    box.innerHTML = html;
    const b = $("btn-detail-ride");
    if (b) {
      b.addEventListener("click", function () {
        enterRide();
      });
    }
  }

  function renderDetailEnergy() {
    const ctx = AppContext.get();
    const box = ui.detail;
    if (!box) return;
    const gid = ctx.selected_grid_id || ctx.siting_grid_id;
    if (!gid) {
      box.innerHTML =
        "<h3>能源网络</h3><p>小李充电缺口列表 →「发起选址」进入 S5 评分（R=1.5km，可解释权重）。</p>";
      return;
    }
    const g = gridById.get(gid);
    const c = currentCoeffs("chg");
    const base = chgIndex && chgIndex.get(gid);
    const m = LBSMetrics.applyRow(base, c);
    let html =
      "<h3>" +
      gid +
      " · scene=chg</h3>" +
      "<p>landuse: <strong>" +
      ((g && g.landuse) || "-") +
      "</strong></p>";
    if (!m || !m.ok) {
      html += '<div class="err">chg 指标不可用</div>';
    } else {
      html +=
        "<p>demand <strong>" +
        m.demand.toFixed(2) +
        "</strong> · supply <strong>" +
        m.supply.toFixed(2) +
        "</strong> · gap <strong>" +
        m.gap.toFixed(2) +
        "</strong></p>";
    }
    html +=
      '<p><button type="button" class="primary" id="btn-detail-siting">发起选址</button></p>';
    box.innerHTML = html;
    const b = $("btn-detail-siting");
    if (b) {
      b.addEventListener("click", function () {
        openSiting(gid);
      });
    }
  }

  function openSiting(gridId) {
    if (AppContext.get().pack !== "energy") {
      AppContext.switchPack("energy");
    }
    AppContext.set({
      siting_open: true,
      siting_grid_id: gridId,
      selected_grid_id: gridId
    });
    const g = gridById.get(gridId);
    if (g && mapApp) mapApp.focusGrid(g);
    setStatus("S5 选址 · R=1.5km · 缺口格 " + gridId);
  }

  function hideSitingPanel() {
    if (!ui.sitingPanel) return;
    ui.sitingPanel.style.display = "none";
    ui.sitingPanel.hidden = true;
    ui.sitingPanel.innerHTML = "";
    lastSiting = null;
    if (mapApp) mapApp.clearSiting();
  }

  function renderSitingPanel(gapGridId) {
    if (!ui.sitingPanel) return;
    const { list } = computeAllChg();
    const computedById = new Map();
    list.forEach(function (x) {
      if (x && x.grid_id) computedById.set(x.grid_id, x);
    });

    const cands = LBSMetrics.buildDefaultCandidates(gapGridId, gridById);
    if (!cands.length) {
      ui.sitingPanel.style.display = "";
      ui.sitingPanel.hidden = false;
      ui.sitingPanel.innerHTML =
        '<div class="err">无法在该格生成候选（缺网格坐标）。</div>';
      return;
    }

    const opts = {
      gridById: gridById,
      computedById: computedById,
      chargers: chargers(),
      rM: LBSMetrics.SITING_R_M
    };
    const results = cands.map(function (c) {
      return LBSMetrics.scoreCandidate(c, gapGridId, opts);
    });
    // attach totals onto markers
    results.forEach(function (r, i) {
      cands[i].total = r.total;
    });
    const compare = LBSMetrics.compareSiting(results);
    lastSiting = { gapGridId: gapGridId, results: results, compare: compare };

    const w = LBSMetrics.SITING_WEIGHTS;
    let html =
      '<div class="siting-head">' +
      "<h3>S5 选址 · R=" +
      LBSMetrics.SITING_R_M / 1000 +
      "km</h3>" +
      '<button type="button" id="btn-close-siting" class="btn-ghost">关闭</button>' +
      "</div>" +
      '<p class="meta">缺口格 <code>' +
      gapGridId +
      "</code> · 邻域近似（格邻域）· 可解释权重非 ML</p>" +
      '<div class="weight-bar">权重 D ' +
      w.demand +
      " · Gap " +
      w.supply_gap +
      " · Comp " +
      w.competition +
      " · Acc " +
      w.access +
      " · 反蚕食 " +
      w.anti_cannibal +
      "</div>";

    if (compare) {
      html +=
        '<div class="siting-verdict">' +
        compare.one_liner +
        "</div>";
    }

    html += '<div class="siting-compare">';
    results.forEach(function (r) {
      const win =
        compare && compare.winner === r.cand_id ? " win" : "";
      html +=
        '<div class="cand-card' +
        win +
        '">' +
        '<div class="cand-title">' +
        r.label +
        (win ? " · 推荐" : "") +
        "</div>" +
        '<div class="cand-total">' +
        r.total.toFixed(1) +
        "</div>" +
        '<div class="subs">' +
        subRow("Demand", r.subscores.demand, w.demand) +
        subRow("SupplyGap", r.subscores.supply_gap, w.supply_gap) +
        subRow("Competition", r.subscores.competition, w.competition) +
        subRow("Access", r.subscores.access, w.access) +
        subRow("反蚕食", r.subscores.anti_cannibal, w.anti_cannibal) +
        "</div>" +
        '<p class="reason">' +
        r.reason_text +
        "</p>" +
        "</div>";
    });
    html += "</div>";
    html +=
      '<p class="meta">节点仅脉冲时优先运营导流；跨节点仍红再重仓建站。天气 rain 不作定址主依据。</p>';

    ui.sitingPanel.style.display = "";
    ui.sitingPanel.hidden = false;
    ui.sitingPanel.innerHTML = html;

    const close = $("btn-close-siting");
    if (close) {
      close.addEventListener("click", function () {
        AppContext.set({ siting_open: false, siting_grid_id: null });
      });
    }

    if (mapApp) {
      mapApp.renderSitingCandidates(results, {
        visible: true,
        winner: compare && compare.winner
      });
    }
  }

  function subRow(name, val, weight) {
    const pct = Math.max(0, Math.min(100, val));
    return (
      '<div class="sub-row"><span>' +
      name +
      " ×" +
      weight +
      '</span><span>' +
      val.toFixed(1) +
      '</span></div>' +
      '<div class="sub-track"><i style="width:' +
      pct +
      '%"></i></div>'
    );
  }

  function syncControlsFromState() {
    const ctx = AppContext.get();
    if (ui.selTod) ui.selTod.value = ctx.time_of_day;
    if (ui.selNode) ui.selNode.value = ctx.season_or_node;
    if (ui.selScenario) ui.selScenario.value = ctx.scenario;
    if (ui.ovMetric) ui.ovMetric.value = ctx.ov_metric || "ride_gap";

    const pack = ctx.pack;
    if (ui.packOverview) {
      ui.packOverview.classList.toggle("active", pack === "overview");
    }
    if (ui.packRide) ui.packRide.classList.toggle("active", pack === "ride");
    if (ui.packEnergy) {
      ui.packEnergy.classList.toggle("active", pack === "energy");
    }
    if (ui.packGov) ui.packGov.classList.toggle("active", pack === "gov");

    if (ui.rideLayers) {
      ui.rideLayers.style.display = pack === "ride" ? "" : "none";
    }
    if (ui.energyLayers) {
      ui.energyLayers.style.display = pack === "energy" ? "" : "none";
    }
    if (ui.govLayers) {
      ui.govLayers.style.display = pack === "gov" ? "" : "none";
    }
    if (ui.ovControls) {
      ui.ovControls.style.display = pack === "overview" ? "" : "none";
    }
    if (ui.btnEnterRide) {
      ui.btnEnterRide.style.display =
        pack === "overview" || pack === "ride" ? "" : "none";
      if (pack === "ride") ui.btnEnterRide.style.display = "none";
    }

    const ls = ctx.layer_set || [];
    if (ui.layerDemand) ui.layerDemand.checked = ls.indexOf("demand") >= 0;
    if (ui.layerSupply) ui.layerSupply.checked = ls.indexOf("supply") >= 0;
    if (ui.layerGap) {
      ui.layerGap.checked = ls.indexOf("gap") >= 0;
      ui.layerGap.disabled = !!gapDisabledReason;
    }
  }

  function enterRide() {
    AppContext.switchPack("ride");
    setStatus("已进入出行包 · scene=ride（继承区域/时间/选中格）");
  }

  function enterEnergy() {
    AppContext.switchPack("energy");
    setStatus("已进入能源网络 · scene=chg · 小李充电");
  }

  function enterGov() {
    AppContext.switchPack("gov");
    setStatus("已进入数据治理 · 图例「数据质量」· 不处理终端 GPS 漂移");
  }

  function exportSnapshot() {
    const ctx = AppContext.get();
    if (ctx.pack === "gov") {
      exportP0();
      return;
    }
    if (ctx.pack === "energy") {
      exportEnergySnap();
      return;
    }
    const { list, gapDisabledReason: gdr } = computeAllRide();
    const top = gdr ? [] : LBSMetrics.topShortage(list, 50);
    const snapId =
      "snap_" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      "_" +
      (ctx.scenario || "A");
    AppContext.set({ snapshot_id: snapId });
    const payload = {
      snapshot_id: snapId,
      exported_at: new Date().toISOString(),
      synthetic: true,
      brand_note: "小李* placeholder; no employer site names",
      formula: LBSMetrics.FORMULA_RIDE,
      gap_disabled: gdr || null,
      context: AppContext.exportContext(),
      rows: top.map(function (r) {
        const g = gridById.get(r.grid_id) || {};
        return {
          grid_id: r.grid_id,
          demand: round2(r.demand),
          supply: round2(r.supply),
          gap: round2(r.gap),
          action: r.action,
          landuse: g.landuse || null,
          labels: g.labels || []
        };
      })
    };
    downloadJson(payload, snapId + ".json");
    setStatus("已导出 " + snapId + ".json");
  }

  function exportEnergySnap() {
    const ctx = AppContext.get();
    const { list, gapDisabledReason: gdr } = computeAllChg();
    const top = gdr ? [] : LBSMetrics.topShortage(list, 30);
    const snapId =
      "snap_chg_" + new Date().toISOString().replace(/[:.]/g, "-");
    const payload = {
      snapshot_id: snapId,
      exported_at: new Date().toISOString(),
      synthetic: true,
      scene: "chg",
      brand: "小李充电",
      formula: LBSMetrics.FORMULA_CHG,
      siting_weights: LBSMetrics.SITING_WEIGHTS,
      siting_R_m: LBSMetrics.SITING_R_M,
      siting: lastSiting,
      context: AppContext.exportContext(),
      rows: top.map(function (r) {
        return {
          grid_id: r.grid_id,
          demand: round2(r.demand),
          supply: round2(r.supply),
          gap: round2(r.gap)
        };
      })
    };
    downloadJson(payload, snapId + ".json");
    setStatus("已导出能源 snapshot " + snapId + ".json");
  }

  function exportP0() {
    const p0 = qualityIssues.filter(function (x) {
      return x.severity === "P0";
    });
    const snapId =
      "p0_quality_" + new Date().toISOString().replace(/[:.]/g, "-");
    const payload = {
      snapshot_id: snapId,
      exported_at: new Date().toISOString(),
      legend: "数据质量",
      boundary: "不处理终端 GPS 漂移",
      brand: "小李充电",
      synthetic: true,
      count: p0.length,
      issues: p0
    };
    downloadJson(payload, snapId + ".json");
    setStatus("已导出 P0 名单 " + p0.length + " 条");
  }

  function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: "application/json"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function onStateChange() {
    rebuildRideIndex();
    rebuildChgIndex();
    syncControlsFromState();
    paintMap();
    renderList();
  }

  function bindUi() {
    if (ui.packOverview) {
      ui.packOverview.addEventListener("click", function () {
        AppContext.switchPack("overview");
      });
    }
    if (ui.packRide) {
      ui.packRide.addEventListener("click", function () {
        enterRide();
      });
    }
    if (ui.packEnergy) {
      ui.packEnergy.addEventListener("click", enterEnergy);
    }
    if (ui.packGov) {
      ui.packGov.addEventListener("click", enterGov);
    }
    if (ui.btnEnterRide) {
      ui.btnEnterRide.addEventListener("click", enterRide);
    }
    if (ui.btnExport) {
      ui.btnExport.addEventListener("click", exportSnapshot);
    }
    if (ui.selTod) {
      ui.selTod.addEventListener("change", function () {
        AppContext.set({ time_of_day: ui.selTod.value });
      });
    }
    if (ui.selNode) {
      ui.selNode.addEventListener("change", function () {
        AppContext.set({ season_or_node: ui.selNode.value });
      });
    }
    if (ui.selScenario) {
      ui.selScenario.addEventListener("change", function () {
        AppContext.applyScenario(ui.selScenario.value);
      });
    }
    if (ui.ovMetric) {
      ui.ovMetric.addEventListener("change", function () {
        AppContext.set({ ov_metric: ui.ovMetric.value });
      });
    }
    function layerChange() {
      const set = [];
      if (ui.layerDemand && ui.layerDemand.checked) set.push("demand");
      if (ui.layerSupply && ui.layerSupply.checked) set.push("supply");
      if (ui.layerGap && ui.layerGap.checked) {
        if (gapDisabledReason) {
          ui.layerGap.checked = false;
          showBanner("gap 已禁用：" + gapDisabledReason, true);
        } else set.push("gap");
      }
      AppContext.set({ layer_set: set.length ? set : ["demand", "supply"] });
      if (mapApp && ui.layerRoads) mapApp.showRoads(ui.layerRoads.checked);
    }
    [ui.layerDemand, ui.layerSupply, ui.layerGap].forEach(function (el) {
      if (el) el.addEventListener("change", layerChange);
    });
    if (ui.layerRoads) {
      ui.layerRoads.addEventListener("change", function () {
        if (mapApp) mapApp.showRoads(ui.layerRoads.checked);
      });
    }
    function energyLayerChange() {
      paintMap();
    }
    [ui.layerChgGap, ui.layerChargers, ui.layerRoadsE].forEach(function (el) {
      if (el) el.addEventListener("change", energyLayerChange);
    });
    [ui.layerQuality, ui.layerChargersG, ui.layerRoadsG].forEach(function (el) {
      if (el) el.addEventListener("change", energyLayerChange);
    });
  }

  async function boot() {
    setStatus("加载数据…");
    bindUi();
    AppContext.subscribe(function () {
      onStateChange();
    });

    const amapKey = (cfg().amapKey || "").trim();
    mapApp = LBSMap.createMapApp("map", { amapKey: amapKey });
    mapApp.setOnSelect(function (gid) {
      AppContext.set({ selected_grid_id: gid });
    });

    try {
      data = await LBSData.loadAll({ roads: true });
    } catch (e) {
      console.error(e);
      setStatus("数据加载失败");
      showBanner(
        "无法加载 public/data/*。请在仓根执行 npm run build（含 copy-public-data），再用静态服务器打开 public/。",
        true
      );
      return;
    }

    (data.grids.grids || []).forEach(function (g) {
      gridById.set(g.grid_id, g);
    });

    qualityIssues = LBSMetrics.mockQualityIssues(chargers(), data.grids);

    if (data.manifest && data.manifest.bbox_gcj) {
      mapApp.fitToBbox(data.manifest.bbox_gcj);
      mapApp.map.setView([31.23, 121.47], 11);
    }

    if (data.roads) {
      mapApp.setRoads(data.roads);
    }

    if (ui.synthNote) {
      ui.synthNote.textContent =
        data.manifest && data.manifest.synthetic
          ? "经营指标 Synthetic · 展示品牌 小李* · 无雇主站名"
          : "";
    }

    AppContext.applyScenario("A");
    AppContext.switchPack("overview");
    setStatus(
      "就绪 · grids " +
        ((data.grids && data.grids.count) || gridById.size) +
        " · ride " +
        ((data.metrics_ride && data.metrics_ride.count) || "?") +
        " · chg " +
        ((data.metrics_chg && data.metrics_chg.count) || "?") +
        " · 小李站 " +
        chargers().length +
        (amapKey ? " · 高德底图" : " · fallback 底图")
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
