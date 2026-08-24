# HANDOFF WS-B2 · 路网重建与质检

- 仓：`C:\Users\hongbol\Documents\LBS-Master`
- branch：`master`
- 依赖：WS-B 已有 GCJ / anchors；本任务只动路网流水线 + 默认显示
- commit：见文末 hash

## 旧路网为何不可用（why broken）

1. **等级砍到 secondary**：缺 tertiary 连接组织，视觉与拓扑都碎。  
2. **Overpass 分片不全**：核心城区（陆家嘴等）曾出现「最近路 >3km」空洞。  
3. **无连通 QC / 无 snap**：只做 GCJ 自洽，不验「连得上」。  
4. **前端默认不勾选路网 + 随机抽稀**：体感更断。  

## 等级（冻结）

```text
motorway, motorway_link, trunk, trunk_link,
primary, primary_link, secondary, secondary_link,
tertiary, tertiary_link
```

覆盖：`LBS_ROAD_LEVELS=...`。**不含** residential（二期）。

## 流水线

```bash
# 可选补源（gitignore raw）
npm run download:osm        # 全市分片 fallback
npm run download:osm:core   # 核心区+临港 dense tiles（B2 主用）

npm run build:roads         # convert → snap(ε=2m) → qc（FAIL exit 1）
npm run repair:roads
npm run qc:roads
npm run copy:public-data
npm run serve
```

| 步骤 | 脚本 | 产出 |
|------|------|------|
| convert | `build-roads.js` | `roads_gcj.pre.geojson` + 初写 `roads_gcj.geojson` |
| snap | `repair-roads-snap.js` | `roads_gcj.geojson`, `roads_snap_log.json` |
| qc | `qc-roads.js` | `docs/roads-qc-report.md`, `roads_qc.json` |

主源文档：`docs/osm-download.md`（PBF 优先；Overpass fallback）。

## QC before / after

| metric | before（旧 secondary-only） | after（B2） |
|--------|---------------------------:|------------:|
| features | 34738 | **56578** |
| length_km | ~10800 | **~16454** |
| tertiary(+link) | **0** | **10239** |
| components | 987（endpoint 图） | **55**（vertex 图） |
| largest_component_ratio | 0.880（endpoint） | **0.996**（vertex，门禁≥0.85） |
| dangling_tips | 3381 | **1660** |
| anchor→road P50/P90 m | 889 / 9019 | **87 / 241.5** |
| verdict | FAIL | **PASS** |

说明：

- after 连通图使用 **全顶点链**（含 T 接）；before 存档为 endpoint 图，ratio 不可直接横比，以 features/tertiary/anchor 距离为主对比。  
- 门禁：`tertiary>0`、`largest_ratio≥0.85`、`anchor P90≤300m`、`features≥1000`。  
- 陆家嘴锚点到路 ~0.3m；虹桥 ~63m；临港 ~83–91m；浦东机场较远 ~406m（枢纽面大，可接受）。

## 前端（本会话已改）

- `public/index.html`：出行/能源/治理 **路网 checkbox 默认 checked**  
- `app-context.js`：`layer_set` 含 `roads`  
- `map-app.js`：分级样式（motorway→tertiary）；**按 zoom 滤等级**（z&lt;11 仅 primary+；z&lt;12 含 secondary；更高含 tertiary）；禁止无说明随机抽稀为主策略  
- 加载后 `showRoads(true)`

## 产物路径

| 文件 | 说明 |
|------|------|
| `data/processed/roads_gcj.geojson` | 正式路网 ~15MB 级 |
| `data/processed/roads_snap_log.json` | snap 日志 |
| `data/processed/roads_qc.json` | QC JSON |
| `docs/roads-qc-report.md` | QC 报告 PASS |
| `public/data/roads_gcj.geojson` | 静态服务副本 |

raw（gitignore）：`shanghai_highways_overpass.json`、`shanghai_core_overpass.json`。

## 已知限制

1. 无本地 osmium 时仍靠 Overpass；全市+核心合并后仍可能有边缘空洞。  
2. snap 仅端点 ε=2m，不补缺失路段。  
3. 拥堵色/业务难度属性留给 D 用等级×情景规则乘；本交付保证几何+highway 等级。  
4. `roads_gcj.pre.geojson` gitignore（中间态）。

## 验收请用户

```bash
npm run serve
# 打开总览：默认应见路网；放大陆家嘴/虹桥/临港压高德道路
# 打开 docs/roads-qc-report.md 看 PASS
```
