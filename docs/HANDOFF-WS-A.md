# HANDOFF WS-A

- 仓绝对路径：`C:\Users\hongbol\Documents\LBS-Master`
- 当前 branch / commit：`master`（以 `git rev-parse HEAD` 为准）
- 范围：骨架 / 可移植 / **contracts（05.1 + 05.2）**
- 如何跑 test：Node 18+ → 仓根 `npm test` 或 `npm run verify:paths`

## contracts 路径

| 路径 | 用途 |
|------|------|
| `contracts/README.md` | 索引 + delta |
| `contracts/app-context.md` | AppContext 全字段 |
| `contracts/analysis-scene.md` | 6 时间档 × 天气；镜头 demote |
| `contracts/accessibility.md` | E fromPoint 请求/响应说明 |
| `contracts/accessibility.schema.json` | `$defs.FromPointRequest` / `AccessibilityResult` |
| `contracts/site.md` + `site.schema.json` | 能源 **site** + 功率字段 |
| `contracts/road-display.md` | 四档 cong_class + Synthetic |
| `contracts/zone.schema.json` / `zone-color-tokens.md` | 区面（`zone_id` 冻结） |
| `contracts/lod.md` / `store-focus.md` | LOD / 到店聚焦 |
| `contracts/grid.schema.json` | 细格（`grid_id` 冻结；非主视觉） |
| `contracts/scene-gap.schema.json` / `payload.schema.json` | 供需行 / manifest |

## 05.2 新增 / 修订要点

### analysis_scene

```js
analysis_scene = { time_scenario, weather }
```

- **time_scenario（6）：** `wd_night` | `wd_am_peak` | `wd_day_offpeak` | `wd_pm_peak` | `we_day` | `we_night`  
  - 平峰合并：无独立 `wd_noon` → 用 `wd_day_offpeak`
- **weather：** `clear` | `rain` | `extreme`
- 遗留 `time_of_day` / 顶层 `weather`：兼容镜像，写入时与 `analysis_scene` 对齐
- **`scenario` A/B：** 降级为可选 UI 快捷，**不再**作为分析主轴
- **镜头 / mapCamera：** **仅 flyTo**；改镜头不得改路况/等时圈

### layer_set

- **`basemap` 可关**（仅高德；关后深色空底 + 矢量）
- `water` / `roads` / `zones` / `heat` / `overlay` / `isochrone` / `sites` 等均可关
- 数组内 = 开，缺省 = 关

### 路况四档

`cong_class`: `free` | `slow` | `cong` | `severe` + 全程 **Synthetic** 声明；与 `analysis_scene` 同源 CI 表

### Accessibility E

- 请求：`source` + `analysis_scene` + `bands_min` 默认 `[5,10,15]`
- 响应：`bands[]` 几何、`zone_coverage[]`、`stats.roads_qc_ok`；QC 失败不得伪造成功圈

### 能源 site

- 单位：**site**（非桩林主角）
- Must 字段方向：`site_id`、`stall_count`、`max_power_kw` 和/或 `power_structure`、`synthetic: true`
- AppContext：`selected_site_id`、`siteFocusMode`

## 破坏性变更

| 项 | 说明 |
|----|------|
| **无** `grid_id` / `zone_id` 算法变更 | 禁止擅自改 id 生成 |
| 分析主轴 | 从「日内+天气+镜头平铺 / A·B」→ **两维 `analysis_scene`** |
| 时间枚举 | 应用 6 档；旧随意 `time_of_day` 字符串需映射到 6 档 |
| 图层 | basemap 非强制常开 |
| 能源实体 | 列表/地图默认 site；旧「桩点冒充站」须在 C 合并 |

## 下游注意

| WS | 注意 |
|----|------|
| **B / B2** | 路名保留供早峰锚点；区面 **贴路多边形**（反椭圆）；id 冻结 |
| **C** | 静态表：`scenario_ci`、典型路段、`ci_series_24h`；系数键 = `time_scenario`×`weather`；**site + 功率**；`congestion_coeff` 与 CI 同源 |
| **D** | 两卡 IA；layer 总开关含底图；四档图例；趋势绑 scene；镜头 flyTo only；缩放避让（实现） |
| **E** | 实现 Accessibility E；能源 KPI+站列表+功率详情；点站 5/10/15 + Δ |
| **F** | 讲稿按 05.2 旅程 A/B，强调决策结论而非图层巡游 |

## 验收口径

- 地图壳 / 区面配色 LOD： **05.1**
- 业务评估（情景、路况语义、可达、能源站圈）： **05.2**
- demo 目录：非正式

## 已知问题

- 本波 **仅 contracts + README + HANDOFF**；未改 public 大 UI、未下 OSM、未重算合成
- portable：`npm test` / `verify:paths` 必须过
