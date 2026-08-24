# HANDOFF WS-C (05.1 zone-driven)

- branch: `master`
- feat commit: (see `git log -1 --grep synthetic`)
- depends: **WS-B zones** (`zone_id` frozen) + optional `grids_fine` for heat
- business data: **all Synthetic**
- status: **UNBLOCKED** (zones present: 118)

## Upstream zone

| item | value |
|------|--------|
| id rule | `sh:z:{type}:{slug}` |
| source | `data/processed/zones_shanghai.json` |
| fields used | zone_id, zone_type, grade, centroid_*, labels, rx_m, ry_m |
| HANDOFF | `docs/HANDOFF-WS-B-zones.md` |

If zones missing: build exits BLOCKED with minimal field list.

**Not blocked on per-way congestion:** citywide + corridor multipliers in `congestion_coeff.json` (tech debt noted there; B2 road color stays separate).

## How to run

```bash
npm run build:synthetic
npm run verify:synthetic
node scripts/verify-synthetic.js sh:z:office:office_lujiazui
npm run build:manifest
npm run copy:public-data
```

## Artifacts (this machine)

| path | note | size / n |
|------|------|----------|
| `data/static/weather_coeff.json` | ride/delivery/chg/o2o | ~1 KB |
| `data/static/calendar.json` | baseline + national_day | ~1 KB |
| `data/static/congestion_coeff.json` | citywide + corridor difficulty | ~2.5 KB |
| `data/processed/metrics_zone.json` | 118 z x 3 TOD x 4 scene = **1416** | ~311 KB |
| `data/processed/metrics_ride.json` | zone-primary **354** | ~78 KB |
| `data/processed/metrics_delivery.json` | **354** | ~79 KB |
| `data/processed/metrics_chg.json` | **354** | ~77 KB |
| `data/processed/metrics_o2o.json` | **354** | ~77 KB |
| `data/processed/metrics_heat_fine.json` | fine heat **267204** (ride+delivery) | ~49 MB · **gitignore** · rebuild on build:synthetic |
| `data/processed/entities_charger.json` | **1100** 小李充电 | ~350 KB |
| `data/processed/entities_store.json` | **2200** 小李门店 | ~690 KB |
| `docs/synthetic-rules.md` | formulas | - |

Legacy 1km `grids.json` metrics spine: **removed** (product metrics are zone / fine heat).

## Runtime (WS-D)

```text
demand = demand_base * weather.demand_{scene} * node_coeff
supply = supply_base * weather.supply_{scene} * node_coeff / difficulty_{scene}
gap    = demand - supply
```

- difficulty: `congestion_coeff.scopes.citywide[weather][tod]` + corridor extras
- heat mode: load `metrics_heat_fine` or rasterize zone metrics client-side
- entities: charger 800–1500, store 1500–3000 (PRD bands)

## Gate sample

- zone `sh:z:office:office_lujiazui` wd_pm_peak ride:
  - clear gap ~74 → rain gap ~100 (worse OK; difficulty↑)
- brands: 小李* only

## Downstream

- D: default heat = **zone faces**; fine/KDE switch; load congestion_coeff for narrative bar
- E: stores + chargers for o2o/energy tabs
- **Please continue WS-D UI against zone metrics**

## Out of scope

- no road geometry redo (B2)
- no full UI rewrite (D)
