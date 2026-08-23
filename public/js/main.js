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
    rideLayers: $("ride-layers"),
    ovControls: $("ov-controls"),
    listTitle: $("list-title"),
    listMeta: $("list-meta"),
    listBody: $("list-body"),
    detail: $("detail"),
    formulaBox: $("formula-box"),
    synthNote: $("synth-note")
  };

  let data = null;
  let mapApp = null;
  let gridById = new Map();
  let rideIndex = null; // Map grid_id -> base row for current TOD
  let lastComputed = []; // array of computed rows for export/list
  let gapDisabledReason = null;

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

  function corridorText(grid) {
    const rules =
      (data && data.corridor && data.corridor.rules) || [];
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
    const rows =
      (data && data.metrics_ride && data.metrics_ride.rows) || [];
    rideIndex = LBSMetrics.indexByGrid(rows, ctx.time_of_day, "ride");
  }

  function currentCoeffs() {
    const ctx = AppContext.get();
    return LBSMetrics.coeffsFor(
      data.weather,
      data.calendar,
      ctx.weather,
      ctx.season_or_node,
      "ride"
    );
  }

  function computeAll() {
    const c = currentCoeffs();
    gapDisabledReason = null;
    if (!c.ok) {
      gapDisabledReason = c.error || "coefficients missing";
    }
    if (!rideIndex || rideIndex.size === 0) {
      gapDisabledReason = gapDisabledReason || "no metrics for time_of_day";
    }
    const out = [];
    rideIndex.forEach(function (row) {
      const computed = LBSMetrics.applyRow(row, c);
      if (computed) {
        if (!computed.ok && !gapDisabledReason) {
          gapDisabledReason = computed.error;
        }
        out.push(computed);
      }
    });
    lastComputed = out;
    return { list: out, coeffs: c, gapDisabledReason: gapDisabledReason };
  }

  function paintMap() {
    if (!mapApp || !data) return;
    const ctx = AppContext.get();
    const pack = ctx.pack;
    const { list, gapDisabledReason: gdr } = computeAll();
    const byId = new Map();
    list.forEach(function (x) {
      if (x && x.grid_id) byId.set(x.grid_id, x);
    });

    let metric = "gap";
    let layers = ctx.layer_set || [];
    if (pack === "overview") {
      metric = ctx.ov_metric || "ride_gap";
      layers = ["gap"];
    } else {
      // ride: prefer gap for fill if enabled, else demand
      if (layers.indexOf("gap") >= 0 && !gdr) metric = "gap";
      else if (layers.indexOf("demand") >= 0) metric = "demand";
      else if (layers.indexOf("supply") >= 0) metric = "supply";
      else metric = "gap";
    }

    if (metric === "gap" && gdr) {
      // hard rule: never show demand as gap
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
        // composite: use gap if on, else primary layer
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

      // sparse draw: skip near-zero noise for perf on overview gap
      if (fillMetric === "gap" && Math.abs(value) < 3) continue;
      if (fillMetric !== "gap" && value < 8) continue;

      const maxV = fillMetric === "gap" ? 80 : 100;
      const minV = fillMetric === "gap" ? 0 : 0;
      items.push({
        grid: g,
        value: value,
        fill: LBSMetrics.colorForMetric(value, fillMetric, minV, maxV),
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
    mapApp.showRoads(layers.indexOf("roads") >= 0 || (ui.layerRoads && ui.layerRoads.checked));
  }

  function renderList() {
    const ctx = AppContext.get();
    const { list, gapDisabledReason: gdr } = computeAll();
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

    renderDetail();
  }

  function renderDetail() {
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
    const c = currentCoeffs();
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

  function syncControlsFromState() {
    const ctx = AppContext.get();
    if (ui.selTod) ui.selTod.value = ctx.time_of_day;
    if (ui.selNode) ui.selNode.value = ctx.season_or_node;
    if (ui.selScenario) ui.selScenario.value = ctx.scenario;
    if (ui.ovMetric) ui.ovMetric.value = ctx.ov_metric || "ride_gap";

    const isRide = ctx.pack === "ride";
    if (ui.packOverview) {
      ui.packOverview.classList.toggle("active", ctx.pack === "overview");
    }
    if (ui.packRide) {
      ui.packRide.classList.toggle("active", isRide);
    }
    if (ui.rideLayers) ui.rideLayers.style.display = isRide ? "" : "none";
    if (ui.ovControls) ui.ovControls.style.display = isRide ? "none" : "";
    if (ui.btnEnterRide) ui.btnEnterRide.style.display = isRide ? "none" : "";

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

  function exportSnapshot() {
    const ctx = AppContext.get();
    const { list, gapDisabledReason: gdr } = computeAll();
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

  function onStateChange() {
    rebuildRideIndex();
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
      // keep roads flag in checkbox only
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

    if (data.manifest && data.manifest.bbox_gcj) {
      mapApp.fitToBbox(data.manifest.bbox_gcj);
      // focus inner city a bit
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

    // default scenario A
    AppContext.applyScenario("A");
    AppContext.switchPack("overview");
    setStatus(
      "就绪 · grids " +
        ((data.grids && data.grids.count) || gridById.size) +
        " · ride rows " +
        ((data.metrics_ride && data.metrics_ride.count) || "?") +
        (amapKey ? " · 高德底图" : " · fallback 底图")
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
