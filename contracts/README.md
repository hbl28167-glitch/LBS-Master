# contracts/ · LBS-Master

Frozen cross-WS field names. **Do not rename without HANDOFF + downstream rebuild.**

## Truth sources

| Topic | Doc |
|-------|-----|
| Portable / GitHub / synthetic brand | PRD 05 |
| **Map UX, zones, roads, heat, LOD, store focus** | **PRD 05.1** (wins on conflict) |
| Original WS plan | 06 / 07 |

## Files

| File | Role |
|------|------|
| `app-context.md` | Global session state (+ 05.1 modes) |
| `zone.schema.json` | Functional zone 区面 |
| `zone-color-tokens.md` | Type/grade color tokens |
| `lod.md` | city / district / block bands |
| `store-focus.md` | 到店单店聚焦 |
| `road-display.md` | roadDisplayMode + congestion display |
| `grid.schema.json` | Fine/legacy cell (**not** default hero layer) |
| `scene-gap.schema.json` | demand/supply base rows |
| `payload.schema.json` | manifest header |

## 05.1 delta (WS-A · 0824)

**Added**

- AppContext: `roadDisplayMode`, `heatRenderMode`, `lodLevel`, `storeFocusId`, `storeFocusMode`, `selected_zone_id`, `selected_road_id`, `active_pack`, `congestion.*`
- Zone model + color tokens + LOD + store-focus + road-display docs

**Unchanged (breaking if touched)**

- `grid_id` string algorithm / meaning — **do not change** without migrating metrics & UI
- Core AppContext time dims: `time_of_day`, `weather`, `scenario`, `active_scene`
- `manifest` required keys in `payload.schema.json`

**Product deprecation (not a schema delete)**

- 1km citywide grid as **main visual** is Won't (05.1). Schema kept for optional fine-grid heat / migration.

## Downstream

| WS | Must read |
|----|-----------|
| B / B2 | roads QC; zone geometry pipeline may emit `zone.schema.json` |
| C | metrics on zone_type×grade×tod; congestion coeffs → `congestion.difficulty_coeff` |
| D | default layers, three heat modes, road modes, LOD, narrative bar |
| E | store focus; pack tabs enabled |
