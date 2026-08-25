# HANDOFF WS-C (PRD 05.2 site + scene-aligned)

- branch: `master`
- feat commit: (pin after commit)
- depends: zones (`zone_id` frozen) + `time_scenario` / `scenario_ci` / `congestion_coeff` (B static)
- business data: **all Synthetic**
- status: **UNBLOCKED**

## analysis_scene 对齐

| 维 | 枚举 | 源 |
|----|------|-----|
| time_scenario | 6 bins（见下） | `data/static/time_scenario.json` |
| weather | clear \| rain \| extreme | `weather_coeff.json` |
| difficulty | citywide[weather][time] | `congestion_coeff.json` ≡ `scenario_ci` CI |

**6 bins:** `wd_night` · `wd_am_peak` · `wd_day_offpeak` · `wd_pm_peak` · `we_day` · `we_night`  
别名：`we_aft`→`we_day`。指标 **不再** 使用独立 3 档 TOD 表。

## How to run

```bash
npm run build:synthetic
npm run verify:synthetic
node scripts/verify-synthetic.js sh:z:office:office_lujiazui
npm run build:manifest
npm run copy:public-data
```

## Artifacts（本机构建量级）

| path | note | n / size |
|------|------|----------|
| `data/static/weather_coeff.json` | 4 biz scenes | ~1 KB |
| `data/static/calendar.json` | baseline + national_day | ~1 KB |
| `data/static/congestion_coeff.json` | 6×3 difficulty | ~2.5 KB |
| `data/static/scenario_ci.json` | CI 源 | ~2 KB |
| `data/static/time_scenario.json` | 6 档定义 | ~1 KB |
| `data/processed/metrics_zone.json` | 118 z × 6 × 4 = **2832** | ~702 KB |
| `data/processed/metrics_ride.json` | **708** | ~176 KB |
| `data/processed/metrics_delivery.json` | **708** | ~176 KB |
| `data/processed/metrics_chg.json` | **708** | ~175 KB |
| `data/processed/metrics_o2o.json` | **708** | ~175 KB |
| `data/processed/metrics_heat_fine.json` | HEAT_TIMES×ride/del **267204** | ~50 MB gitignore |
| `data/processed/entities_charger.json` | **site** 1100 + power | ~1.9 MB |
| `data/processed/entities_store.json` | 2200 stores | ~1.8 MB |
| `docs/synthetic-rules.md` | 公式 | - |
| `contracts/site.schema.json` | 站字段 | upstream A |

## 站点字段（05.2 §3.6）

每站至少：`site_id`, `name`（小李充电站-*）, `lng/lat`, `zone_id`, `stall_count`, `max_power_kw`, `power_structure`（guns+label）, `power_tier_label`, `status`, `utilization_synth`, `synthetic:true`。  
列表/地图单位 = **site**，非桩。

## Runtime

```text
demand = demand_base * weather.demand_{biz} * node_coeff
supply = supply_base * weather.supply_{biz} * node_coeff / difficulty(time_scenario, weather)
gap = demand - supply
```

## Gate sample

- office lujiazui · `wd_pm_peak` ride：rain gap > clear gap  
- clear · `wd_pm_peak` difficulty > `wd_night`  
- sites 800–1500 且功率字段齐全  

## Downstream

- D：两卡情景 ID 与 metrics `time_of_day`/`time_scenario` 一致  
- E：能源看板读 `entities_charger.sites` + 功率 KPI  

## Out of scope

- 不重做路网几何；不重画整站 UI
