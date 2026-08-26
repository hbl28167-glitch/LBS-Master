(function (global) {
  "use strict";

  const DEFAULT = {
    persona: "analyst",
    region: { city: "shanghai", district: null },
    // 05.2 canonical analysis pair
    analysis_scene: { time_scenario: "wd_pm_peak", weather: "clear" },
    time_of_day: "wd_pm_peak",
    season_or_node: "baseline",
    weather: "clear",
    scenario: "A",
    active_scene: "overview",
    active_pack: "overview",
    selected_grid_id: null,
    selected_entity: null,
    selected_zone_id: null,
    selected_road_id: null,
    selected_site_id: null,
    layer_set: [
      "basemap",
      "water",
      "roads",
      "road_cong",
      "zones",
      "heat",
      "overlay"
    ],
    snapshot_id: null,
    roadDisplayMode: "cong",
    heatRenderMode: "poly",
    lodLevel: "district",
    storeFocusId: null,
    storeFocusMode: false,
    siting_open: false,
    siting_zone_id: null,
    congestion: {
      share_blocked: null,
      difficulty_coeff: 1,
      narrative: null,
      city_ci: null
    },
    metric_key: "ride_gap",
    side_panel: "list",
    trend_series: "weekday"
  };

  const PACK_SCENE = {
    overview: "overview",
    o2o: "o2o_store",
    ride: "ride",
    fulfillment: "delivery",
    energy: "chg",
    governance: "quality"
  };

  const PACK_LAYERS = {
    overview: ["basemap", "water", "roads", "road_cong", "zones", "heat", "overlay"],
    ride: ["basemap", "water", "roads", "road_cong", "zones", "heat", "overlay"],
    fulfillment: [
      "basemap",
      "water",
      "roads",
      "road_cong",
      "zones",
      "heat",
      "stores",
      "overlay"
    ],
    o2o: ["basemap", "water", "roads", "zones", "heat", "stores", "fence", "overlay"],
    energy: [
      "basemap",
      "water",
      "roads",
      "road_cong",
      "zones",
      "heat",
      "chargers",
      "overlay"
    ],
    governance: ["basemap", "water", "roads", "zones", "quality", "overlay"]
  };

  const listeners = new Set();
  let state = hydrate(DEFAULT);

  function hydrate(s) {
    const as = s.analysis_scene || {
      time_scenario: s.time_of_day || "wd_pm_peak",
      weather: s.weather || "clear"
    };
    return Object.assign({}, s, {
      region: Object.assign({}, s.region),
      analysis_scene: {
        time_scenario: as.time_scenario,
        weather: as.weather
      },
      time_of_day: as.time_scenario,
      weather: as.weather,
      layer_set: (s.layer_set || []).slice(),
      congestion: Object.assign({}, s.congestion || {})
    });
  }

  function clone(s) {
    const as = s.analysis_scene || {
      time_scenario: s.time_of_day,
      weather: s.weather
    };
    return {
      persona: s.persona,
      region: { city: s.region.city, district: s.region.district },
      analysis_scene: {
        time_scenario: as.time_scenario,
        weather: as.weather
      },
      time_of_day: as.time_scenario,
      season_or_node: s.season_or_node,
      weather: as.weather,
      scenario: s.scenario,
      active_scene: s.active_scene,
      active_pack: s.active_pack,
      selected_grid_id: s.selected_grid_id,
      selected_entity: s.selected_entity,
      selected_zone_id: s.selected_zone_id,
      selected_road_id: s.selected_road_id,
      selected_site_id: s.selected_site_id || null,
      layer_set: s.layer_set.slice(),
      snapshot_id: s.snapshot_id,
      roadDisplayMode: s.roadDisplayMode,
      heatRenderMode: s.heatRenderMode,
      lodLevel: s.lodLevel,
      storeFocusId: s.storeFocusId,
      storeFocusMode: s.storeFocusMode,
      siting_open: !!s.siting_open,
      siting_zone_id: s.siting_zone_id || null,
      congestion: Object.assign({}, s.congestion),
      metric_key: s.metric_key,
      side_panel: s.side_panel,
      trend_series: s.trend_series || "weekday"
    };
  }

  function get() {
    return clone(state);
  }

  function notify(prev) {
    const cur = get();
    listeners.forEach(function (fn) {
      try {
        fn(cur, prev);
      } catch (e) {
        console.error("AppContext subscriber", e);
      }
    });
  }

  function set(patch) {
    const prev = get();
    const next = Object.assign({}, state, patch || {});
    if (patch && patch.region) {
      next.region = Object.assign({}, state.region, patch.region);
    }
    if (patch && patch.layer_set) next.layer_set = patch.layer_set.slice();
    if (patch && patch.congestion) {
      next.congestion = Object.assign({}, state.congestion, patch.congestion);
    }
    // Keep analysis_scene ↔ time_of_day/weather mirrors in sync (05.2)
    if (patch && patch.analysis_scene) {
      next.analysis_scene = Object.assign(
        {},
        state.analysis_scene || {},
        patch.analysis_scene
      );
      next.time_of_day = next.analysis_scene.time_scenario;
      next.weather = next.analysis_scene.weather;
      next.scenario = next.weather === "rain" ? "B" : "A";
    } else if (patch && (patch.time_of_day || patch.weather)) {
      const ts = patch.time_of_day || state.time_of_day || "wd_pm_peak";
      const w = patch.weather || state.weather || "clear";
      next.analysis_scene = { time_scenario: ts, weather: w };
      next.time_of_day = ts;
      next.weather = w;
      if (patch.weather) next.scenario = w === "rain" ? "B" : "A";
    }
    if (patch && Object.prototype.hasOwnProperty.call(patch, "storeFocusId")) {
      if (patch.storeFocusId) {
        next.storeFocusMode = true;
        next.storeFocusId = patch.storeFocusId;
      } else {
        next.storeFocusMode = false;
        next.storeFocusId = null;
      }
    }
    if (patch && Object.prototype.hasOwnProperty.call(patch, "storeFocusMode") && !patch.storeFocusMode) {
      next.storeFocusId = null;
      next.storeFocusMode = false;
    }
    state = next;
    notify(prev);
    return get();
  }

  function subscribe(fn) {
    listeners.add(fn);
    return function () {
      listeners.delete(fn);
    };
  }

  function switchPack(pack) {
    const p = PACK_SCENE[pack] ? pack : "overview";
    const prevSet = (state.layer_set || []).slice();
    const packDef = (PACK_LAYERS[p] || PACK_LAYERS.overview).slice();
    const roadsOn =
      prevSet.indexOf("roads") >= 0 || prevSet.indexOf("road_cong") >= 0;
    const layer_set = packDef.filter(function (k) {
      if (k === "basemap") return prevSet.indexOf("basemap") >= 0;
      if (k === "water") return prevSet.indexOf("water") >= 0;
      if (k === "zones") return prevSet.indexOf("zones") >= 0;
      if (k === "heat") return prevSet.indexOf("heat") >= 0;
      if (k === "overlay") return prevSet.indexOf("overlay") >= 0;
      if (k === "roads" || k === "road_cong") return roadsOn;
      return true;
    });

    return set({
      active_pack: p,
      active_scene: PACK_SCENE[p],
      layer_set: layer_set,
      storeFocusId: null,
      storeFocusMode: false,
      siting_open: false,
      siting_zone_id: null,
      selected_site_id: p === "energy" ? state.selected_site_id : null,
      side_panel: p === "energy" ? "energy" : "list",
      metric_key:
        p === "ride"
          ? "ride_gap"
          : p === "fulfillment"
            ? "delivery_gap"
            : p === "energy"
              ? "chg_gap"
              : p === "o2o"
                ? "o2o_demand"
                : p === "governance"
                  ? "quality"
                  : "ride_gap"
    });
  }

  function applyScenario(id) {
    const sid = id === "B" ? "B" : "A";
    return set({
      scenario: sid,
      weather: sid === "B" ? "rain" : "clear"
    });
  }

  /** 05.2 two-card driver */
  function setAnalysisScene(timeScenario, weather) {
    return set({
      analysis_scene: {
        time_scenario: timeScenario || "wd_pm_peak",
        weather: weather || "clear"
      }
    });
  }

  function exportContext() {
    const c = get();
    return {
      persona: c.persona,
      region: c.region,
      analysis_scene: c.analysis_scene,
      time_of_day: c.time_of_day,
      season_or_node: c.season_or_node,
      weather: c.weather,
      scenario: c.scenario,
      active_scene: c.active_scene,
      active_pack: c.active_pack,
      selected_grid_id: c.selected_grid_id,
      selected_entity: c.selected_entity,
      selected_zone_id: c.selected_zone_id,
      selected_road_id: c.selected_road_id,
      selected_site_id: c.selected_site_id,
      layer_set: c.layer_set,
      snapshot_id: c.snapshot_id,
      roadDisplayMode: c.roadDisplayMode,
      heatRenderMode: c.heatRenderMode,
      lodLevel: c.lodLevel,
      storeFocusId: c.storeFocusId,
      storeFocusMode: c.storeFocusMode,
      siting_open: c.siting_open,
      siting_zone_id: c.siting_zone_id,
      congestion: c.congestion,
      metric_key: c.metric_key,
      trend_series: c.trend_series
    };
  }

  global.AppContext = {
    DEFAULT: DEFAULT,
    PACK_SCENE: PACK_SCENE,
    get: get,
    set: set,
    subscribe: subscribe,
    switchPack: switchPack,
    applyScenario: applyScenario,
    setAnalysisScene: setAnalysisScene,
    exportContext: exportContext
  };
})(typeof window !== "undefined" ? window : globalThis);
