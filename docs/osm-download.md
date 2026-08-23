# OSM 下载说明（上海 · ODbL）

原始 OSM **不得**进主仓 git（见根目录 `.gitignore` 的 `data/raw/**`）。

## 推荐路径 A — Overpass（本仓默认）

推荐一键分片拉取（可断点续跑）：

```bash
# 若本机 Node TLS 缺 CA，可临时：
# set LBS_TLS_INSECURE=1
npm run download:osm
npm run build:roads
```

产出 raw：

```text
data/raw/osm/shanghai_highways_overpass.json
```

再转换生成 `data/processed/roads_gcj.geojson`。

`build:roads` 也会在无 local raw 时尝试整包 Overpass；失败则写 synthetic 走廊并在 HANDOFF/alignment 标明。

若网络不可达：按下文手工放 raw 后重跑；**脚本与文档仍应提交**。

## 推荐路径 B — Geofabrik 省包裁切

1. 打开 <https://download.geofabrik.de/asia/china.html>
2. 下载 `china-latest.osm.pbf`（体积大）或区域切片
3. 用 `osmium` / QGIS 裁切到上海 bbox（WGS84 约 `120.85,30.67,122.20,31.88`，含临港）
4. 导出为 GeoJSON 或 OSM XML，放到：

```text
data/raw/osm/shanghai.osm
# 或
data/raw/osm/shanghai_roads.geojson
```

5. 再跑 `npm run build:roads`（脚本会优先读本地 raw）

## 推荐路径 C — BBBike 自定义提取

1. <https://extract.bbbike.org/>
2. 框选上海（含临港）
3. 格式选 **GeoJSON** 或 **OSM XML**
4. 放入 `data/raw/osm/`

## 过滤策略（体积）

默认只保留：

`motorway|trunk|primary|secondary` 及其 `_link`

不保留 residential/service 等支路（演示叠图足够；文档与 HANDOFF 说明）。

如需更密路网：设置环境变量：

```bash
# PowerShell
$env:LBS_ROAD_LEVELS="motorway,trunk,primary,secondary,tertiary"
npm run build:roads
```

## 署名

产物 `manifest.json` 与 README 须保留：

**© OpenStreetMap contributors**（ODbL）

## 坐标

OSM 源为 **WGS84**；构建时经 `scripts/lib/gcj.js` 转为 **GCJ-02** 再与高德底图叠合。禁止用手工仿射替代转换模型。
