# HANDOFF · WS-B zones / water / fine-grids（05.1）

- 仓：`C:\Users\hongbol\Documents\LBS-Master`
- 路网底座：见 `HANDOFF-WS-B2.md`（须先 PASS）
- 本交付：功能区面 + 水系 + 可变细格；**删除 1km 格作为 UI 主数据**

## zone_id 规则（冻结）

```text
sh:z:{type}:{slug}
```

| 段 | 含义 | 例 |
|----|------|-----|
| `sh` | 上海 | |
| `z` | zone | |
| `type` | `retail\|residential\|office\|industrial\|hub\|scenic\|rural` | `retail` |
| `slug` | 稳定英文短名 | `lujiazui_retail` |

**完整例：** `sh:z:retail:nanjing_east` · `sh:z:hub:hongqiao`

- 改 id = **必须**重做挂 zone 的 C/D 指标与 UI 选中态。  
- 几何：GCJ-02 Polygon（示意椭圆 AOI，贴公开中心点）。  
- 分级：`retail` → `premium|mass|community`；`residential` → `dense_mass|improve|premium_low`；其它 `grade=null`。  
- 配色 token：`scripts/lib/color-tokens.js` / `zones_shanghai.json.color_tokens`（05.1：商业紫、工业浅蓝、住宅米白…）。

## fine grid_id（冻结 · 热力细格）

```text
sh:f:{cell_m}:{row}:{col}
```

- `cell_m` ∈ `{250,500,1000}`（建成区细、空旷粗）  
- **不是** UI 默认主视觉；默认热力用 **区面**。

## 旧 1km 格

- 规则仍为 `sh:{cell_m}:{row}:{col}`（WS-B 原冻结，C 指标可能仍 join）  
- `grids.json` 已标 `ui_default_layer: false`、`product_layer: false`  
- **禁止**再当打开地图的主图层

## 水系 water_id

```text
sh:w:{slug}
```

例：`sh:w:huangpu` · `sh:w:dishui_lake` · UI 默认开。

## 如何构建

```bash
npm run build:zones
npm run build:water
npm run build:grids:fine
npm run copy:public-data
# 或整包
npm run build
```

## 产物 → public/data

| 文件 | UI |
|------|-----|
| `zones_shanghai.geojson` + `.json` | 默认区面层 |
| `water_shanghai.geojson` | 默认水系 |
| `grids_fine.json` | 热力模式=细格 |
| `grids.json` | 兼容计算，**非默认** |
| `docs/data-attribution.md` | 署名 |

## 体量（batch）

- **batch1**：核心商圈/CBD/枢纽/临港/主要居住与产业（演示优先）  
- **batch2**：外围区县铺开  
- 统计见构建日志 / `zones_shanghai.json.by_batch`

## 下游

- **C**：指标优先挂 `zone_id`；细格热力用 `sh:f:…`；勿再假设 UI 读 1km 格。  
- **D**：默认图层 = 底图 + water + roads + zones；细格/KDE 切换；1km 格勿默认绘制。

## OSM building

Could，未做；不替代 zones。
