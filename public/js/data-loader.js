(function (global) {
  "use strict";

  const DATA_BASE = "data/";

  async function fetchJson(name) {
    const url = DATA_BASE + name;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("failed to load " + url + " (" + res.status + ")");
    }
    return res.json();
  }

  async function loadAll(opts) {
    const o = opts || {};
    const needRoads = o.roads !== false;
    const tasks = {
      manifest: fetchJson("manifest.json"),
      grids: fetchJson("grids.json"),
      metrics_ride: fetchJson("metrics_ride.json"),
      weather: fetchJson("weather_coeff.json"),
      calendar: fetchJson("calendar.json"),
      anchors: fetchJson("anchors_shanghai.json"),
      corridor: fetchJson("corridor_copy.json").catch(function () {
        return { rules: [] };
      })
    };
    if (needRoads) {
      tasks.roads = fetchJson("roads_gcj.geojson").catch(function (e) {
        console.warn("roads not loaded", e);
        return null;
      });
    }
    const keys = Object.keys(tasks);
    const vals = await Promise.all(
      keys.map(function (k) {
        return tasks[k];
      })
    );
    const out = {};
    keys.forEach(function (k, i) {
      out[k] = vals[i];
    });
    return out;
  }

  global.LBSData = {
    loadAll: loadAll,
    fetchJson: fetchJson
  };
})(typeof window !== "undefined" ? window : globalThis);
