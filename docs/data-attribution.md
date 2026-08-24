# 数据署名 · LBS-Master（05.1 空间层）

| 数据 | 来源 | 许可/说明 | 仓内路径 |
|------|------|-----------|----------|
| 底图瓦片 | 高德地图 | 开放平台/在线瓦片；**Key 自备、不入库** | 运行时 |
| 路网 | OpenStreetMap | **© OpenStreetMap contributors** · ODbL | `roads_gcj.geojson`（构建自 raw，raw gitignore） |
| 功能区面（zones） | 公开地名 + **示意 AOI** | 边界**非**官方规划红线；名与相对位置尽量真 | `zones_shanghai.geojson` |
| 水系（黄浦江等） | 公开地理示意中线/面 | 可被 OSM water 替换；替换后沿用 ODbL | `water_shanghai.geojson` |
| 细格网 | 本仓派生 | 热力「细格」模式；分区分辨率 | `grids_fine.json` |
| 旧 1km 格 | 本仓派生 | **非 UI 默认**；仅计算兼容 | `grids.json`（`ui_default_layer:false`） |
| 经营指标/实体 | Synthetic | `synthetic: true`；品牌 小李* | metrics / entities |
| 锚点 | 公开地名 | WGS 约值 → GCJ | `anchors_shanghai.json` |

## 不做

- 爬取图商网页/非公开接口建库  
- 雇主场站名录进 zones/实体  
- 宣称区面边界为官方法定范围  

## 界面底栏建议文案

> 底图 © 高德 · 路网 © OpenStreetMap contributors · 区面/水系为沙盘示意 · 经营数据 Synthetic
