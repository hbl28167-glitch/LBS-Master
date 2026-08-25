# Accessibility E · fromPoint (PRD 05.2 §3.5)

Capability mid-layer: **road-time impedance → isochrone rings + zone ETA**.  
Consumers: Energy site service rings (Must); ride/fulfillment optional (Could).

**Honest limits:** not commercial navigation; last-mile coarse where residential mesh missing; all speeds **Synthetic**.

## FromPointRequest

```js
{
  source: {
    kind: "site" | "point" | "store",  // site = energy station
    id: "sh:site:…",                   // required when kind=site|store
    lng: 121.5,                        // GCJ-02; required for kind=point; optional override
    lat: 31.2
  },
  analysis_scene: {
    time_scenario: "wd_pm_peak",
    weather: "clear"
  },
  bands_min: [5, 10, 15],              // default
  profile: "car_urban",                // default; reserved for walk/bike later
  max_radius_m: 15000,                 // search cap
  include_zone_eta: true
}
```

| Field | Notes |
|-------|--------|
| `source` | Snap to nearest routable road node; fail → no fake rings |
| `analysis_scene` | Must match AppContext; drives `v_way = v0(highway) / CI_way` |
| `bands_min` | Minutes; product default 5/10/15 |
| `profile` | Impedance table key |
| `max_radius_m` | Hard stop for Dijkstra |
| `include_zone_eta` | If true, attach per-zone ETA / in-band flags |

## AccessibilityResult

```js
{
  ok: true,
  synthetic: true,
  request_echo: { /* FromPointRequest subset */ },
  snap: {
    ok: true,
    lng: number,
    lat: number,
    road_id: string | null,
    snap_dist_m: number
  },
  bands: [
    {
      minutes: 10,
      // Polygon rings GCJ-02; GeoJSON Polygon or MultiPolygon coordinates
      geometry: { type: "Polygon", coordinates: [/* … */] },
      area_km2: number | null
    }
  ],
  zone_coverage: [
    {
      zone_id: string,
      eta_min: number | null,       // null if unreachable in cap
      in_band: { "5": bool, "10": bool, "15": bool },
      zone_type: string | null,
      is_gap: boolean | null        // from metrics if available
    }
  ],
  stats: {
    nodes_visited: number,
    elapsed_ms: number,
    roads_qc_ok: boolean
  },
  warnings: string[]                 // e.g. "last_mile_coarse", "qc_failed"
}
```

### Failure shape

```js
{
  ok: false,
  synthetic: true,
  error_code: "snap_failed" | "qc_blocked" | "no_graph" | "internal",
  message: string,
  bands: [],
  zone_coverage: []
}
```

When `roads_qc_ok === false`, engine must **refuse** success rings (banner: 路网分析未达标).

## Scene delta (energy compare)

UI may call twice and diff:

```js
{
  site_id: string,
  scene_a: { time_scenario, weather },
  scene_b: { time_scenario, weather },
  band_min: 10,
  coverage_count_a: number,
  coverage_count_b: number,
  delta_coverage_count: number,      // b - a
  delta_area_km2: number | null
}
```

## Schema files

- Informal types: this doc  
- Machine-oriented request/result: `accessibility.schema.json` (property defs; full draft validation optional)
