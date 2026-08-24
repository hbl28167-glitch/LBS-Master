(function (global) {
  "use strict";

  function createMapApp(elId, options) {
    const opts = options || {};
    const amapKey = (opts.amapKey || "").trim();
    const map = L.map(elId, {
      zoomControl: true,
      preferCanvas: true,
      minZoom: 9,
      maxZoom: 17
    });
    map.setView([31.23, 121.48], 12);

    let basemapOk = !!amapKey;
    if (amapKey) {
      L.tileLayer(
        "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
        {
          subdomains: "1234",
          maxZoom: 18,
          attribution: "© 高德地图 · © OSM"
        }
      ).addTo(map);
    } else {
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 18,
          attribution: "© CARTO · © OSM · fallback basemap"
        }
      ).addTo(map);
    }

    const waterLayer = L.layerGroup().addTo(map);
    const zoneBaseLayer = L.layerGroup().addTo(map);
    const heatLayer = L.layerGroup().addTo(map);
    const roadsLayer = L.layerGroup().addTo(map);
    const pointsLayer = L.layerGroup().addTo(map);
    const overlayLayer = L.layerGroup().addTo(map);

    let roadsFc = null;
    let roadsCanvas = null;
    let zoneLayers = new Map();
    let onRoadClick = null;
    let onZoneClick = null;
    let onStoreClick = null;
    let selectedRoadId = null;
    let selectedZoneId = null;
    let lastRoadStyleCtx = null;

    function setHandlers(h) {
      onRoadClick = h && h.onRoadClick;
      onZoneClick = h && h.onZoneClick;
      onStoreClick = h && h.onStoreClick;
    }

    function setWater(geojson) {
      waterLayer.clearLayers();
      if (!geojson || !geojson.features) return;
      L.geoJSON(geojson, {
        style: {
          color: "#1e3a5f",
          weight: 1,
          fillColor: "#0f2744",
          fillOpacity: 0.85,
          opacity: 0.9
        },
        interactive: false
      }).addTo(waterLayer);
    }

    function setZones(geojson, optsZ) {
      zoneBaseLayer.clearLayers();
      zoneLayers = new Map();
      if (!geojson || !geojson.features) return;
      const showType = !optsZ || optsZ.showType !== false;
      L.geoJSON(geojson, {
        style: function (f) {
          const p = f.properties || {};
          return {
            color: p.stroke || "#94a3b8",
            weight: 1.2,
            fillColor: showType ? p.fill || "#64748b" : "transparent",
            fillOpacity: showType ? p.fill_opacity != null ? p.fill_opacity : 0.32 : 0,
            opacity: 0.9
          };
        },
        onEachFeature: function (f, layer) {
          const p = f.properties || {};
          const zid = p.zone_id;
          if (zid) zoneLayers.set(zid, layer);
          layer.on("click", function (e) {
            L.DomEvent.stopPropagation(e);
            if (onZoneClick) onZoneClick(zid, p, f);
          });
          layer.bindTooltip(
            (p.name || zid || "") +
              (p.zone_type ? " · " + p.zone_type : "") +
              (p.grade ? " · " + p.grade : ""),
            { sticky: true, opacity: 0.9 }
          );
        }
      }).addTo(zoneBaseLayer);
    }

    function setZoneSelection(zid) {
      selectedZoneId = zid;
      zoneLayers.forEach(function (layer, id) {
        const on = id === zid;
        layer.setStyle({
          weight: on ? 2.5 : 1.2,
          color: on ? "#f8fafc" : layer.options.color
        });
      });
    }

    function clearHeat() {
      heatLayer.clearLayers();
    }

    /** Zone polygon heat: items {zone_id, value, fill} */
    function renderZoneHeat(geojson, valueByZone) {
      clearHeat();
      if (!geojson || !geojson.features) return;
      L.geoJSON(geojson, {
        style: function (f) {
          const p = f.properties || {};
          const zid = p.zone_id;
          const rec = valueByZone.get(zid);
          if (!rec) {
            return {
              fillOpacity: 0,
              opacity: 0,
              weight: 0
            };
          }
          return {
            color: "rgba(255,255,255,0.25)",
            weight: 0.8,
            fillColor: rec.fill,
            fillOpacity: 0.48,
            opacity: 0.7
          };
        },
        interactive: true,
        onEachFeature: function (f, layer) {
          const p = f.properties || {};
          const rec = valueByZone.get(p.zone_id);
          if (rec) {
            layer.bindTooltip(
              (p.name || p.zone_id) + "<br/>" + rec.label,
              { sticky: true }
            );
            layer.on("click", function (e) {
              L.DomEvent.stopPropagation(e);
              if (onZoneClick) onZoneClick(p.zone_id, p, f);
            });
          }
        }
      }).addTo(heatLayer);
    }

    /** Fine grid heat circles/rects */
    function renderFineHeat(cells) {
      clearHeat();
      const list = cells || [];
      const maxN = 6000;
      const draw = list.length > maxN ? list.slice(0, maxN) : list;
      for (let i = 0; i < draw.length; i++) {
        const c = draw[i];
        if (!c || c.lng == null) continue;
        const r = c.cell_m ? Math.max(80, c.cell_m * 0.35) : 120;
        L.circle([c.lat, c.lng], {
          radius: r,
          color: "transparent",
          fillColor: c.fill,
          fillOpacity: 0.4,
          interactive: false
        }).addTo(heatLayer);
      }
    }

    /** KDE-ish: soft circles at zone centroids weighted by value */
    function renderKde(points) {
      clearHeat();
      (points || []).forEach(function (p) {
        L.circle([p.lat, p.lng], {
          radius: p.radius || 900,
          color: "transparent",
          fillColor: p.fill || "rgba(240,113,120,0.35)",
          fillOpacity: 0.28,
          interactive: false
        }).addTo(heatLayer);
      });
    }

    function setRoads(geojson) {
      roadsFc = geojson;
      rebuildRoads(lastRoadStyleCtx || {});
    }

    function rebuildRoads(ctx) {
      lastRoadStyleCtx = ctx || {};
      roadsLayer.clearLayers();
      roadsCanvas = null;
      if (!roadsFc || !roadsFc.features) return;

      const mode = ctx.mode || "cong";
      const lod = ctx.lod || "district";
      const cityIndex = ctx.cityIndex != null ? ctx.cityIndex : 0.55;
      const weather = ctx.weather || "clear";
      const tod = ctx.tod || "wd_pm_peak";
      const difficulty = ctx.difficulty != null ? ctx.difficulty : 1;
      const zoom = map.getZoom();
      const show = ctx.show !== false;

      if (!show) return;

      const feats = roadsFc.features;
      // Build filtered FC by LOD
      const filtered = [];
      for (let i = 0; i < feats.length; i++) {
        const f = feats[i];
        const hw = (f.properties && f.properties.highway) || "";
        if (!LBSMetrics.roadClassVisible(hw, lod)) continue;
        // city: skip links sometimes
        if (lod === "city" && /_link$/.test(hw) && !/motorway|trunk/.test(hw))
          continue;
        filtered.push(f);
      }

      // Cap very large sets at city zoom
      let use = filtered;
      if (lod === "city" && use.length > 8000) {
        use = prioritizeRoads(use, 8000);
      } else if (use.length > 28000) {
        use = prioritizeRoads(use, 28000);
      }

      const fc = { type: "FeatureCollection", features: use };
      roadsCanvas = L.geoJSON(fc, {
        style: function (f) {
          return styleRoad(f, mode, cityIndex, weather, tod, difficulty, zoom);
        },
        onEachFeature: function (f, layer) {
          const p = f.properties || {};
          const id = String(p.osm_id != null ? p.osm_id : layer._leaflet_id);
          p._road_id = id;
          layer.on("click", function (e) {
            L.DomEvent.stopPropagation(e);
            if (onRoadClick) {
              const cong = LBSMetrics.wayCongestion(p, cityIndex, weather, tod);
              const ll = e.latlng
                ? [e.latlng.lat, e.latlng.lng]
                : firstLatLng(f);
              onRoadClick(id, p, cong, f, ll);
            }
          });
          const nm = p.name || p.ref || "未命名路段";
          layer.bindTooltip(nm + " · " + (p.highway || ""), {
            sticky: true,
            opacity: 0.85
          });
        }
      }).addTo(roadsLayer);

      if (selectedRoadId) highlightRoad(selectedRoadId);
    }

    function firstLatLng(f) {
      try {
        const c = f.geometry && f.geometry.coordinates;
        if (!c) return null;
        const ring = f.geometry.type === "LineString" ? c : c[0];
        if (ring && ring[0]) return [ring[0][1], ring[0][0]];
      } catch (e) {}
      return null;
    }

    function prioritizeRoads(feats, n) {
      const rank = function (hw) {
        if (/motorway/.test(hw)) return 0;
        if (/trunk/.test(hw)) return 1;
        if (/primary/.test(hw)) return 2;
        if (/secondary/.test(hw)) return 3;
        return 4;
      };
      return feats
        .slice()
        .sort(function (a, b) {
          return (
            rank((a.properties && a.properties.highway) || "") -
            rank((b.properties && b.properties.highway) || "")
          );
        })
        .slice(0, n);
    }

    function styleRoad(f, mode, cityIndex, weather, tod, difficulty, zoom) {
      const p = f.properties || {};
      const hw = p.highway || "";
      const cong = LBSMetrics.wayCongestion(p, cityIndex, weather, tod);
      let color = "#94a3b8";
      if (mode === "grade") color = LBSMetrics.gradeColor(hw);
      else if (mode === "biz") color = LBSMetrics.bizColor(cong, difficulty);
      else color = LBSMetrics.congColor(cong);
      const w = LBSMetrics.gradeWeight(hw, zoom);
      return {
        color: color,
        weight: w,
        opacity: mode === "grade" ? 0.9 : 0.88,
        lineCap: "round",
        lineJoin: "round"
      };
    }

    function highlightRoad(id) {
      selectedRoadId = id;
      if (!roadsCanvas) return;
      roadsCanvas.eachLayer(function (layer) {
        const p = layer.feature && layer.feature.properties;
        const rid = p && String(p.osm_id != null ? p.osm_id : "");
        const on = rid === String(id);
        if (on) {
          layer.setStyle({
            weight: (layer.options.weight || 2) + 2.5,
            opacity: 1
          });
          if (layer.bringToFront) layer.bringToFront();
        }
      });
    }

    function setPoints(list, kind, lod, focusId) {
      pointsLayer.clearLayers();
      if (!list || !list.length) return;
      let pts = list;
      if (focusId) {
        pts = list.filter(function (e) {
          return e.entity_id === focusId || e.name === focusId;
        });
      } else if (lod === "city") {
        // sample
        const step = Math.max(1, Math.ceil(list.length / 80));
        pts = [];
        for (let i = 0; i < list.length; i += step) pts.push(list[i]);
      } else if (lod === "district") {
        const step = Math.max(1, Math.ceil(list.length / 350));
        pts = [];
        for (let i = 0; i < list.length; i += step) pts.push(list[i]);
      }

      const color = kind === "charger" ? "#3dd68c" : "#56b6c2";
      pts.forEach(function (e) {
        if (e.lng == null || e.lat == null) return;
        const m = L.circleMarker([e.lat, e.lng], {
          radius: focusId ? 8 : 4,
          color: "#fff",
          weight: 1,
          fillColor: color,
          fillOpacity: 0.9
        });
        m.bindTooltip(e.name || e.entity_id, { direction: "top" });
        m.on("click", function (ev) {
          L.DomEvent.stopPropagation(ev);
          if (onStoreClick) onStoreClick(e);
        });
        m.addTo(pointsLayer);
      });
    }

    function setEtaRing(latlng, radiusM) {
      overlayLayer.clearLayers();
      if (!latlng) return;
      L.circle(latlng, {
        radius: radiusM || 1500,
        color: "#56b6c2",
        weight: 1.5,
        dashArray: "4 3",
        fillOpacity: 0.06
      }).addTo(overlayLayer);
    }

    function clearOverlay() {
      overlayLayer.clearLayers();
    }

    function showLayer(name, on) {
      const mapL = {
        water: waterLayer,
        zones: zoneBaseLayer,
        heat: heatLayer,
        roads: roadsLayer,
        points: pointsLayer,
        overlay: overlayLayer
      };
      const ly = mapL[name];
      if (!ly) return;
      if (on && !map.hasLayer(ly)) ly.addTo(map);
      if (!on && map.hasLayer(ly)) map.removeLayer(ly);
    }

    function fitBbox(bbox) {
      if (!bbox || bbox.length < 4) return;
      map.fitBounds(
        [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]]
        ],
        { padding: [24, 24], maxZoom: 12 }
      );
    }

    function focusLatLng(lat, lng, z) {
      map.setView([lat, lng], z || Math.max(map.getZoom(), 13), {
        animate: true
      });
    }

    map.on("zoomend", function () {
      if (opts.onZoom) opts.onZoom(map.getZoom());
    });

    return {
      map: map,
      basemapOk: basemapOk,
      setHandlers: setHandlers,
      setWater: setWater,
      setZones: setZones,
      setZoneSelection: setZoneSelection,
      renderZoneHeat: renderZoneHeat,
      renderFineHeat: renderFineHeat,
      renderKde: renderKde,
      clearHeat: clearHeat,
      setRoads: setRoads,
      rebuildRoads: rebuildRoads,
      highlightRoad: highlightRoad,
      setPoints: setPoints,
      setEtaRing: setEtaRing,
      clearOverlay: clearOverlay,
      showLayer: showLayer,
      fitBbox: fitBbox,
      focusLatLng: focusLatLng
    };
  }

  global.LBSMap = { createMapApp: createMapApp };
})(typeof window !== "undefined" ? window : globalThis);
