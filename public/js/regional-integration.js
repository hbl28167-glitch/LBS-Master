(function (global) {
  "use strict";

  let host = null;
  let currentId = null;
  let bundle = null;
  let loadToken = 0;
  let layerSet = null;
  let roadGeo = null;
  let zoneGeo = null;
  let buildingGeo = null;
  let entityLayer = null;

  const $ = function (id) { return document.getElementById(id); };
  const zoneColors = {
    commercial: "#EFA98F",
    office: "#AFCBE8",
    residential: "#F3E9D2",
    industrial: "#AEBCCA",
    public_service: "#B9D8C1",
    mixed: "#D9C6B8"
  };
  const entityColors = {
    residential_origin: "#f472b6",
    store: "#fb923c",
    charger: "#22d3ee",
    warehouse: "#34d399",
    pickup: "#facc15",
    dropoff: "#60a5fa"
  };
  const entityLabels = {
    residential_origin: "住宅需求起点",
    store: "门店",
    charger: "充电场站",
    warehouse: "仓库",
    pickup: "上客点",
    dropoff: "下客点"
  };

  function isRegional(ctx) {
    return !!(ctx && ctx.region && ctx.region.id && ctx.region.id !== "lujiazui_bund");
  }

  function ensureLayers() {
    if (layerSet || !host) return;
    layerSet = {
      zones: L.layerGroup(),
      buildings: L.layerGroup(),
      roads: L.layerGroup(),
      entities: L.layerGroup()
    };
    host.mapApp.map.on("zoomend", function () {
      if (bundle) applyGate(AppContext.get());
    });
    host.mapApp.map.on("moveend", function () {
      if (bundle && host.mapApp.map.getZoom() >= 14) refreshBuildings();
    });
  }

  function removeLayer(layer) {
    if (layer && host.mapApp.map.hasLayer(layer)) host.mapApp.map.removeLayer(layer);
  }

  function clearRegional() {
    if (!layerSet) return;
    Object.keys(layerSet).forEach(function (key) {
      layerSet[key].clearLayers();
      removeLayer(layerSet[key]);
    });
    roadGeo = null;
    zoneGeo = null;
    buildingGeo = null;
    entityLayer = null;
  }

  function hideCore() {
    ["roads", "zones", "heat", "points", "overlay"].forEach(function (name) {
      host.mapApp.showLayer(name, false);
    });
  }

  function setVisible(layer, show) {
    if (!layer) return;
    if (show && !host.mapApp.map.hasLayer(layer)) layer.addTo(host.mapApp.map);
    if (!show) removeLayer(layer);
  }

  function roadStyle(feature, ctx) {
    const p = feature.properties || {};
    const grade = p.road_grade || "R6";
    const widths = { R1: 2.8, R2: 2.4, R3: 1.9, R4: 1.45, R5: 1.05, R6: 0.7 };
    const gradeColors = {
      R1: "#38bdf8", R2: "#60a5fa", R3: "#93c5fd",
      R4: "#94a3b8", R5: "#64748b", R6: "#475569"
    };
    let color = gradeColors[grade] || "#64748b";
    if (ctx.roadDisplayMode !== "grade") {
      const weather = (ctx.analysis_scene && ctx.analysis_scene.weather) || ctx.weather;
      const speed = weather === "rain"
        ? Number(p.speed_pm_rain_kmh || p.speed_pm_kmh || p.speed_base_kmh || 12)
        : Number(p.speed_pm_kmh || p.speed_base_kmh || 12);
      const ratio = speed / Math.max(1, Number(p.speed_base_kmh || speed));
      color = ratio < 0.6 ? "#ef5f67" : ratio < 0.72 ? "#fb923c" : ratio < 0.84 ? "#e6c07b" : "#3dd68c";
    }
    return {
      color: color,
      weight: widths[grade] || 1,
      opacity: grade === "R6" ? 0.58 : 0.84
    };
  }

  function allEntities() {
    return (bundle && bundle.entities && (bundle.entities.entities || bundle.entities)) || [];
  }

  function drawEntities(ctx) {
    if (!bundle || !layerSet) return;
    layerSet.entities.clearLayers();
    const entities = allEntities();
    const allowed = {
      overview: [],
      o2o: ["residential_origin", "store"],
      ride: ["residential_origin", "pickup", "dropoff"],
      fulfillment: ["residential_origin", "warehouse", "store"],
      energy: ["residential_origin", "charger"],
      governance: null
    }[ctx.active_pack];
    entities
      .filter(function (entity) {
        return !allowed || allowed.indexOf(entity.entity_type) >= 0;
      })
      .forEach(function (entity) {
        const marker = L.circleMarker([entity.lat, entity.lng], {
          radius: entity.entity_type === "residential_origin" ? 5 : 7,
          color: "#07111d",
          weight: 2,
          fillColor: entityColors[entity.entity_type] || "#f8fafc",
          fillOpacity: 0.95
        });
        marker.bindTooltip(
          "<strong>" + entity.name + "</strong><br>" +
          entity.entity_type + " · Synthetic<br>" +
          (entity.role || ""),
          { sticky: true }
        );
        marker.bindPopup(
          "<div class='entity-popup'><strong>" + entity.name + "</strong>" +
          "<div>类型：" + (entityLabels[entity.entity_type] || entity.entity_type) + "</div>" +
          "<div>角色：" + (entity.role === "demand_origin" ? "需求端" : "供给/服务端") + "</div>" +
          "<div>关联地块：" + String(entity.zone_id || "—").split(":").slice(-1)[0] + "</div>" +
          "<div>接入道路：" + (entity.nearest_road_id || "—") + "</div>" +
          "<small>Synthetic · 点击地图空白处关闭</small></div>"
        );
        marker.on("click", function () {
          marker.setStyle({ radius: 10, color: "#f8fafc", weight: 3 });
        });
        marker.on("popupclose", function () {
          marker.setStyle({
            radius: entity.entity_type === "residential_origin" ? 5 : 7,
            color: "#07111d",
            weight: 2
          });
        });
        marker.addTo(layerSet.entities);
      });
    entityLayer = layerSet.entities;
  }

  function drawRegional(ctx) {
    ensureLayers();
    clearRegional();
    zoneGeo = L.geoJSON(bundle.zones, {
      style: function (feature) {
        const p = feature.properties || {};
        return {
          color: zoneColors[p.functional_type] || "#94a3b8",
          weight: 0.55,
          opacity: 0.38,
          fillColor: zoneColors[p.functional_type] || "#64748b",
          fillOpacity: 0.11
        };
      },
      onEachFeature: function (feature, layer) {
        const p = feature.properties || {};
        layer.bindTooltip(
          "功能地块（推断） · " + (p.functional_type || "mixed") +
          " · 建筑 " + (p.building_count || 0) +
          " · 置信度 " + Math.round(Number(p.confidence || 0) * 100) + "%",
          { sticky: true }
        );
      }
    }).addTo(layerSet.zones);

    roadGeo = L.geoJSON(bundle.roads, {
      renderer: L.canvas({ padding: 0.35 }),
      style: function (feature) { return roadStyle(feature, ctx); },
      onEachFeature: function (feature, layer) {
        const p = feature.properties || {};
        layer.bindTooltip(
          "<strong>" + (p.name || "未命名道路") + "</strong><br>" +
          (p.road_grade || "") + " · " +
          (p.speed_pm_kmh || "—") + " km/h 晚高峰 · " +
          (p.speed_source || ""),
          { sticky: true }
        );
      }
    }).addTo(layerSet.roads);
    drawEntities(ctx);
    applyGate(ctx);
  }

  function refreshBuildings() {
    if (!bundle || !layerSet || !bundle.meta.buildings_real || !bundle.buildings) return;
    if (host.mapApp.map.getZoom() < 14) {
      layerSet.buildings.clearLayers();
      buildingGeo = null;
      return;
    }
    const bounds = host.mapApp.map.getBounds().pad(0.18);
    const visible = (bundle.buildings.features || []).filter(function (feature) {
      const p = feature.properties || {};
      const lat = Number(p.centroid_lat);
      const lng = Number(p.centroid_lng);
      return Number.isFinite(lat) && Number.isFinite(lng) && bounds.contains([lat, lng]);
    });
    layerSet.buildings.clearLayers();
    buildingGeo = L.geoJSON(
      { type: "FeatureCollection", features: visible },
      {
        renderer: L.canvas({ padding: 0.3 }),
        interactive: false,
        style: {
          color: "#8da4b9",
          weight: 0.35,
          opacity: 0.72,
          fillColor: "#d9e3ea",
          fillOpacity: 0.3
        }
      }
    ).addTo(layerSet.buildings);
    if (roadGeo && roadGeo.bringToFront) roadGeo.bringToFront();
  }

  function applyGate(ctx) {
    if (!bundle || !layerSet) return;
    hideCore();
    const layers = ctx.layer_set || [];
    const roadsOn = layers.indexOf("roads") >= 0 || layers.indexOf("road_cong") >= 0;
    const zonesOn = layers.indexOf("zones") >= 0;
    if (roadGeo) roadGeo.setStyle(function (feature) { return roadStyle(feature, ctx); });
    setVisible(layerSet.zones, zonesOn);
    setVisible(layerSet.roads, roadsOn);
    setVisible(layerSet.entities, true);
    const showBuildings =
      zonesOn && bundle.meta.buildings_real && host.mapApp.map.getZoom() >= 14;
    if (showBuildings && !buildingGeo) refreshBuildings();
    if (!showBuildings) {
      layerSet.buildings.clearLayers();
      buildingGeo = null;
    }
    setVisible(layerSet.buildings, showBuildings);
  }

  function sceneFor(ctx) {
    const rows = (bundle.metrics && (bundle.metrics.rows || bundle.metrics)) || [];
    const a = ctx.analysis_scene || {};
    const exact = rows.find(function (row) {
      return row.time_scenario === a.time_scenario && row.weather === a.weather;
    });
    if (exact) return exact;
    return rows.find(function (row) {
      return row.time_scenario === "wd_pm_peak" && row.weather === a.weather;
    }) || rows[0] || {};
  }

  function entitySummary() {
    const entities = allEntities();
    const counts = {};
    entities.forEach(function (entity) {
      counts[entity.entity_type] = (counts[entity.entity_type] || 0) + 1;
    });
    return Object.keys(counts).map(function (key) {
      return "<span><i style='background:" + (entityColors[key] || "#94a3b8") + "'></i>" +
        key + " " + counts[key] + "</span>";
    }).join("");
  }

  function renderPanel(ctx) {
    const root = $("regional-case");
    if (!root || !bundle) return;
    const meta = bundle.meta;
    const scene = sceneFor(ctx);
    const coverage = Number(scene.coverage_10min_ratio || 0) * 100;
    const roadQc = meta.road_qc || {};
    const zoneQc = meta.zone_qc || {};
    const conditional = meta.status !== "ready";
    root.innerHTML =
      "<div class='regional-head'><div><span class='regional-state " +
      (conditional ? "conditional" : "ready") + "'>" +
      (conditional ? "CONDITIONAL" : "READY") +
      "</span><strong>" + currentId.replace(/_/g, " ") + "</strong></div>" +
      "<small>Synthetic 业务指标</small></div>" +
      "<div class='regional-scene'>" +
      (scene.note || "当前情景") + " · " +
      (scene.time_scenario || "") + " × " + (scene.weather || "") +
      "</div>" +
      "<div class='regional-kpis'>" +
      "<div><b>" + coverage.toFixed(1) + "%</b><span>10min覆盖</span></div>" +
      "<div><b>" + Number(scene.eta_p90_min || 0).toFixed(1) + "min</b><span>P90 ETA</span></div>" +
      "<div><b>" + Number(scene.gap_index || 0).toFixed(0) + "</b><span>供需缺口</span></div>" +
      "<div><b>" + Number(scene.lost_orders || 0).toFixed(0) + "</b><span>损失订单</span></div>" +
      "</div>" +
      "<section class='regional-card'><h3>Trust Gate <small>" +
      (conditional ? "有限通过" : "通过") + "</small></h3>" +
      "<div class='regional-trust'>" +
      "<div><span>Road V3</span><b>" + Number(roadQc.giant_component_ratio || 0).toFixed(3) + "</b></div>" +
      "<div><span>Zone V3</span><b>" + (zoneQc.zone_count || 0) + " 区</b></div>" +
      "<div><span>建筑</span><b>" +
      (meta.buildings_real ? meta.buildings_visualized + " 真轮廓" : "未展示") +
      "</b></div>" +
      "<div><span>实体</span><b>" + ((meta.entity_qc || {}).entity_count || 0) + " 个</b></div>" +
      "</div>" +
      (conditional
        ? "<p class='regional-warning'>质量门禁：合成建筑种子已隐藏，或路网连通率未达 0.97 目标；不影响区域案例浏览，但不宣称完整高精数据。</p>"
        : "<p class='regional-ok'>道路、区划与真实建筑已接入。放大到 14 级查看建筑细节。</p>") +
      "</section>" +
      "<section class='regional-card'><h3>业务节点 <small>住宅是需求端</small></h3>" +
      "<div class='regional-entities'>" + entitySummary() + "</div>" +
      "</section>" +
      "<section class='regional-card'><h3>决策建议 <small>基于当前情景</small></h3>" +
      "<p>覆盖下降时优先检查道路阻抗、住宅起点与供给节点距离，再评估补站、门店、上客点或仓网调整。</p>" +
      "<div class='regional-impact'>当前情景服务 " +
      Number(scene.served_orders || 0).toFixed(0) + " 单 · 估算服务费 ¥" +
      Number(scene.revenue_or_fee_rmb || 0).toLocaleString("zh-CN") +
      " · Synthetic</div></section>" +
      "<div class='regional-source'>" + meta.disclosure + "</div>";
  }

  async function activate(ctx) {
    const regionId = ctx.region.id;
    ensureLayers();
    hideCore();
    if ($("regional-case") && currentId !== regionId) {
      $("regional-case").innerHTML =
        "<div class='regional-loading'>正在加载 " + regionId.replace(/_/g, " ") +
        " 的 Road V3 / Zone V3 / 建筑 / 业务实体…</div>";
    }
    if (currentId === regionId && bundle) {
      drawEntities(ctx);
      applyGate(ctx);
      renderPanel(ctx);
      return;
    }
    currentId = regionId;
    bundle = null;
    clearRegional();
    const token = ++loadToken;
    try {
      const loaded = await LBSData.loadRegion(regionId);
      if (token !== loadToken || currentId !== regionId) return;
      bundle = loaded;
      drawRegional(ctx);
      if (zoneGeo && zoneGeo.getBounds && zoneGeo.getBounds().isValid()) {
        host.mapApp.map.fitBounds(zoneGeo.getBounds(), {
          padding: [26, 26],
          maxZoom: 13,
          animate: false
        });
      }
      renderPanel(ctx);
      host.setStatus(
        "区域数据已接入 · " + regionId +
        " · roads " + loaded.meta.road_qc.feature_count +
        " · zones " + loaded.meta.zone_qc.zone_count +
        " · buildings " + loaded.meta.buildings_visualized
      );
    } catch (error) {
      console.error("regional data load failed", error);
      if ($("regional-case")) {
        $("regional-case").innerHTML =
          "<div class='err'>区域数据加载失败：" + error.message + "</div>";
      }
      host.setStatus("区域数据加载失败 · " + regionId);
    }
  }

  function deactivate() {
    loadToken += 1;
    currentId = null;
    bundle = null;
    clearRegional();
  }

  function onState(ctx) {
    if (isRegional(ctx)) activate(ctx);
    else deactivate();
  }

  function init() {
    host = global.LBSMaster;
    if (!host) return;
    AppContext.subscribe(onState);
    onState(AppContext.get());
  }

  if (global.LBSMaster) init();
  else global.addEventListener("lbs-master-ready", init, { once: true });
})(typeof window !== "undefined" ? window : globalThis);
