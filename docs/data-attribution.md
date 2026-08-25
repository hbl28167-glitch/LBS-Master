# 数据署名 · LBS-Master（05.1 / 05.2 空间与情景）

| 数据 | 来源 | 许可/说明 | 仓内路径 |
|------|------|-----------|----------|
| 底图瓦片 | 高德地图 | 开放平台/在线瓦片；**Key 自备、不入库** | 运行时 |
| 路网 | OpenStreetMap | **© OpenStreetMap contributors** · ODbL | `roads_gcj.geojson`（raw gitignore） |
| 功能区面（zones） | 公开地名 + **贴路网凸包 AOI** | 边界**非**官方规划红线；几何 v2=`road_convex_hull` | `zones_shanghai.geojson` |
| 水系 | （已清空示意层） | 请直接读高德底图水系；待 OSM water 质检后再补 | `water_shanghai.geojson`（空） |
| 细格网 | 本仓派生 | 热力「细格」模式 | `grids_fine.json` |
| 旧 1km 格 | 本仓派生 | **非 UI 默认** | `grids.json` |
| 经营指标/实体 | Synthetic | `synthetic: true`；品牌 小李* | metrics / entities |
| 锚点 | 公开地名 | WGS→GCJ | `anchors_shanghai.json` |
| **分析情景 / city_CI / 24h 曲线** | **Synthetic 标定** | 见下节 | `time_scenario.json` · `scenario_ci.json` · `ci_series_24h.json` |
| **早高峰典型路段均速锚点** | **Synthetic** | name 白名单匹配；非真 API | `typical_road_anchors.json` |
| 拥堵业务难度 | Synthetic | 与 `scenario_ci` 同源 | `congestion_coeff.json` |

## 情景与路况（05.2 · 必须声明）

- **形态参考**公开城市出行/拥堵的**一般规律**（夜低、早晚峰、晚峰更高、雨天上浮），用于沙盘可讲解。  
- **不是**任何图商/出行平台的实时或历史 API 拉取结果。  
- **不爬取**网页、不抓包、不入库真实浮动车轨迹。  
- 界面与导出须带 **Synthetic**；面试口径：「规则标定 + 公开规律形态，非生产路况。」

## 不做

- 爬取图商网页/非公开接口建库  
- 雇主场站名录进 zones/实体  
- 宣称区面边界为官方法定范围  
- 宣称 CI/均速为实测路况  

## 界面底栏建议文案

> 底图 © 高德 · 路网 © OpenStreetMap contributors · 区面贴路示意 · 情景/拥堵 Synthetic（形态参考公开出行规律，非真 API）
