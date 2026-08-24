(function (global) {
  "use strict";

  const DATA_BASE = "data/";

  async function fetchJson(name) {
    const url = DATA_BASE + name;
    const res = await fetch(url);
    if (!res.ok) throw new Error("failed " + url + " (" + res.status + ")");
    return res.json();
  }

  async function tryJson(name, fallback) {
    try {
      return await fetchJson(name);
    } catch (e) {
      if (fallback !== undefined) return fallback;
      throw e;
    }
  }

  async function loadCore() {
    const [
      manifest,
      zonesGeo,
      zonesMeta,
      metrics_zone,
      metrics_ride,
      metrics_delivery,
      metrics_chg,
      metrics_o2o,
      weather,
      calendar,
      congestion,
      corridor,
      anchors,
      water,
      roads_meta,
      stores,
      chargers,
      roads
    ] = await Promise.all([
      fetchJson("manifest.json"),
      fetchJson("zones_shanghai.geojson"),
      tryJson("zones_shanghai.json", { zones: [] }),
      tryJson("metrics_zone.json", { rows: [] }),
      fetchJson("metrics_ride.json"),
      tryJson("metrics_delivery.json", { rows: [] }),
      tryJson("metrics_chg.json", { rows: [] }),
      tryJson("metrics_o2o.json", { rows: [] }),
      fetchJson("weather_coeff.json"),
      fetchJson("calendar.json"),
      tryJson("congestion_coeff.json", { scopes: {} }),
      tryJson("corridor_copy.json", { rules: [] }),
      tryJson("anchors_shanghai.json", { anchors: [] }),
      tryJson("water_shanghai.geojson", {
        type: "FeatureCollection",
        features: []
      }),
      tryJson("roads_meta.json", {}),
      tryJson("entities_store.json", { entities: [] }),
      tryJson("entities_charger.json", { entities: [] }),
      tryJson("roads_gcj.geojson", null)
    ]);

    return {
      manifest: manifest,
      zonesGeo: zonesGeo,
      zonesMeta: zonesMeta,
      metrics_zone: metrics_zone,
      metrics_ride: metrics_ride,
      metrics_delivery: metrics_delivery,
      metrics_chg: metrics_chg,
      metrics_o2o: metrics_o2o,
      weather: weather,
      calendar: calendar,
      congestion: congestion,
      corridor: corridor,
      anchors: anchors,
      water: water,
      roads_meta: roads_meta,
      stores: stores,
      chargers: chargers,
      roads: roads,
      heat_fine: null,
      grids_fine: null
    };
  }

  async function loadHeatFine() {
    try {
      const [heat_fine, grids_fine] = await Promise.all([
        fetchJson("metrics_heat_fine.json"),
        fetchJson("grids_fine.json")
      ]);
      return { heat_fine: heat_fine, grids_fine: grids_fine };
    } catch (e) {
      console.warn("fine heat not available", e.message || e);
      return { heat_fine: null, grids_fine: null };
    }
  }

  global.LBSData = {
    loadCore: loadCore,
    loadHeatFine: loadHeatFine,
    fetchJson: fetchJson
  };
})(typeof window !== "undefined" ? window : globalThis);
