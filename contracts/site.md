# Energy site (PRD 05.2 §3.6)

## Granularity

| Layer | Role |
|-------|------|
| **`site`** | Default unit for **map, list, KPI, focus, isochrone source** |
| Stall / gun | Attributes only: `stall_count`, optional per-kW counts inside `power_structure` |
| Forbidden | Per-stall polygons / “thousand piles all lit” as product hero |

Target Shanghai synthetic density: **~800–1500 sites** (not 800–1500 map piles pretending to be sites). If legacy data is pile-as-point, **merge to site** in build (WS-C).

## Required fields

See `site.schema.json`. Power **Must**: at least one of:

- `max_power_kw` — site peak kW  
- `power_structure` — e.g. `4×250kW + 2×120kW` or structured `guns[]`

List may show tier tag derived from max (e.g. 「250kW 级」).

## AppContext focus (energy)

```js
{
  selected_site_id: null,   // preferred
  siteFocusMode: false,     // true → highlight one site, fade others + show rings
  // selected_entity may mirror selected_site_id for generic handlers
}
```

Isochrone: `Accessibility E.fromPoint({ source: { kind: "site", id } , analysis_scene, bands_min: [5,10,15] })`.

## Brand / compliance

- Name prefix / brand: **小李***  
- `synthetic: true` always in delivery  
- **No** employer supercharger roster names  
