(function (global) {
  "use strict";

  let host = null, payload = null, roads = null, zones = null, blocks = null;
  let diagnosticLayer = null, active = false, mode = "issue", savedLayers = null;
  const bbox = [121.479, 31.217, 121.54, 31.263];
  const $ = function (id) { return document.getElementById(id); };
  const typeNames = { residential: "住宅", commercial: "商业", office: "办公", mixed: "混合", public_service: "公共服务", industrial: "工业" };
  const zoneColors = { residential: "#4c91d8", commercial: "#ef6b5b", office: "#8d69d5", mixed: "#9a7c70", public_service: "#45a985", industrial: "#d8973c" };

  function fetchJson(name) {
    return fetch("data/" + name).then(function (r) {
      if (!r.ok) throw new Error(name + " " + r.status);
      return r.json();
    });
  }
  function money(n) { return "¥" + Math.abs(Number(n) || 0).toLocaleString("zh-CN"); }
  function typeName(k) { return typeNames[k] || k; }
  function zoneColor(k) { return zoneColors[k] || "#78909c"; }

  async function load() {
    if (payload) return;
    const all = await Promise.all([
      fetchJson("anomaly-pilot.json"),
      fetchJson("roads-v3-lujiazui.geojson"),
      fetchJson("zones-v3-lujiazui.geojson"),
      fetchJson("blocks-v3-lujiazui.geojson")
    ]);
    payload = all[0]; roads = all[1]; zones = all[2]; blocks = all[3];
    renderPanel();
  }

  function captureLayers() {
    const ids = { basemap: "ly-basemap", water: "ly-water", roads: "ly-road", zones: "ly-zone", heat: "ly-heat", points: "ly-poi", overlay: "ly-overlay" };
    const out = {};
    Object.keys(ids).forEach(function (k) { const e = $(ids[k]); out[k] = e ? e.checked : true; });
    return out;
  }
  function hideCore() {
    ["water", "roads", "zones", "heat", "points", "overlay"].forEach(function (k) { host.mapApp.showLayer(k, false); });
  }
  function restoreCore() {
    if (!savedLayers) return;
    Object.keys(savedLayers).forEach(function (k) { host.mapApp.showLayer(k, savedLayers[k]); });
  }

  function roadStyle(f) {
    const p = f.properties || {};
    const width = { R1: 3.2, R2: 2.5, R3: 1.9, R4: 1.35, R5: 0.9, R6: 0.55 }[p.road_grade] || 0.7;
    if (mode === "cause") {
      const v = p.speed_pm_rain_kmh || 15;
      return { color: v >= 40 ? "#e7b83a" : v >= 22 ? "#e18138" : "#c84f48", weight: width, opacity: 0.8 };
    }
    return { color: "#526779", weight: Math.max(0.45, width * 0.62), opacity: 0.42 };
  }

  function redrawMap() {
    if (!active || !payload || !host) return;
    if (diagnosticLayer) diagnosticLayer.clearLayers();
    else diagnosticLayer = L.layerGroup().addTo(host.mapApp.map);
    const impact = new Map(payload.impacts.map(function (x) { return [x.block_id, x]; }));
    const recover = new Set(payload.proposal.recoverable_block_ids || []);

    L.geoJSON(zones, {
      filter: function (f) { return !f.properties.safety_clipped; },
      style: function (f) {
        const c = zoneColor(f.properties.functional_type);
        return { color: c, weight: 0.45, fillColor: c, fillOpacity: mode === "cause" ? 0.09 : 0.045, opacity: 0.35 };
      },
      interactive: false
    }).addTo(diagnosticLayer);

    L.geoJSON(blocks, {
      filter: function (f) { return impact.has(f.properties.block_id); },
      style: function (f) {
        const i = impact.get(f.properties.block_id);
        let fill = "#7b8994", op = 0.08;
        if (mode === "issue") {
          if (i.impact_state === "lost") { fill = "#df4a43"; op = 0.58; }
          else if (i.impact_state === "stable") { fill = "#22a784"; op = 0.38; }
        } else if (mode === "cause" && i.impact_state === "lost") {
          fill = "#ed8b36"; op = 0.58;
        } else if (mode === "plan") {
          if (recover.has(i.block_id)) { fill = "#27b5bc"; op = 0.58; }
          else if (i.impact_state === "lost") { fill = "#df4a43"; op = 0.48; }
          else if (i.impact_state === "stable") { fill = "#22a784"; op = 0.22; }
        }
        return { color: fill, weight: 0.8, fillColor: fill, fillOpacity: op, opacity: Math.max(0.2, op) };
      },
      onEachFeature: function (f, layer) {
        const i = impact.get(f.properties.block_id);
        layer.bindTooltip((i.impact_state === "lost" ? "雨天丢失覆盖" : "稳定覆盖") + "<br>平峰 " + i.base_eta_min + "min · 雨天 " + (i.rain_eta_min == null ? ">15" : i.rain_eta_min) + "min<br>功能：" + typeName(i.functional_type), { sticky: true });
      }
    }).addTo(diagnosticLayer);

    L.geoJSON(roads, {
      style: roadStyle,
      onEachFeature: function (f, layer) {
        const p = f.properties || {};
        layer.bindTooltip((p.name || p.ref || "Road V3") + " · " + p.road_grade + "<br>雨天 " + p.speed_pm_rain_kmh + "km/h" + (p.oneway ? " · 单行" : ""), { sticky: true });
      }
    }).addTo(diagnosticLayer);

    const station = payload.issue.station;
    L.circleMarker([station.lat, station.lng], { radius: 9, color: "#fff", weight: 2, fillColor: "#f0524c", fillOpacity: 1 })
      .bindTooltip(station.name + "<br>18车位 · 250kW").addTo(diagnosticLayer);
    if (mode === "cause") {
      L.polyline([[station.lat, station.lng], [payload.proposal.candidate.lat, payload.proposal.candidate.lng]], { color: "#dc513f", weight: 4, dashArray: "8 6", opacity: 0.85 })
        .bindTooltip("跨江通道瓶颈").addTo(diagnosticLayer);
    }
    if (mode === "plan") {
      const c = payload.proposal.candidate;
      L.marker([c.lat, c.lng], { icon: L.divIcon({ className: "ai-candidate-icon", html: "◆", iconSize: [24, 24], iconAnchor: [12, 12] }) })
        .bindTooltip(c.name + "<br>12车位 · 180kW", { permanent: true, direction: "right" }).addTo(diagnosticLayer);
    }
    updateLegend();
  }

  function updateLegend() {
    const title = $("legend-title"), body = $("legend-body");
    if (!title || !body) return;
    const configs = {
      issue: ["诊断图例 · 异常覆盖", "<span><i class='sw' style='background:#df4a43'></i>丢失覆盖</span><span><i class='sw' style='background:#22a784'></i>稳定覆盖</span>"],
      cause: ["诊断图例 · 空间根因", "<span><i class='sw' style='background:#c84f48'></i>低速路段</span><span><i class='sw' style='background:#ed8b36'></i>受影响区</span>"],
      plan: ["诊断图例 · 方案复验", "<span><i class='sw' style='background:#27b5bc'></i>预计追回</span><span><i class='sw' style='background:#df4a43'></i>剩余缺口</span>"]
    };
    title.textContent = configs[mode][0]; body.innerHTML = configs[mode][1];
  }

  function renderPanel() {
    const i = payload.issue, p = payload.proposal;
    $("ai-title").textContent = i.title;
    $("ai-id").textContent = i.issue_id + " · " + i.status;
    $("ai-kpis").innerHTML = [
      [i.baseline.blocks_10min + " → " + i.current.blocks_10min, "10min覆盖"],
      [i.delta.blocks_pct + "%", "覆盖变化", "bad"],
      [i.delta.demand_pct + "%", "需求变化", "bad"],
      ["-" + money(i.delta.revenue_rmb), "日服务费影响", "bad"]
    ].map(function (x) { return "<div><b class='" + (x[2] || "") + "'>" + x[0] + "</b><span>" + x[1] + "</span></div>"; }).join("");
    $("ai-gates").innerHTML = payload.trust_gate.map(function (g) { return "<div><b>" + g.name + " <em class='" + g.status + "'>" + g.value + "</em></b><span>" + g.note + "</span></div>"; }).join("");
    $("ai-causes").innerHTML = payload.causes.map(function (c) { return "<div class='ai-cause'><span>" + c.label + "</span><i><b style='width:" + c.contribution_pct + "%'></b></i><strong>" + c.contribution_pct + "%</strong></div>"; }).join("");
    const types = Object.entries(payload.lost_by_type).sort(function (a,b) { return b[1].blocks-a[1].blocks; }).slice(0,3).map(function (x) { return typeName(x[0]) + " " + x[1].blocks; }).join("、");
    $("ai-action").innerHTML = "<strong>" + p.title + "</strong><p>候选站 12车位 / 180kW，预计覆盖恢复至 " + p.predicted_blocks_10min + " 个街区。</p><p>主要受影响：" + types + "</p><div class='ai-gain'><b>＋" + money(p.estimated_incremental_service_revenue_day_rmb) + "</b><span>预计追回日服务费 · " + p.recoverable_blocks + "区 / " + p.estimated_incremental_orders_day + "单</span></div>";
    $("ai-task-id").textContent = payload.task.task_id + " · " + payload.task.status;
    $("ai-sla").innerHTML = [["响应",payload.task.sla.response],["诊断",payload.task.sla.diagnosis],["缓解",payload.task.sla.mitigation],["复验",payload.task.sla.revalidation]].map(function (x) { return "<div><b>" + x[0] + "</b><span>" + x[1] + "</span></div>"; }).join("");
    $("ai-next").textContent = "下一检查点：" + payload.task.next_checkpoint;
  }

  async function activate() {
    if (!host) return;
    try {
      await load();
      if (!active) { savedLayers = captureLayers(); active = true; }
      // Main app repaints its normal layers after zoom/scene state changes.
      // Re-apply the diagnostic layer gate every time this subscriber runs.
      hideCore();
      document.body.classList.add("anomaly-active");
      if (!diagnosticLayer) diagnosticLayer = L.layerGroup().addTo(host.mapApp.map);
      else if (!host.mapApp.map.hasLayer(diagnosticLayer)) diagnosticLayer.addTo(host.mapApp.map);
      host.mapApp.map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [20, 20] });
      redrawMap();
      host.setStatus("能源覆盖异常诊断 · Road V3 + ETA V2 + Zone V3");
    } catch (e) {
      console.error(e); host.setStatus("异常诊断数据加载失败");
    }
  }
  function deactivate() {
    if (!active || !host) return;
    if (diagnosticLayer) diagnosticLayer.clearLayers();
    document.body.classList.remove("anomaly-active");
    restoreCore(); active = false;
  }

  function bind() {
    const button = $("btn-energy-anomaly");
    if (button) button.onclick = function () {
      AppContext.setAnalysisScene("wd_pm_peak", "rain");
      AppContext.set({ side_panel: "anomaly" });
    };
    document.querySelectorAll("[data-ai-mode]").forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.getAttribute("data-ai-mode");
        document.querySelectorAll("[data-ai-mode]").forEach(function (x) { x.classList.toggle("on", x === b); });
        redrawMap();
      });
    });
    AppContext.subscribe(function (ctx) {
      if (
        ctx.active_pack === "energy" &&
        ctx.side_panel === "anomaly" &&
        (!ctx.region || !ctx.region.id || ctx.region.id === "lujiazui_bund")
      ) activate();
      else deactivate();
    });
  }

  function init() { host = global.LBSMaster; if (host) bind(); }
  if (global.LBSMaster) init();
  else global.addEventListener("lbs-master-ready", init, { once: true });
})(typeof window !== "undefined" ? window : globalThis);
