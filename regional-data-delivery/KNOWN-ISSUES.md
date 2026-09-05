# KNOWN-ISSUES

## 1. Overpass 不稳定（阻塞真建筑下载）

- **现象：** TLS / HTTP 429 / 500 / 504；本机需 `NODE_TLS_REJECT_UNAUTHORIZED=0` 才偶发成功。  
- **影响：** 虹桥、张江、临港未能拉到完整 OSM 建筑；道路改用 **LBS-Master roads_gcj 裁剪**。  
- **已尝试：** 多 endpoint、重试、2×2/3×3 分片。  
- **建议：** 主控侧有稳定网络时对三区重跑 `build-region.js` 覆盖 raw+建筑；或提供离线 PBF。

## 2. 本地 roads_gcj fallback 的字段降级

- **现象：** 裁剪主库路网时 **无 R5/R6（residential 等）**、oneway/bridge/tunnel 多为 0（主库未带齐属性）。  
- **影响：** 末端路网偏稀；桥隧统计失真。  
- **建议：** 主库 Road V3 全量后重裁；或 Overpass 恢复后重下。

## 3. 合成建筑种子

- **现象：** fallback 使用 `synthetic_seed` 小方块，**不是真实 footprints**。  
- **影响：** Zone 几何仍可用栅格切分，但建筑密度/形态 **不可** 当真实城市肌理展示。  
- **标记：** `geometry_source=synthetic_seed_not_real_footprint`。  
- **建议：** 有建筑 raw 后必须重跑 Zone。

## 4. 徐家汇 giant_component_ratio = 0.9519

- **现象：** ≥0.95 未失败，但 <0.97 → **conditional_pass**。  
- **建议：** snap/ T 接或补下载边角路网。

## 5. GCJ↔WGS 反算

- **现象：** fallback 与 zone 的 WGS 副本使用近似反算，**非精密**。  
- **建议：** 展示以 **gcj02** 为准；分析用 WGS 时优先 Overpass 原始链。

## 6. preview.png

- **现象：** 未生成位图；仅有 `qc/preview.txt`。  
- **建议：** 主控用 QGIS / geojson.io 目视。

## 7. 无

- 未修改主应用代码。  
- 未写入真实雇主站名。  
- 未伪造 Overpass「假成功」。
