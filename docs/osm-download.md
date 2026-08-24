# OSM 下载说明（上海 · ODbL）· WS-B2

原始 OSM **不得**进主仓 git（见根目录 `.gitignore` 的 `data/raw/**`）。

## 主源（推荐）— Geofabrik PBF + 裁切

1. 下载 <https://download.geofabrik.de/asia/china-latest.osm.pbf>
2. 用 [osmium-tool](https://osmcode.org/osmium-tool/) 裁切上海 bbox（WGS84，含临港）：

```bash
osmium extract -b 120.85,30.67,122.20,31.88 china-latest.osm.pbf -o data/raw/osm/shanghai.osm.pbf
# 再导出公路 GeoJSON（需 osmium export 或 ogr2ogr）
osmium export data/raw/osm/shanghai.osm.pbf -f geojson -o data/raw/osm/shanghai_roads.geojson
```

Windows 若无 osmium：见下文 BBBike / Overpass fallback。

3. 将 `shanghai_roads.geojson` 放入 `data/raw/osm/`（**优先于** overpass JSON）
4. `npm run build:roads`（convert → snap → qc）

## 次选 — BBBike / 完整框选提取

1. <https://extract.bbbike.org/> 框选上海（含临港）
2. 格式 **GeoJSON** → `data/raw/osm/shanghai_roads.geojson`
3. `npm run build:roads`

## Fallback — Overpass 分片（不完整时勿宣称全量）

```bash
# TLS 问题可设 LBS_TLS_INSECURE=1
npm run download:osm
npm run build:roads
```

- 输出：`data/raw/osm/shanghai_highways_overpass.json`
- 等级默认含 **tertiary**（B2）
- 可断点：`_tiles_progress.json`（gitignore）

## 等级过滤（冻结 B2）

```text
motorway, motorway_link, trunk, trunk_link,
primary, primary_link, secondary, secondary_link,
tertiary, tertiary_link
```

覆盖：`LBS_ROAD_LEVELS=motorway,trunk,...`

核心区 residential **不在 B2**（二期按 zoom 加载）。

## 流水线

```text
raw → build-roads.js → roads_gcj.pre.geojson
    → repair-roads-snap.js (ε≈2m) → roads_gcj.geojson
    → qc-roads.js → docs/roads-qc-report.md
```

```bash
npm run build:roads          # 全流水线；qc FAIL 则 exit 1
npm run repair:roads
npm run qc:roads
```

## 署名

**© OpenStreetMap contributors**（ODbL）

## 坐标

源 WGS84 → `scripts/lib/gcj.js` → GCJ-02。禁止仿射拉图。
