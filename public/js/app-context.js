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
    selected_grid_id: null,
    selected_entity: null,
    layer_set: ["gap"],
    snapshot_id: null,
    pack: "overview",
    ov_metric: "ride_gap"
  };

  const listeners = new Set();
  let state = Object.assign({}, DEFAULT, {
    region: Object.assign({}, DEFAULT.region)
  });

  function clone(s) {
    return {
      persona: s.persona,
      region: { city: s.region.city, district: s.region.district },
      time_of_day: s.time_of_day,
      season_or_node: s.season_or_node,
      weather: s.weather,
      scenario: s.scenario,
      active_scene: s.active_scene,
      selected_grid_id: s.selected_grid_id,
      selected_entity: s.selected_entity,
      layer_set: s.layer_set.slice(),
      snapshot_id: s.snapshot_id,
      pack: s.pack,
      ov_metric: s.ov_metric
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
        console.error("AppContext subscriber error", e);
      }
    });
  }

  function set(patch) {
    const prev = get();
    const next = Object.assign({}, state, patch);
    if (patch && patch.region) {
      next.region = Object.assign({}, state.region, patch.region);
    }
    if (patch && patch.layer_set) {
      next.layer_set = patch.layer_set.slice();
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

  /**
   * Switch business pack: inherit region + time dims + selection; rewrite active_scene.
   */
  function switchPack(pack) {
    const prev = get();
    let active_scene = "overview";
    let layer_set = ["gap"];
    if (pack === "ride") {
      active_scene = "ride";
      layer_set = ["demand", "supply", "gap"];
    } else if (pack === "overview") {
      active_scene = "overview";
      layer_set = ["gap"];
    } else {
      active_scene = pack;
      layer_set = state.layer_set.slice();
    }
    state = Object.assign({}, state, {
      pack: pack,
      active_scene: active_scene,
      layer_set: layer_set,
      // inherit: region, time_of_day, season_or_node, weather, scenario, selected_*
      selected_grid_id: state.selected_grid_id,
      selected_entity: state.selected_entity
    });
    notify(prev);
    return get();
  }

  /** Scenario A = clear + keep TOD; B = rain + same TOD. */
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
      selected_grid_id: c.selected_grid_id,
      selected_entity: c.selected_entity,
      layer_set: c.layer_set,
      snapshot_id: c.snapshot_id
    };
  }

  global.AppContext = {
    DEFAULT: DEFAULT,
    get: get,
    set: set,
    subscribe: subscribe,
    switchPack: switchPack,
    applyScenario: applyScenario,
    exportContext: exportContext
  };
})(typeof window !== "undefined" ? window : globalThis);
