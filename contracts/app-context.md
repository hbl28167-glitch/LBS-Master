# AppContext

Global UI / session state. Field names are frozen across workstreams.

```js
{
  persona: "analyst",
  region: { city: "shanghai", district: null },
  time_of_day: "wd_pm_peak",
  season_or_node: "baseline",
  weather: "clear",
  scenario: "A",
  active_scene: "ride",
  selected_grid_id: null,
  selected_entity: null,
  layer_set: ["demand", "supply", "gap"],
  snapshot_id: null
}
```

| Field | Notes |
|-------|--------|
| `persona` | Default `"analyst"` (P0). Narrative only; no ACL. |
| `region.city` | MVP fixed `"shanghai"` (incl. Lingang). |
| `time_of_day` | e.g. `wd_pm_peak` |
| `season_or_node` | e.g. `baseline`, `national_day` |
| `weather` | e.g. `clear`, `rain` |
| `scenario` | Sandbox A/B id: `"A"` \| `"B"` |
| `active_scene` | Gap definition key: `ride` \| `chg` \| … |
| `selected_grid_id` | Matches `grid.grid_id` or `null` |
| `selected_entity` | Entity ref or `null` |
| `layer_set` | Visible layers |
| `snapshot_id` | Export id or `null` |

On business-pack switch: inherit region + time dims + selection; rewrite `active_scene` and prompt.
