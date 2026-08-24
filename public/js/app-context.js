(function (global) {
  "use strict";

  const DEFAULT = {
    persona: "analyst",
    region: { city: "shanghai", district: null },
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
    layer_set: ["basemap", "water", "roads", "road_cong", "zones", "heat"],
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
      narrative: null
    },
    metric_key: "ride_gap",
    side_panel: "list"
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
    overview: ["basemap", "water", "roads", "road_cong", "zones", "heat"],
    ride: ["basemap", "water", "roads", "road_cong", "zones", "heat"],
    fulfillment: ["basemap", "water", "roads", "road_cong", "zones", "heat", "stores"],
    o2o: ["basemap", "water", "roads", "zones", "heat", "stores", "fence"],
    energy: ["basemap", "water", "roads", "road_cong", "zones", "heat", "chargers"],
    governance: ["basemap", "water", "roads", "zones", "quality"]
  };

  const listeners = new Set();
  let state = hydrate(DEFAULT);

  function hydrate(s) {
    return Object.assign({}, s, {
      region: Object.assign({}, s.region),
      layer_set: (s.layer_set || []).slice(),
      congestion: Object.assign({}, s.congestion || {})
    });
  }

  function clone(s) {
    return {
      persona: s.persona,
      region: { city: s.region.city, district: s.region.district },
      time_of_day: s.time_of_day,
      season_or_node: s.season_or_node,
      weather: s.weather,
      scenario: s.scenario,
      active_scene: s.active_scene,
      active_pack: s.active_pack,
      selected_grid_id: s.selected_grid_id,
      selected_entity: s.selected_entity,
      selected_zone_id: s.selected_zone_id,
      selected_road_id: s.selected_road_id,
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
      side_panel: s.side_panel
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
    return set({
      active_pack: p,
      active_scene: PACK_SCENE[p],
      layer_set: (PACK_LAYERS[p] || PACK_LAYERS.overview).slice(),
      storeFocusId: null,
      storeFocusMode: false,
      siting_open: false,
      siting_zone_id: null,
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

  function exportContext() {
    const c = get();
    return {
      persona: c.persona,
      region: c.region,
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
      metric_key: c.metric_key
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
    exportContext: exportContext
  };
})(typeof window !== "undefined" ? window : globalThis);
