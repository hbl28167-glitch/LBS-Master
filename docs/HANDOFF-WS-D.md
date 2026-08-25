# HANDOFF WS-D · PRD 05.2 呈现攻坚

- 仓：`C:\Users\hongbol\Documents\LBS-Master`
- branch：`master`
- commit：见 `git log -1`（`feat(ui): 05.2 scenario dock road-CI trend presentation`）
- 依赖：A contracts · B zones/static CI · C site metrics · B2 roads QC
- 验收：`docs/acceptance-main-path.md` · 旅程 A

## How to run

```bash
npm run copy:public-data
npm run serve
# http://localhost:4173  → Ctrl+F5
```

可选：`public/config.local.js` 填 `amapKey`（仅本地）。

## 05.2 本波交付

| 能力 | 实现 |
|------|------|
| 两卡情景 | `#sel-time`（6 档）× `#sel-weather` → `AppContext.analysis_scene`；全局唯一 |
| 镜头分离 | 陆家嘴/虹桥/临港 = **仅 flyTo**，不写 scene |
| 叙事条 | 选中对象 + scene 芯片 + city CI / 难度（非写死「虹桥履约」） |
| 图层坞 | 左上同一组：底图/水/路/区/热/站店/圈/图例 + 路网模式 + 热力形态 |
| 缩放避让 | Leaflet zoom **bottomleft**；坞 topleft；图例 bottomright |
| 路况 CI | `scenario_ci` × highway class × `typical_road_anchors`（早峰）→ 四档色 |
| 24h 趋势 | 右栏 SVG，读 `ci_series_24h`；竖线=当前档；点击切时间 |
| 区面 | 消费 B `zones_shanghai.geojson`（road_convex_hull 为主） |
| 能源 site | `entities_charger.sites` 优先；功率字段可在详情扩展（E） |

## 数据路径（public/data ← copy）

| 文件 | 用途 |
|------|------|
| `time_scenario.json` | 6 档标签 |
| `scenario_ci.json` | city_CI / weather_f / 四档 bin / v0 |
| `ci_series_24h.json` | 趋势曲线 |
| `typical_road_anchors.json` | 早峰廊道 name 匹配 |
| `congestion_coeff.json` | difficulty 业务系数 |
| `zones_shanghai.geojson` | 贴路区面 |
| `roads_gcj.geojson` | 路网 |
| `metrics_*.json` | zone 指标（time_scenario 6 档） |
| `entities_charger.json` | site + 功率 |

## opengeos 借用边界

| 可借鉴 | 禁止 |
|--------|------|
| 图层分组、图例层次、控件分区（坞/图例/缩放分离） | 换 MapLibre 整栈、leafmap/GEE/SAM、运行时外部 GIS |

## 已知限制

1. 路况为 **Synthetic CI 着色**，非真路况 API。  
2. 等时圈/能源 KPI 深看板 → **WS-E**。  
3. 区面 5 个 `irregular_fallback`：边缘稀疏路网；hull 占优则目视应非圆泡阵。  
4. 细格热力仍 lazy load 大文件。  
5. 无 Key 时高德瓦片可能不稳，不默认切第三方底图（05.2）。

## Downstream

- **WS-E**：在 `analysis_scene` + 路网 CI + 图层总线 上做能源看板与 5/10/15 等时圈  
- **WS-F**：按旅程 A/B 写 demo-script  

## Out of scope（honored）

- 未重下 OSM / 未重算 zones·synthetic  
- 未改 zone_id / grid_id  
- 未做完整等时圈引擎  
