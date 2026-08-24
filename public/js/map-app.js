(function (global) {
  "use strict";

  function parseGridId(id) {
    // sh:{cell_m}:{row}:{col}
    const p = String(id || "").split(":");
    if (p.length < 4) return null;
    return {
      cell_m: Number(p[1]),
      row: Number(p[2]),
      col: Number(p[3])
    };
  }

  function createMapApp(elId, options) {
    const opts = options || {};
    const amapKey = opts.amapKey || "";
    const map = L.map(elId, {
      zoomControl: true,
      preferCanvas: true
    });

    // Shanghai center (GCJ-ish)
    map.setView([31.23, 121.47], 11);

    let basemapOk = false;
    let basemapLayer = null;
    const attribution =
      '© <a href="https://www.openstreetmap.org/copyright">OSM</a>';

    // Same Gaode raster TMS as portfolio demos (GCJ-02). Tile URL has no key param;
    // amapKey reserved for JS API / open-platform apps. Always prefer 高德 for road align.
    const gaodeUrl =
      "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
    basemapLayer = L.tileLayer(gaodeUrl, {
      subdomains: "1234",
      maxZoom: 18,
      minZoom: 8,
      attribution: "© 高德地图 · " + attribution
    });
    let gaodeFailed = false;
    basemapLayer.on("tileerror", function () {
      if (gaodeFailed) return;
      gaodeFailed = true;
      // Network block / tile deny → WGS fallback (may offset vs GCJ roads)
      try {
        map.removeLayer(basemapLayer);
      } catch (e) {}
      basemapLayer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 18,
          attribution: "© CARTO · " + attribution + " · 高德瓦片不可用时的 fallback"
        }
      );
      basemapLayer.addTo(map);
      basemapOk = false;
    });
    basemapLayer.addTo(map);
    basemapOk = true;
    void amapKey;

    const gridLayer = L.layerGroup().addTo(map);
    const entityLayer = L.layerGroup().addTo(map);
    const qualityLayer = L.layerGroup().addTo(map);
    const sitingLayer = L.layerGroup().addTo(map);
    const roadsLayer = L.layerGroup();
    let roadsAdded = false;
    let roadsLoaded = false;
    let roadsGeo = null;
    let roadsGeoLayer = null;
    let selectedId = null;
    let onSelect = null;
    let cellHalfDeg = null;

    function estimateHalfDeg(gridsDoc) {
      // ~1000m cell → approx degrees at Shanghai lat
      const m = (gridsDoc && gridsDoc.cell_m) || 1000;
      const lat = 31.2;
      const dLat = m / 111320;
      const dLng = m / (111320 * Math.cos((lat * Math.PI) / 180));
      return { dLat: dLat / 2, dLng: dLng / 2, cell_m: m };
    }

    function clearGrids() {
      gridLayer.clearLayers();
    }

    function setOnSelect(fn) {
      onSelect = fn;
    }

    function setSelected(id) {
      selectedId = id;
      gridLayer.eachLayer(function (layer) {
        const gid = layer.options && layer.options.gridId;
        if (!gid) return;
        const isSel = gid === selectedId;
        layer.setStyle({
          weight: isSel ? 2.5 : 0.4,
          color: isSel ? "#f8fafc" : "rgba(15,23,42,0.35)",
          fillOpacity: isSel ? 0.78 : layer.options._baseOpacity || 0.55
        });
      });
    }

    /**
     * items: [{grid, value, metric, fill}]
     */
    function renderGrids(items, gridsDoc) {
      clearGrids();
      cellHalfDeg = estimateHalfDeg(gridsDoc);
      const list = items || [];
      // Cap for perf: prefer items already filtered; still hard-cap
      const maxDraw = 8000;
      const draw = list.length > maxDraw ? downsample(list, maxDraw) : list;

      for (let i = 0; i < draw.length; i++) {
        const it = draw[i];
        const g = it.grid;
        if (!g || g.cell_lng == null) continue;
        const h = cellHalfDeg;
        const bounds = [
          [g.cell_lat - h.dLat, g.cell_lng - h.dLng],
          [g.cell_lat + h.dLat, g.cell_lng + h.dLng]
        ];
        const fill = it.fill || "#64748b";
        const opacity = it.opacity != null ? it.opacity : 0.55;
        const rect = L.rectangle(bounds, {
          gridId: g.grid_id,
          _baseOpacity: opacity,
          color: "rgba(15,23,42,0.35)",
          weight: 0.4,
          fillColor: fill,
          fillOpacity: opacity,
          interactive: true
        });
        rect.on("click", function () {
          if (onSelect) onSelect(g.grid_id, g);
        });
        rect.bindTooltip(
          g.grid_id +
            (it.label
              ? "<br/>" + it.label
              : it.value != null
                ? "<br/>" + Number(it.value).toFixed(1)
                : ""),
          { sticky: true, opacity: 0.9 }
        );
        gridLayer.addLayer(rect);
      }
      if (selectedId) setSelected(selectedId);
    }

    function downsample(arr, n) {
      if (arr.length <= n) return arr;
      // keep highest |value| first if present
      const scored = arr.slice().sort(function (a, b) {
        const av = a.value == null ? 0 : Math.abs(a.value);
        const bv = b.value == null ? 0 : Math.abs(b.value);
        return bv - av;
      });
      return scored.slice(0, n);
    }

    function roadStyle(hw) {
      const h = String(hw || "");
      if (/motorway/.test(h))
        return { color: "#38bdf8", weight: 2.4, opacity: 0.92 };
      if (/trunk/.test(h))
        return { color: "#0ea5e9", weight: 2.0, opacity: 0.88 };
      if (/primary/.test(h))
        return { color: "#38bdf8", weight: 1.6, opacity: 0.8 };
      if (/secondary/.test(h))
        return { color: "#94a3b8", weight: 1.2, opacity: 0.7 };
      if (/tertiary/.test(h))
        return { color: "#64748b", weight: 0.9, opacity: 0.55 };
      return { color: "#475569", weight: 0.7, opacity: 0.45 };
    }

    function roadRank(hw) {
      const h = String(hw || "");
      if (/motorway/.test(h)) return 5;
      if (/trunk/.test(h)) return 4;
      if (/primary/.test(h)) return 3;
      if (/secondary/.test(h)) return 2;
      if (/tertiary/.test(h)) return 1;
      return 0;
    }

    function filterRoadsByZoom(feats, z) {
      // zoom strategy: no random thin-out; filter by class only
      let minRank = 1; // tertiary+
      if (z < 11) minRank = 3; // primary+
      else if (z < 12) minRank = 2; // secondary+
      const out = [];
      for (let i = 0; i < feats.length; i++) {
        const f = feats[i];
        const hw = f.properties && f.properties.highway;
        if (roadRank(hw) >= minRank) out.push(f);
      }
      // hard cap only if still huge at city zoom
      const maxF = z < 12 ? 18000 : 40000;
      if (out.length > maxF) {
        const step = Math.ceil(out.length / maxF);
        const capped = [];
        for (let i = 0; i < out.length; i += step) capped.push(out[i]);
        return capped;
      }
      return out;
    }

    function rebuildRoadsLayer() {
      roadsLayer.clearLayers();
      roadsGeoLayer = null;
      if (!roadsGeo || !roadsGeo.features) {
        roadsLoaded = false;
        return;
      }
      const z = map.getZoom();
      const feats = filterRoadsByZoom(roadsGeo.features, z);
      const layer = L.geoJSON(
        { type: "FeatureCollection", features: feats },
        {
          style: function (f) {
            return roadStyle(f.properties && f.properties.highway);
          },
          interactive: false
        }
      );
      roadsLayer.addLayer(layer);
      roadsGeoLayer = layer;
      roadsLoaded = true;
    }

    function setRoads(geojson) {
      roadsGeo = geojson;
      rebuildRoadsLayer();
    }

    map.on("zoomend", function () {
      if (roadsGeo && roadsAdded) rebuildRoadsLayer();
    });

    function showRoads(on) {
      if (on) {
        if (!roadsAdded) {
          roadsLayer.addTo(map);
          roadsAdded = true;
        }
      } else if (roadsAdded) {
        map.removeLayer(roadsLayer);
        roadsAdded = false;
      }
    }

    function fitToBbox(bbox) {
      if (!bbox || bbox.length < 4) return;
      map.fitBounds(
        [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]]
        ],
        { padding: [20, 20], maxZoom: 12 }
      );
    }

    function focusGrid(grid) {
      if (!grid) return;
      map.setView([grid.cell_lat, grid.cell_lng], Math.max(map.getZoom(), 13), {
        animate: true
      });
    }

    function clearEntities() {
      entityLayer.clearLayers();
    }

    function clearQuality() {
      qualityLayer.clearLayers();
    }

    function clearSiting() {
      sitingLayer.clearLayers();
    }

    /** chargers: [{lng,lat,name,brand,...}] brand display 小李充电 only */
    function renderChargers(list, opts) {
      clearEntities();
      const o = opts || {};
      if (o.visible === false) return;
      const arr = list || [];
      const maxN = o.max != null ? o.max : 200;
      const step = arr.length > maxN ? Math.ceil(arr.length / maxN) : 1;
      for (let i = 0; i < arr.length; i += step) {
        const e = arr[i];
        if (e.lat == null || e.lng == null) continue;
        const name = e.name || e.display_name || "小李充电";
        const m = L.circleMarker([e.lat, e.lng], {
          radius: 5,
          color: "#14532d",
          weight: 1,
          fillColor: o.color || "#22c55e",
          fillOpacity: 0.9
        });
        m.bindTooltip(name + (e.stalls != null ? " · " + e.stalls + "桩" : ""), {
          sticky: true
        });
        entityLayer.addLayer(m);
      }
    }

    /** issues: quality markers — purple/amber, legend 数据质量 */
    function renderQualityIssues(issues, opts) {
      clearQuality();
      const o = opts || {};
      if (o.visible === false) return;
      (issues || []).forEach(function (iss) {
        if (iss.lat == null || iss.lng == null) return;
        const col =
          iss.severity === "P0" ? "#a855f7" : iss.severity === "P1" ? "#f59e0b" : "#94a3b8";
        const m = L.circleMarker([iss.lat, iss.lng], {
          radius: iss.severity === "P0" ? 8 : 6,
          color: "#1e1b4b",
          weight: 1.5,
          fillColor: col,
          fillOpacity: 0.92
        });
        m.bindTooltip(
          "[" +
            iss.severity +
            "] " +
            (iss.display_name || "") +
            "<br/>" +
            (iss.title || iss.code),
          { sticky: true }
        );
        qualityLayer.addLayer(m);
      });
    }

    /** siting candidates A/B markers */
    function renderSitingCandidates(cands, opts) {
      clearSiting();
      const o = opts || {};
      if (o.visible === false) return;
      (cands || []).forEach(function (c, idx) {
        if (c.lat == null || c.lng == null) return;
        const isWin = o.winner && c.cand_id === o.winner;
        const m = L.circleMarker([c.lat, c.lng], {
          radius: isWin ? 10 : 8,
          color: isWin ? "#fbbf24" : "#e2e8f0",
          weight: 2,
          fillColor: idx === 0 ? "#3b82f6" : "#06b6d4",
          fillOpacity: 0.95
        });
        m.bindTooltip(
          (c.label || c.cand_id) +
            (c.total != null ? "<br/>分 " + c.total : ""),
          { sticky: true }
        );
        sitingLayer.addLayer(m);
      });
    }

    return {
      map: map,
      basemapOk: basemapOk,
      renderGrids: renderGrids,
      setSelected: setSelected,
      setOnSelect: setOnSelect,
      setRoads: setRoads,
      showRoads: showRoads,
      roadsLoaded: function () {
        return roadsLoaded;
      },
      fitToBbox: fitToBbox,
      focusGrid: focusGrid,
      clearGrids: clearGrids,
      renderChargers: renderChargers,
      clearEntities: clearEntities,
      renderQualityIssues: renderQualityIssues,
      clearQuality: clearQuality,
      renderSitingCandidates: renderSitingCandidates,
      clearSiting: clearSiting
    };
  }

  global.LBSMap = {
    createMapApp: createMapApp,
    parseGridId: parseGridId
  };
})(typeof window !== "undefined" ? window : globalThis);
