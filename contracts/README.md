# contracts/ · LBS-Master

Frozen cross-WS field names. **Do not rename without HANDOFF + downstream rebuild.**

## Truth sources

| Topic | Doc |
|-------|-----|
| Portable / GitHub / synthetic brand | PRD 05 |
| Map UX, zones colors, LOD, heat modes, store focus | PRD **05.1** |
| **analysis_scene, congestion bins, layers, accessibility E, energy site, camera≠scene** | PRD **05.2** (wins on those topics) |
| Original WS plan | 06 / 07 |

## Files

| File | Role |
|------|------|
| `app-context.md` | Global session (+ 05.1/05.2) |
| `analysis-scene.md` | 6× time_scenario + weather; camera demoted |
| `accessibility.md` + `accessibility.schema.json` | E fromPoint request/result |
| `site.md` + `site.schema.json` | Energy **site** + power fields |
| `zone.schema.json` | Functional zone 区面 (`zone_id` frozen) |
| `zone-color-tokens.md` | Type/grade color tokens |
| `lod.md` | city / district / block |
| `store-focus.md` | 到店单店聚焦 |
| `road-display.md` | roadDisplayMode + **4-class** cong + Synthetic |
| `grid.schema.json` | Fine/legacy cell (`grid_id` frozen; not hero) |
| `scene-gap.schema.json` | demand/supply base rows |
| `payload.schema.json` | manifest header |

## 05.2 delta (WS-A)

**Added**

- `analysis_scene = { time_scenario, weather }` with 6 time bins (平峰 merged → `wd_day_offpeak`)
- Camera / 镜头 = flyTo only (`mapCamera`); not a third scenario axis
- `layer_set`: **basemap optional off**; water/roads/zones/heat/overlay/sites all toggleable
- Road `cong_class`: `free` \| `slow` \| `cong` \| `severe` + Synthetic
- Accessibility E: FromPointRequest / AccessibilityResult
- Energy `site`: `site_id`, `max_power_kw` / `power_structure`, `stall_count`; not stall-map hero
- AppContext: `selected_site_id`, `siteFocusMode`, `congestion.city_ci`, `congestion.synthetic`

**Unchanged (breaking if touched)**

- `grid_id` / `zone_id` algorithms  
- `payload.schema.json` required manifest keys  

**Deprecated semantics**

- Lens presets as analysis “情景”  
- `scenario` A/B as primary weather driver  
- Independent noon time bin  

## Downstream

| WS | Must read |
|----|-----------|
| B / B2 | roads + name for anchors; zone **polygon** not ellipse; ids frozen |
| C | CI tables keyed by `time_scenario`×`weather`; **site**-level entities + power; metrics on zones |
| D | Two cards (time/weather); layer dock; 4-class legend; trend binds `analysis_scene`; camera flyTo only |
| E | Accessibility E; energy KPI/list/detail; site focus + rings; power fields |
