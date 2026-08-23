# HANDOFF WS-D

- 仓绝对路径：`C:\Users\hongbol\Documents\LBS-Master`（可换机；源码相对路径）
- branch：`master`
- commit：见 `git log -1`（信息 `feat(app): overview and ride main path`）
- 依赖：WS-A/B/C（contracts + processed metrics/grids/roads）

## How to run

```bash
cd <repo-root>
# 若尚无 public/data：
npm run copy:public-data
# 或全量
npm run build

# 可选 Key
copy public\config.local.example.js public\config.local.js
# 编辑 amapKey=

npm run serve
# → http://localhost:4173
```

无 Key：fallback 底图 + 顶栏横幅，不崩溃。

## Artifacts

| path | note |
|------|------|
| `public/index.html` | 顶栏 IA、全局控件、地图、右侧列表 |
| `public/css/app.css` | 布局 |
| `public/js/app-context.js` | AppContext + subscribe；切包继承 region/time/selection |
| `public/js/metrics.js` | demand/supply/gap；禁止无 supply 冒充 gap |
| `public/js/data-loader.js` | fetch `public/data/*` |
| `public/js/map-app.js` | Leaflet 底图/格/路网 |
| `public/js/main.js` | OV + 出行 + A/B + 导出 |
| `public/vendor/leaflet/*` | 本地 Leaflet 1.9.4 |
| `public/data/*` | copy 自 processed/static（含 corridor_copy） |
| `scripts/copy-public-data.js` | build 末步 |
| `data/static/corridor_copy.json` | 过江/临港等侧栏文案 |
| `docs/acceptance-main-path.md` | 主路径 7+1 步勾选 |

## Runtime contract (honored)

```text
demand = demand_base * weather_coeff[w].demand_ride * node_coeff
supply = supply_base * weather_coeff[w].supply_ride * node_coeff
gap    = demand - supply
```

- 情景 A：`clear` + 当前 TOD（默认 `wd_pm_peak`）
- 情景 B：`rain` + 同时段
- scene 徽章 + 只读公式；Synthetic 标注

## Gate D / 主路径

见 `docs/acceptance-main-path.md` — 全部勾选通过（实现侧自检）。

## Downstream

- **WS-E**：能源/选址/治理浅（顶栏已 disabled 占位）
- **WS-F**：讲稿与仓库审计

## Out of scope (honored)

- 未深做能源选址（E）
- 未改 processed 生成逻辑 / grid_id
- 未提交 Key / 雇主站名

## Known limits

1. 全量 1.7 万格绘制做了阈值稀疏 + 绝对值排序 cap，演示以中心城/高缺口为主。  
2. 路网 3.4 万 features 抽样绘制以保帧率。  
3. 无 Key 时 fallback 底图为 WGS 系第三方瓦片，与 GCJ 路网可能有视觉偏差；配高德 Key 后对齐叙述以 B 的 alignment 为准。
