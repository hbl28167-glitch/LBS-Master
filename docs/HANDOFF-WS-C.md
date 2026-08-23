# HANDOFF WS-C

- branch: `master`
- feat commit: `da91ce0` - `feat(data): synthetic ride metrics and coeffs`
- depends: WS-B (`grids.json` grid_id frozen `sh:{cell_m}:{row}:{col}`)
- business data: **all Synthetic** (manifest / file header `synthetic: true`)

## How to run

```bash
# synthetic only (grids already built)
npm run build:synthetic
npm run verify:synthetic
# print clear vs rain for a grid
node scripts/verify-synthetic.js sh:1000:69:61

# full pipeline (geo + synthetic + manifest)
npm run build
```

## Artifacts (this machine build)

| path | note | size |
|------|------|------|
| `data/static/weather_coeff.json` | clear / rain / extreme | ~0.9 KB |
| `data/static/calendar.json` | baseline + national_day | ~0.7 KB |
| `data/processed/metrics_ride.json` | 17280 grids x 3 TOD = **51840** rows | ~5.3 MB (1-line JSON) |
| `data/processed/metrics_chg.json` | sparse **3708** rows | ~0.4 MB |
| `data/processed/entities_charger.json` | **106** XiaoLi chargers GCJ | ~33 KB / ~1.4k lines |
| `data/processed/manifest.json` | metrics counts + artifacts | ~1 KB |
| `docs/synthetic-rules.md` | formulas (interview) | - |
| `contracts/scene-gap.schema.json` | norm=identity; gap=demand-supply | updated description |

## Runtime contract (for WS-D)

```text
demand = demand_base * weather_coeff[w].demand_ride|demand_chg * node_coeff
supply = supply_base * weather_coeff[w].supply_ride|supply_chg * node_coeff
gap    = demand - supply   # bases are 0-100 indices; norm = identity
```

- weather: `data/static/weather_coeff.json`
  - clear: ride d=1.0 s=1.0
  - rain: ride d=1.18 (>=1.1) s=0.82 (<=0.85)
  - extreme: d=0.72 s=0.55
- node: `data/static/calendar.json` -> `baseline` | `national_day`
- details: `docs/synthetic-rules.md`

## Gate C sample

- Lujiazui office grid `sh:1000:69:61` / `wd_pm_peak`:
  - clear gap ~60.8 -> rain gap ~85.9 (worse OK)
- charger display names: 小李充电-* ; no employer sites
- `grid_id` matches B; algorithm unchanged

## Landuse narrative

- office -> high demand at wd_pm_peak
- residential -> high demand am; supply return at pm
- hub / lingang labels -> larger demand/supply spread

## Downstream WS-D

- load metrics_ride + coeffs; scene badge formula = above
- dual layer demand x supply; scenario A=clear B=rain
- **Please start WS-D (main path, most important)**

## Out of scope (honored)

- no Leaflet/UI
- did not change grid_id rule
