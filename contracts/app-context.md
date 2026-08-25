# AppContext

Global UI / session state. Field names are frozen across workstreams.

| Acceptance | Doc |
|------------|-----|
| Map shell / zones / LOD / heat modes | PRD **05.1** |
| **analysis_scene, layers, congestion bins, accessibility, energy site** | PRD **05.2** (wins on conflict for those topics) |

## Canonical shape

```js
{
  persona: "analyst",
  region: { city: "shanghai", district: null },

  // --- 05.2 analysis (source of truth for road CI / isochrone / difficulty) ---
  analysis_scene: {
    time_scenario: "wd_pm_peak",
    weather: "clear"
  },

  // --- legacy mirrors (compat; keep in sync with analysis_scene when writing) ---
  time_of_day: "wd_pm_peak",       // alias of time_scenario when using 6-bin ids
  weather: "clear",
  scenario: "A",                   // DEPRECATED as analysis driver (optional UI shortcut only)
  season_or_node: "baseline",      // node label for metrics; NOT a third analysis card

  active_scene: "ride",            // gap formula key: ride|chg|delivery|…
  active_pack: "overview",

  selected_grid_id: null,
  selected_entity: null,
  selected_zone_id: null,
  selected_road_id: null,
  selected_site_id: null,

  // all tokens optional; absence = layer off. basemap MAY be off (05.2).
  layer_set: ["basemap", "water", "roads", "zones", "heat"],

  snapshot_id: null,

  // --- 05.1 map console ---
  roadDisplayMode: "cong",
  heatRenderMode: "poly",
  lodLevel: "city",
  storeFocusId: null,
  storeFocusMode: false,
  siteFocusMode: false,

  // camera: flyTo only — NOT part of analysis_scene
  mapCamera: {
    preset_id: null,             // e.g. "lujiazui" | null
    // center/zoom applied by map; changing preset must not rewrite analysis_scene
  },

  congestion: {
    share_blocked: null,
    difficulty_coeff: 1,
    city_ci: null,
    narrative: null,
    synthetic: true
  }
}
```

## Field reference

### analysis_scene (05.2 Must)

See `analysis-scene.md`.

| Field | Values |
|-------|--------|
| `analysis_scene.time_scenario` | `wd_night` \| `wd_am_peak` \| `wd_day_offpeak` \| `wd_pm_peak` \| `we_day` \| `we_night` |
| `analysis_scene.weather` | `clear` \| `rain` \| `extreme` |

Chip copy example: `工作日·晚高峰 · 晴 · CI≈1.95` (Synthetic).

### Deprecated / demoted

| Field / concept | 05.2 rule |
|-----------------|-----------|
| Top-bar **镜头** as parallel “scenario” | **Removed from analysis IA.** Presets = `mapCamera` **flyTo only**. |
| `scenario` A/B as second weather axis | Prefer weather card; A/B may map to clear/rain shortcut only |
| Independent `wd_noon` | Merged into `wd_day_offpeak` |
| Ellipse zones as success | Geometry fail if still bubble-city (zone pipeline, not this file) |

### Selection

| Field | Notes |
|-------|--------|
| `selected_zone_id` | `zone.zone_id` — **id algorithm frozen** |
| `selected_road_id` | Road feature id |
| `selected_site_id` | Energy **site** id (`site.schema.json`); not stall id |
| `selected_grid_id` | Fine cell only; not hero layer; **grid_id algorithm frozen** |
| `storeFocusId` / `storeFocusMode` | 到店单店 |
| `siteFocusMode` | 能源单站 + service rings; requires `selected_site_id` |

### layer_set (05.2 · all toggleable)

Tokens present in the array = **on**. Missing = **off**.

| Token | Default overview | Notes |
|-------|------------------|--------|
| `basemap` | on | **Amap only**; user **may turn off** → dark empty basemap + vectors |
| `water` | on | 黄浦江等 |
| `roads` | on | geometry |
| `road_cong` | on when mode cong | congestion color (or fold into roads paint) |
| `zones` | on | functional polygons |
| `heat` | on | respects `heatRenderMode` |
| `overlay` | off | generic analysis overlay (rings, etc.) |
| `isochrone` | off | 5/10/15 rings when site focused |
| `stores` | pack-dependent | |
| `sites` / `chargers` | energy pack | **`sites` preferred** (site granularity) |
| `fence` | off | |
| `quality` | governance | |

**Forbidden default-on:** `grids_1km` hero fill.

UI layout (05.2): zoom control must stay clickable (NW/SW safe zone — implementation); layer dock must not block zoom permanently.

### road / heat / LOD (05.1)

| Field | Values | Notes |
|-------|--------|--------|
| `roadDisplayMode` | `cong` \| `grade` \| `biz` | See `road-display.md` (4-class cong) |
| `heatRenderMode` | `poly` \| `grid` \| `kde` | default `poly` |
| `lodLevel` | `city` \| `district` \| `block` | See `lod.md` |

### congestion (read-only display)

| Field | Notes |
|-------|--------|
| `share_blocked` | Visible ways in `cong`\|`severe` (0–1) |
| `difficulty_coeff` | From **same** CI table as `analysis_scene` |
| `city_ci` | Optional chip value |
| `narrative` | One hard metric + object, not KPI dump |
| `synthetic` | Always treat as true in delivery |

## Switch rules

| Event | Inherit | Rewrite |
|-------|---------|---------|
| Pack switch | `analysis_scene`, region, selections | `active_pack`, `active_scene`, default `layer_set` |
| Time or weather card | selections | `analysis_scene` (+ mirrors); road colors; rings if site focused; trend highlight |
| Camera preset | **everything analysis** | map center/zoom only |
| Enter site focus | analysis_scene | `selected_site_id`, `siteFocusMode`, `isochrone` on |
| Enter store focus | analysis_scene | `storeFocusId`, `storeFocusMode` |
| Layer toggle | — | `layer_set` add/remove token only |

## Snapshot export (05.2 energy path)

Include at least: `analysis_scene`, `selected_site_id`, power summary, isochrone bands meta, `coverage` zone ids, optional Δ vs alternate scene, full AppContext modes.
