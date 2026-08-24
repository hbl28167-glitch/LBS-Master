# HANDOFF WS-D · 05.1 业务地图台

- 仓：`C:\Users\hongbol\Documents\LBS-Master`（可换机）
- branch：`master`
- commit：见 `git log -1`（`feat(ui): map-first shell with road narrative per PRD 05.1`）
- 依赖：B2 路网 QC PASS · B zones · C zone metrics / entities / congestion_coeff
- 验收真理：**PRD 05.1** + `docs/acceptance-main-path.md`

## How to run

```bash
cd <repo-root>
npm run copy:public-data
# 可选 Key
copy public\config.local.example.js public\config.local.js
npm run serve
# http://localhost:4173  → Ctrl+F5
```

无 Key：fallback 底图 + 横幅，不崩溃。

## 05.1 已实现

| 能力 | 实现 |
|------|------|
| IA | 顶栏六包可点 · 情景条 · **叙事条** · 左图右栏（业务列表\|路段分析） |
| 默认总览 | 底图 + 水系 + 路网拥堵 + 区面类型色 + **面热力**；**无 1km 糊格** |
| 路网三模式 | `cong` / `grade` / `biz`；整段 way 一色；点击→路段分析+业务文案 |
| 热力三模式 | `poly` 默认 / `grid`（lazy load fine）/ `kde` |
| LOD | zoom→city\|district\|block；滤路等级与点密度 |
| 出行深 | zone demand×supply÷difficulty · TopN · 导出 |
| 到店 | 门店点 + **单店聚焦**（覆盖圈） |
| 履约/能源/治理 | 最小可讲态（非灰死） |
| 情景 A/B | clear/rain × 路色 + difficulty_coeff 叙事条 |

## Artifacts

| path | note |
|------|------|
| `public/index.html` | 05.1 壳 |
| `public/css/app.css` | 对齐 demo 手感 |
| `public/js/app-context.js` | 05.1 AppContext 字段 |
| `public/js/metrics.js` | zone gap + 路况合成 + 文案 |
| `public/js/map-app.js` | 水/区/热/路/点 LOD |
| `public/js/data-loader.js` | core + lazy fine heat |
| `public/js/main.js` | 编排 |
| `docs/acceptance-main-path.md` | 勾选清单 |

## Runtime

```text
demand = demand_base * weather * node
supply = supply_base * weather * node / difficulty_(scene)
gap    = demand - supply
way_cong = f(city congestion_index, highway, weather, tod, name hints)
```

数据：`metrics_ride` 等 **zone-primary**；实体 小李门店/充电。

## Downstream

- E：到店/履约/能源/治理加深  
- F：demo-script 按 05.1 叙事重写  

## Out of scope

- 不重下 OSM / 不编造区面  
- 不改 processed 生成逻辑（除非契约 bug）

## Known limits

1. 细格 `metrics_heat_fine` 约 50MB，依赖 copy；缺则回退 poly。  
2. 5.6 万路段按 LOD 过滤；city 级优先高等级。  
3. 无 Key 时 fallback 瓦片与 GCJ 路网可能有视觉偏差。
