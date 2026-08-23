# HANDOFF WS-B

- 仓绝对路径：`C:\Users\hongbol\Documents\LBS-Master`
- branch：`master`
- commit：`f5e46df` — `feat(data): shanghai roads gcj grids landuse`
- 依赖：WS-A 完成（contracts + HANDOFF-A）

## grid_id 规则（冻结）

```text
sh:{cell_m}:{row}:{col}
```

- 默认 `cell_m=1000`（可用 env `LBS_CELL_M`，范围 500–1000）
- `row`：自北向南，从上海 WGS bbox `maxLat` 起算，0-based
- `col`：自西向东，从 `minLng` 起算，0-based
- 格心先在 WGS 渔网取中心，再 `wgs84ToGcj02` 写入 `cell_lng/cell_lat`（GCJ-02）
- **改此规则必须重跑 WS-C/D**

示例：`sh:1000:98:95`

## 如何跑

```bash
# Node 18+；若 TLS 缺 CA：set LBS_TLS_INSECURE=1
npm test
npm run download:osm   # 可选；已有 data/raw/osm/shanghai_highways_overpass.json 可跳过
npm run build          # = build:geo
```

产物消费路径（相对仓根）：

| 文件 | 说明 |
|------|------|
| `data/processed/grids.json` | 17280 格，含 landuse/labels |
| `data/processed/roads_gcj.geojson` | 主干+次干 GCJ LineString |
| `data/processed/manifest.json` | bbox_gcj + OSM 署名 |
| `data/static/anchors_shanghai.json` | ≥12 真地名 GCJ（含临港） |
| `docs/alignment-sample.md` | ≥20 点抽检，verdict=PASS |
| `docs/osm-download.md` | raw 取得方式 |

## 产出摘要（本机一次成功构建）

- grids：`cell_m=1000`，count≈17280；临港带 labels 含 `lingang` / `lingang_belt`
- roads：≈34738 features，source=`local_overpass_json`，≈9MB
- anchors：16 点，含 `dishui_lake`、`lingang_new_city`
- alignment：**PASS**（模型自洽残差 0m；与高德叠图依赖 WGS→GCJ 算法，米级残差诚实声明见 alignment 文档）
- raw OSM：**gitignore**，勿 git add

## 已知问题 / 备注

1. Overpass 整包易超时；用 `download-osm-roads.js` 分片。本机构建时部分北缘 tile 可能未拉全，主干覆盖已够演示；可续跑 `npm run download:osm` 再 `build:roads`。
2. 路网默认过滤：`motorway|trunk|primary|secondary` + links（`LBS_ROAD_LEVELS` 可扩）。
3. 高德**底图**不下载：WS-D 用在线瓦片 + `AMAP_KEY`；本 WS 只产矢量 GCJ 叠层。
4. `npm run build` 尚不含 WS-C synthetic（metrics）；C 接入后扩展 `build-all.js`。
5. 本机 PATH 可能无 node：可用已装 Node 18+ 或 IDE 自带 node 跑脚本。

## 下游 WS-C

- 稳定读 `grids.json` 的 `grid_id`（勿改规则）
- landuse / labels 可用于合成 demand 形状
- 勿改 contracts 字段名
