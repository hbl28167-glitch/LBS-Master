# HANDOFF WS-E · 05.1 业务扩展（到店/履约/能源/治理）

- 仓：`C:\Users\hongbol\Documents\LBS-Master`（可换机）
- branch：`master`
- commit：`0c51e22` — `feat(app): o2o focus fulfillment energy per PRD 05.1`
- 依赖：WS-D 05.1 壳 · C `entities_store` / `entities_charger` / `metrics_o2o|delivery|chg` · B2 路网
- 验收：`docs/acceptance-side-path.md` + PRD 05.1 §3.8–3.9

## How to run

```bash
cd <repo-root>
npm run copy:public-data
npm run serve
# http://localhost:4173  · Ctrl+F5
```

## 05.1 本包加深

| Tab | 深度 | 实现 |
|-----|------|------|
| 到店 | 中 | 门店点 + 商圈 demand 热力 + 路网；**单店聚焦**（dim 他店 + 覆盖圈 + 围栏）；退出按钮 |
| 履约 | 深 | 门店 + delivery gap 热力 + 路网默认；**时效圈** `etaRadiusM(base, difficulty)` 随雨/高峰缩小；点路难度文案 |
| 能源 | 中 | 充电站网（C 量级）+ chg 区缺口 + 路网；**S5 选址**面板（权重可解释） |
| 治理 | 可讲 | mock 问题列表；图例标题 **数据质量**；不处理终端 GPS 漂移 |

## Artifacts

| path | note |
|------|------|
| `public/js/main.js` | 四包列表/详情/聚焦/选址/治理编排 |
| `public/js/map-app.js` | 点聚焦 dim/hide、多环 overlay、选址标记 |
| `public/js/metrics.js` | S5、etaRadius、storeCoverage、quality mock |
| `public/js/app-context.js` | siting_*；o2o fence 层；energy 路网默认 |
| `public/css/app.css` | 选址卡、治理 banner |
| `docs/acceptance-side-path.md` | 副路径勾选 |
| `docs/HANDOFF-WS-E.md` | 本文件 |

## Runtime

```text
# 与 D 共用
demand/supply/gap @ zone · difficulty_* from congestion_coeff
eta_r = base_m / difficulty_delivery   # 履约圈
store_coverage by store_type           # 到店圈
S5 = 0.35D+0.25Gap+0.20Comp+0.10Acc+0.10(100-Cannibal)
quality issues: ENTRY_MISSING / ROAD_TOO_FAR / …  out_of_scope=device_gps_drift
```

展示品牌：小李门店 / 小李充电。无雇主站名。

## Gate E（05.1）

- [x] 五大业务相关 Tab 可进 + 地图层 + 右侧故事  
- [x] 单店聚焦可演示  
- [x] 出行主路径不被改坏  

## Downstream

- **WS-F**：demo-script 按 05.1 旅程重写  
- 集成 Gate 全量

## Out of scope

- 不重做路网下载 / 不改 contracts 字段名  
- 无真导航引擎 / 无 ML 选址  
- 未复制第二套地图栈

## Known limits

1. 单店聚焦「他店」为 dim+抽样，非全量 2200 同屏。  
2. 选址环用区心邻域，非路网 isochrone。  
3. 治理问题为稳定规则 mock，非真质检工单。  
4. 细格热力大文件仍 lazy；缺则回退区面。
