# HANDOFF · WS-B zones / water / fine-grids / 05.2 情景静态表

- 仓：`C:\Users\hongbol\Documents\LBS-Master`
- 路网底座：`HANDOFF-WS-B2.md`（QC PASS，本波不重下 B2）
- 本交付：区面贴路 v2 验收 + **05.2 情景/CI/典型路段**静态 JSON

## zone_id 规则（冻结 · 未改）

```text
sh:z:{type}:{slug}
```

例：`sh:z:retail:nanjing_east` · `sh:z:hub:hongqiao`  
改 id = 必须重做 C/D 挂接。

## 几何 v2（贴路）

| 项 | 值 |
|----|-----|
| 方法 | `roads_gcj` 半径采样 → 凸包 + 微膨胀（`scripts/lib/zone-geom.js`） |
| 禁止 | 光滑椭圆主视觉 |
| fallback | `irregular_fallback`（路网过稀） |
| 构建 | `npm run build:zones` → `npm run copy:public-data` |

### by_geometry_method（实跑）

见构建日志 / `zones_shanghai.json.by_geometry_method`。目标：**road_convex_hull 占绝大多数**。

抽检说明（无截图文件时人工）：

1. `npm run serve` → 开区面层  
2. 陆家嘴 / 徐家汇 / 虹桥：边界应有折线感，非正椭圆气泡  
3. 对照路网层：凸包贴主干走向  

## 05.2 静态规则（供 D 着色 / E 等时）

| 文件 | 用途 |
|------|------|
| `data/static/time_scenario.json` | 6 档 time_scenario（平峰=`wd_day_offpeak`，无 `wd_noon`） |
| `data/static/scenario_ci.json` | `city_CI` + `weather_f` + `lookup_city_ci` + v0 等级 |
| `data/static/ci_series_24h.json` | 工作日/周末 24h CI（夜低·早峰·午平台·晚峰最高）+ hour→scenario |
| `data/static/typical_road_anchors.json` | 早高峰典型路段均速锚点 + name 匹配策略 |
| `data/static/congestion_coeff.json` | 业务 difficulty，**6×天气**与 CI 同源（v0.2） |

全部 copy 到 `public/data/*`（`copy-public-data.js`）。

### city_CI 初值（clear）

| time_scenario | city_CI |
|---------------|--------:|
| wd_night | 1.00 |
| wd_am_peak | 1.75 |
| wd_day_offpeak | 1.30 |
| wd_pm_peak | 1.95 |
| we_day | 1.45 |
| we_night | 1.05 |

`weather_f`: clear=1.0 · rain=1.15 · extreme=1.35  

### 典型路段（wd_am_peak 强锚定）

莘庄立交 16.11 · 南北高架 19.40 · 北翟 22.46 · 环西 24.24 · 金沙江西 17.52 · 环南 27.61 · 真北立交 24.69（km/h）  
匹配：`name` 子串白名单，见 `typical_road_anchors.json`。

## 水系

示意黄浦江等已删（不准）；`water_shanghai.geojson` 为空，底图自带水系。

## fine grid_id（冻结）

```text
sh:f:{cell_m}:{row}:{col}
```

非 UI 默认。旧 1km `sh:{cell_m}:{row}:{col}` 仅计算兼容。

## 如何构建

```bash
npm run build:zones
npm run copy:public-data
# 静态 JSON 无需编译，改文件后 copy 即可
```

## 下游

- **D**：两卡读 `time_scenario` + `weather`；路色用 `scenario_ci`×锚点；趋势用 `ci_series_24h`；区面用 geojson  
- **E**：等时权 `length/v`，v 来自同一 CI 表  
- **C**：difficulty 优先 `congestion_coeff` 六档键  

## 署名

`docs/data-attribution.md` — 情景/CI **Synthetic**，形态参考公开规律，**非真 API、不爬取**。
