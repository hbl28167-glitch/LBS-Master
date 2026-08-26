# HANDOFF WS-E · 05.2 能源看板 + 可达服务圈

- 仓：`C:\Users\hongbol\Documents\LBS-Master`
- branch：`master`
- commit：见 `git log -1` — `feat(app): energy board isochrone per PRD 05.2`
- 依赖：D analysis_scene 两卡 · C `entities_charger` site+功率 · B roads_gcj · scenario_ci
- 验收：`docs/acceptance-side-path.md` · PRD 05.2 §2 旅程 B / §3.5–3.6

## How to run

```bash
cd <repo-root>
npm run copy:public-data
npm run serve
# http://localhost:4173 · Ctrl+F5
```

## 本波交付

| 能力 | 实现 |
|------|------|
| 能源运营看板 | KPI 条 + 可排序站列表 + 站详情（功率结构/额定/峰值） |
| 粒度 | 默认 **site**；地图 dim 非选中站，不画桩林 |
| E.fromPoint | `public/js/accessibility.js`：等级赋速÷CI 阻抗 · Dijkstra · 5/10/15 凸包环 · zone ETA |
| 点站闭环 | 选站→圈+覆盖表→「平峰晴 vs 晚峰雨」Δ→规则建议句→导出 |
| 到店/履约 | 保留单店聚焦与时效圈，未拆第二地图栈 |

## Artifacts

| path | note |
|------|------|
| `public/js/accessibility.js` | E 底座 fromPoint / compareScenes / adviceTemplate |
| `public/js/main.js` | 能源看板编排、选站、scene 变重算圈 |
| `public/js/map-app.js` | `setIsochrones` |
| `public/js/app-context.js` | energy 默认 side_panel=energy |
| `public/index.html` | panel-energy + KPI/列表/详情 |
| `public/css/app.css` | 看板样式 |
| `docs/acceptance-side-path.md` | 旅程 B 勾选 |
| `docs/HANDOFF-WS-E.md` | 本文件 |

## Runtime

```text
analysis_scene = (time_scenario, weather)
CI_way = city_CI × weather_f × class_f [× am_peak anchor]
v_way  = v0(highway) / CI_way
edge_sec = length_m / (v_way m/s)
isochrone = dijkstra(snap) → nodes ≤ T → convex hull (else circle fallback)
coverage = zones with eta_min ≤ band
```

诚实：非导航；末公里粗时 `warnings: last_mile_coarse`；QC 失败 `qc_blocked`。

## Gate E（05.2）

- [x] 旅程 B 可走通  
- [x] 功率字段可见  
- [x] 圈随 scene 变  
- [x] 出行主路径不坏  

## Downstream

- WS-F：demo-script 旅程 B  
- 集成 Gate 全量  

## Known limits

1. 路网建图抽样 ~12k features；远郊精度粗。  
2. 等时环为可达节点凸包，非精确 isochrone polygon。  
3. 全网站 10min 覆盖率 KPI 在未选站时显示 —，选站后为该站覆盖率。  
4. 首次点站建图可能 0.5–2s（主线程 defer）。
