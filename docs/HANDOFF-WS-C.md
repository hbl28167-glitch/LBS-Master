# HANDOFF WS-C

- branch：`master`
- commit：`8e7fe82` �?`feat(data): synthetic ride metrics and coeffs`
- 依赖：WS-B（`grids.json` `grid_id` 冻结 `sh:{cell_m}:{row}:{col}`�?- 经营数据�?*全部 Synthetic**（manifest / 文件�?`synthetic: true`�?
## 如何�?
```bash
# 仅合成（已有 grids�?npm run build:synthetic
npm run verify:synthetic
# 可选打印指定格 clear vs rain
node scripts/verify-synthetic.js sh:1000:69:61

# 全量（geo + synthetic + manifest�?npm run build
```

## 产出文件（本机构建量级）

| 路径 | 说明 | 量级 |
|------|------|------|
| `data/static/weather_coeff.json` | clear / rain / extreme | ~0.9 KB |
| `data/static/calendar.json` | baseline + national_day | ~0.7 KB |
| `data/processed/metrics_ride.json` | 17280 �?× 3 TOD = **51840** rows | ~5.3 MB�? �?JSON�?|
| `data/processed/metrics_chg.json` | 稀�?**3708** rows | ~0.4 MB |
| `data/processed/entities_charger.json` | **106** 小李充电�?GCJ | ~33 KB / ~1.4k lines |
| `data/processed/manifest.json` | �?metrics 计数 + artifacts | ~1 KB |
| `docs/synthetic-rules.md` | 公式与叙事（面试�?| �?|
| `contracts/scene-gap.schema.json` | norm=恒等；gap=demand−supply | 已更�?description |

## Runtime 约定（给 WS-D�?
```text
demand = demand_base * weather_coeff[w].demand_ride|demand_chg * node_coeff
supply = supply_base * weather_coeff[w].supply_ride|supply_chg * node_coeff
gap    = demand - supply   # bases are 0�?00 indices; norm = identity
```

- weather：`data/static/weather_coeff.json`
  - clear: ride d=1.0 s=1.0
  - rain: ride d=1.18 (�?.1) s=0.82 (�?.85)
  - extreme: d=0.72 s=0.55
- node：`data/static/calendar.json` �?`baseline` | `national_day`
- 详情：`docs/synthetic-rules.md`

## 验收摘录

- 陆家�?office �?`sh:1000:69:61` · `wd_pm_peak`�?  - clear gap �?60.8 �?rain gap �?85.9（变�?✓）
- 充电实体名均 `小李充电-*`，无雇主站名
- `grid_id` �?B 一致，未改算法

## 叙事要点（landuse�?
- office �?晚高�?demand �?- residential �?早高�?demand；晚高峰 supply 回流
- hub / lingang 标签 �?demand/supply 差拉大（长距/远程带）

## 下游 WS-D

- �?`metrics_ride` + coeffs；scene 徽章公式与上式一�?- 双层 demand×supply；情�?A=clear B=rain
- **请开 WS-D（主路径，最重要�?*

## 不要做（�?WS 已遵守）

- �?Leaflet/页面
- 未改 `grid_id` 规则
