# Synthetic rules (WS-C · 05.1 zone-driven)

> 全部经营指标为 **Synthetic**。展示品牌：**小李***。禁止雇主站名。  
> 主空间键：**`zone_id`** = `sh:z:{type}:{slug}`（见 `docs/HANDOFF-WS-B-zones.md`）。  
> **不再**以 1km `grids.json` 作为产品指标主脊柱。

## Runtime (WS-D)

```text
demand = demand_base * weather.demand_{scene} * node_coeff_{scene}
supply = supply_base * weather.supply_{scene} * node_coeff_{scene} / difficulty_{scene}
gap    = demand - supply
```

- bases ∈ **0–100** 指数，`norm` = 恒等。
- `weather` → `data/static/weather_coeff.json`（ride / delivery / chg / o2o）
- `node` → `data/static/calendar.json`（baseline / national_day）
- `difficulty` → `data/static/congestion_coeff.json`  
  - **全市情景表** × `time_of_day` × `weather`  
  - **廊道附加**（cross_river / hongqiao / lingang）按 zone labels  
  - 技术债：逐 way 拥堵色仍归 B2/D 路网样式；本文件是经营难度接口

## Weather direction (fixed)

| weather | ride d/s | delivery d/s | o2o d |
|---------|----------|--------------|-------|
| clear   | 1.0 / 1.0 | 1.0 / 1.0 | 1.0 |
| rain    | ≥1.1 / ≤0.85 | ↑ / ↓ | foot ↓ |
| extreme | drill | drill | drill |

Rain → ride **gap 变差**（需求↑ + 供给系数↓ + 拥堵 difficulty↑）。

## Zone × TOD（05.1 §4.3 方向）

| 区域 | ride | delivery | o2o |
|------|------|----------|-----|
| residential `dense_mass` | 早晚强 | 早晚强 | 中 |
| office / CBD | 午晚潮汐、pm 最强 | 午中 | 工作日配套 |
| retail `premium` | 中 | 中 | **周末晚 we_aft 强** |
| hub | 全日脉冲 | 弱–中 | 弱 |
| scenic | we_aft / 节假 | 中 | 中 |
| industrial / rural | 弱 | 弱 | 弱 |

分级：`premium`/`dense_mass` 抬 demand；`premium_low` 压人流。  
实现：`scripts/build-synthetic.js`。

## Scenes

| scene | 深度 | 文件 |
|-------|------|------|
| ride | 深 | `metrics_ride.json`（亦写入 `metrics_zone`） |
| delivery | 深 | `metrics_delivery.json` |
| chg | 中 | `metrics_chg.json` |
| o2o | 中 | `metrics_o2o.json` |

`metrics_zone.json`：全 scene × TOD 合一表。  
行字段：`zone_id`, `grid_id`(=zone_id 兼容), `unit_kind=zone`, `scene`, `time_of_day`, `demand_base`, `supply_base`, `zone_type`, `grade`。

## Fine heat (200–300m 分区)

- `metrics_heat_fine.json`：由 `grids_fine` 最近 zone 衰减生成  
- scenes: ride + delivery；同指标族  
- KDE：由 D 客户端做，本仓不预烘焙  
- 若无 `grids_fine`：HANDOFF 声明 D 可区面栅格化

## Entities

| 实体 | 量级 | 分布 |
|------|------|------|
| 小李充电 | **800–1500** | 贴 retail/hub/residential/office zone |
| 小李门店 | **1500–3000** | 贴 retail/residential 为主 |

名称：`小李充电-NNNN` / `小李门店-NNNN`；`zone_id` 关联；GCJ-02。

## Reproducibility

- 哈希噪声：`zone_id|scene|…` 稳定重跑  
- **不改** `zone_id` / fine `grid_id` 规则  

## Verify

```bash
npm run build:synthetic
npm run verify:synthetic
node scripts/verify-synthetic.js sh:z:office:lujiazui
```
