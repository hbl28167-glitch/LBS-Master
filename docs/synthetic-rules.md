# Synthetic rules (WS-C · PRD 05.2)

> 全部经营指标 **Synthetic**。品牌：**小李***。禁止雇主站名。  
> 主空间键：**`zone_id`** = `sh:z:{type}:{slug}`。  
> 分析情景：**`analysis_scene = { time_scenario, weather }`**（与 UI 同源，禁止第二套无关乘子）。

## analysis_scene 时间档（6）

与 `data/static/time_scenario.json` / `congestion_coeff.json` / `scenario_ci.json` **同一 ID**：

| id | 含义 |
|----|------|
| `wd_night` | 工作日夜间 |
| `wd_am_peak` | 工作日早高峰 |
| `wd_day_offpeak` | 工作日平峰（含原中午，无 `wd_noon`） |
| `wd_pm_peak` | 工作日晚高峰 |
| `we_day` | 周末/节假日间 |
| `we_night` | 周末/节假夜间 |

兼容别名：`we_aft` → `we_day`；`wd_noon` → `wd_day_offpeak`。  
指标行字段：`time_scenario` 与 `time_of_day` **同值**（便于旧 loader）。

## Runtime（WS-D/E）

```text
demand = demand_base * weather.demand_{biz} * node_coeff_{biz}
supply = supply_base * weather.supply_{biz} * node_coeff_{biz} / difficulty_{biz}
gap    = demand - supply
```

- `weather` → `weather_coeff.json`（ride / delivery / chg / o2o）
- `node` → `calendar.json`（baseline / national_day）
- `difficulty` → `congestion_coeff.scopes.citywide[weather][time_scenario]`  
  - 与 `scenario_ci` 的 `city_CI × weather_f` 同源重表  
  - 廊道 `corridor_*` 额外乘子（labels）  
- bases ∈ 0–100，norm = 恒等

## Weather 方向（固定）

| weather | ride d/s | delivery | o2o |
|---------|----------|----------|-----|
| clear | 1.0/1.0 | 1.0/1.0 | 1.0 |
| rain | ≥1.1 / ≤0.85 | d↑ s↓ | foot ↓ |
| extreme | drill | drill | drill |

Rain + 高峰 → ride gap **变差**（weather 供给↓ + difficulty↑）。

## Zone × 时段方向

| 区域 | ride | delivery | o2o / chg |
|------|------|----------|-----------|
| residential dense_mass | 早晚峰强 | 早晚强 | chg 夜间可抬 |
| office/CBD | 晚峰最强 | 平峰午中 | 工作日配套 |
| retail premium | 中 | 中 | **we_day o2o 强** |
| hub | 全日脉冲 | 弱–中 | 夜间补能叙事 |
| scenic | we_day 强 | 中 | 中 |

## Scenes（业务包）

| biz scene | 文件 | 深度 |
|-----------|------|------|
| ride | metrics_ride.json | 深 |
| delivery | metrics_delivery.json | 深 |
| chg | metrics_chg.json | 中 |
| o2o | metrics_o2o.json | 中 |

`metrics_zone.json`：全 biz × 6 time 合一。

## 能源站点（site，非桩林）

| 项 | 要求 |
|----|------|
| 单位 | **site** 800–1500；`site_id` = `sh:site:xl-NNNN` |
| 功率 Must | `max_power_kw` 和/或 `power_structure`（guns[] + label） |
| 聚合 | `stall_count`；`total_rated_kw`；`power_tier_label`（60/120/250kW 级） |
| 其它 | name 小李充电站-*、zone_id、status、utilization_synth、open_hours |
| 文件 | `entities_charger.json`（`entities` ≡ `sites`） |

门店：1500–3000，`sh:store:xl-NNNN`，`entities_store.json`。

## Fine heat

`metrics_heat_fine.json`：最近 zone 衰减；**HEAT_TIMES** = am/pm/we_day（控体积）；gitignore，build 再生。  
完整 6 档在 **zone metrics**。

## Verify

```bash
npm run build:synthetic
npm run verify:synthetic
node scripts/verify-synthetic.js sh:z:office:office_lujiazui
```
