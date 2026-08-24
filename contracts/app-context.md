# AppContext

Global UI / session state. Field names are frozen across workstreams.

**Acceptance truth for map UX:** PRD **05.1** (地图体验与空间体系).  
Legacy 05/06 fields below remain valid; **05.1 additions** are required for the business-map console.

## Canonical shape

```js
{
  // --- legacy (05 / 06) ---
  persona: "analyst",
  region: { city: "shanghai", district: null },
  time_of_day: "wd_pm_peak",
  season_or_node: "baseline",
  weather: "clear",
  scenario: "A",
  active_scene: "ride",
  active_pack: "overview",
  selected_grid_id: null,
  selected_entity: null,
  selected_zone_id: null,
  selected_road_id: null,
  layer_set: ["basemap", "water", "roads", "zones", "heat"],
  snapshot_id: null,

  // --- 05.1 map console ---
  roadDisplayMode: "cong",
  heatRenderMode: "poly",
  lodLevel: "city",
  storeFocusId: null,
  storeFocusMode: false,

  // read-only derived display (UI may recompute; snapshot may persist last values)
  congestion: {
    share_blocked: null,
    difficulty_coeff: 1,
    narrative: null
  }
}
```

## Field reference

### Core (unchanged semantics)

| Field | Notes |
|-------|--------|
| `persona` | Default `"analyst"` (P0). Narrative only; no ACL. |
| `region.city` | MVP fixed `"shanghai"` (incl. Lingang). |
| `time_of_day` | e.g. `wd_pm_peak` — also drives synthetic congestion. |
| `season_or_node` | e.g. `baseline`, `national_day` |
| `weather` | e.g. `clear`, `rain` |
| `scenario` | Sandbox A/B id: `"A"` \| `"B"` (not live traffic experiment). |
| `active_scene` | Gap definition key: `ride` \| `chg` \| `delivery` \| `o2o_store` \| … |
| `active_pack` | Top-nav pack: `overview` \| `o2o` \| `ride` \| `fulfillment` \| `energy` \| `governance` |
| `selected_grid_id` | Optional fine-cell id; **not** product hero layer (05.1 deletes 1km grid as main visual). Do **not** change `grid_id` algorithm without migrating C/D. |
| `selected_entity` | Generic entity ref or `null` (charger/store/…). Prefer typed focus fields when set. |
| `selected_zone_id` | Matches `zone.zone_id` or `null` |
| `selected_road_id` | Matches road feature id (OSM way / processed id) or `null` |
| `layer_set` | Visible layer tokens (see below) |
| `snapshot_id` | Export id or `null` |

### 05.1 — road / heat / LOD

| Field | Type | Values | Notes |
|-------|------|--------|--------|
| `roadDisplayMode` | string | `cong` \| `grade` \| `biz` | ① congestion (default) ② grade/speed class ③ business-difficulty tint. Whole-way one color, no direction split. |
| `heatRenderMode` | string | `poly` \| `grid` \| `kde` | 区面 / 细格(200–300m) / 核密度; **same metric**, default **`poly`**. |
| `lodLevel` | string | `city` \| `district` \| `block` | Coarse LOD band; UI may also derive from map zoom (see `lod.md`). |

### 05.1 — store focus (到店)

| Field | Type | Notes |
|-------|------|--------|
| `storeFocusId` | string \| null | Focused 小李 store entity id when in o2o single-store mode. |
| `storeFocusMode` | boolean | `true` → render primarily that store + coverage/fence/flow; fade/hide other stores. Exit → restore LOD rules. |

When `storeFocusMode` is true, `storeFocusId` must be non-null. Setting `storeFocusId` should set `storeFocusMode=true`; clearing id sets mode false.

### 05.1 — congestion (read-only display)

| Field | Type | Notes |
|-------|------|--------|
| `congestion.share_blocked` | number \| null | Share of visible roads in congested classes (0–1) for narrative bar. |
| `congestion.difficulty_coeff` | number | Multiplier into ride match difficulty / fulfillment ETA risk (default `1`). Driven by `time_of_day` × `weather`/`scenario` × road class rules (WS-C). |
| `congestion.narrative` | string \| null | One-line story for the narrative strip (not a KPI dump). |

These three are **display/derived**: producers may omit on cold start; UI must not crash if null.

## Default layer_set (overview, 05.1)

```text
basemap, water, roads, road_cong, zones, heat
```

Optional / mode: `heat_grid`, `heat_kde`, `stores`, `chargers`, `fence`, `eta_ring`, `quality`.

**Forbidden default:** coarse 1km product grid as hero fill (`grids_1km` must not be default-on).

## Switch rules

| Event | Inherit | Rewrite |
|-------|---------|---------|
| Business pack switch | region, time dims, weather, scenario, selected_zone/road/grid | `active_pack`, `active_scene`, default `layer_set`; prompt user |
| Scenario A→B (rain) | selection | weather/scenario; refresh heat + road cong + `congestion.*` |
| Enter store focus | pack=o2o | `storeFocusId`, `storeFocusMode=true` |
| Exit store focus | — | clear focus fields; restore LOD point density |
| LOD / zoom change | metrics | visibility of residential roads, store/charger density (see `lod.md`) |

## Snapshot export

Export payload should include at least: full AppContext (incl. 05.1 modes + congestion snapshot), selected ids, and active metric key.
