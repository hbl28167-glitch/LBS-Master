# Synthetic rules (WS-C)

> 全部经营指标为 **Synthetic**，用于沙盘情景 A/B，非真实订单/运力库。  
> 展示品牌：**小李***（如小李充电）。禁止雇主站名。

## Runtime (WS-D)

```text
demand = demand_base * weather_coeff[weather].demand_{scene} * node_coeff
supply = supply_base * weather_coeff[weather].supply_{scene} * node_coeff
gap    = demand - supply
```

- `demand_base` / `supply_base` 已是 **0–100 指数**，`norm` = 恒等（见 `contracts/scene-gap.schema.json`）。
- `gap` 越高 = shortage 越重（需补供给或调度）。
- `node_coeff` 来自 `data/static/calendar.json` 的 `season_or_node`。
- 可选：`national_day.demand_bias[landuse]` 在前端/运行层再乘 demand（本仓 verify 默认只用标量 `node_coeff_*`）。

## Weather direction (fixed)

| weather | ride demand | ride supply |
|---------|-------------|-------------|
| clear   | 1.0         | 1.0         |
| rain    | ≥1.1 (1.18) | ≤0.85 (0.82)|
| extreme | 0.72        | 0.55        |

Rain → gap 变差（需求抬、有效运力降）。Extreme 作演练，不作日常定址。

## Ride base shape

| landuse | 叙事 |
|---------|------|
| office | `wd_pm_peak` demand 最高（下班发单）；供给相对偏紧 |
| residential | `wd_am_peak` demand 高（通勤出城）；`wd_pm_peak` supply 回流抬高 |
| hub | 全 TOD demand 偏高、supply 偏紧 → 长距/枢纽缺口 |
| retail | `we_aft` demand 峰 |
| lingang / lingang_belt 标签 | demand×1.22、supply×0.78 → 远程带缺口故事 |
| lujiazui/cbd | demand 再抬、supply 略压 |
| is_valid=false / water_edge | 基数压到近零 |

时段键至少：`wd_am_peak` · `wd_pm_peak` · `we_aft`。

实现：`scripts/build-synthetic.js`（注释内完整公式）。

## Chg + entities

- `metrics_chg.json`：稀疏（有效且非 pure-other，或核心标签格）。
- `entities_charger.json`：50–200 点，GCJ，贴 retail/hub 锚点抖动；`name=小李充电-NNN`。

## Reproducibility

- 噪声由 `grid_id|…` 字符串哈希得到，同 grids 重跑结果稳定。
- **不改** `grid_id` 规则（WS-B 冻结）。

## Verify

```bash
node scripts/verify-synthetic.js
node scripts/verify-synthetic.js sh:1000:69:61
```
