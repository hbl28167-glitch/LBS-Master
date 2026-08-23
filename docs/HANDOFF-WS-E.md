# HANDOFF WS-E

- 仓绝对路径：`C:\Users\hongbol\Documents\LBS-Master`（可换机；源码相对路径）
- branch：`master`
- commit：`92081c9` — `feat(app): energy siting and light governance`
- 依赖：WS-D 主路径 + WS-C `metrics_chg` / `entities_charger`

## How to run

```bash
cd <repo-root>
npm run copy:public-data   # 若 public/data 缺 chg/entities
npm run serve
# → http://localhost:4173
```

## Artifacts

| path | note |
|------|------|
| `public/index.html` | 顶栏能源/治理启用；图层卡；S5 面板容器 |
| `public/css/app.css` | 选址卡、治理边界、分色图例 |
| `public/js/app-context.js` | pack `energy`/`gov`；siting_open/grid |
| `public/js/metrics.js` | FORMULA_CHG、S5 权重/评分、质量 mock |
| `public/js/data-loader.js` | 加载 metrics_chg + entities_charger |
| `public/js/map-app.js` | 充电点 / 质量点 / 选址候选图层 |
| `public/js/main.js` | 能源列表+CTA、S5 面板、治理列表与导出 |
| `docs/acceptance-side-path.md` | 副路径勾选 |
| `docs/HANDOFF-WS-E.md` | 本文件 |

## Runtime contract (honored)

```text
# chg（与 ride 同形，系数换 scene）
demand = demand_base * weather_coeff[w].demand_chg * node_coeff_chg
supply = supply_base * weather_coeff[w].supply_chg * node_coeff_chg
gap    = demand - supply

# S5（可解释，非 ML）
R = 1.5km ≈ 格邻域（cell_m=1000 → ±1）
score = 0.35*Demand + 0.25*SupplyGap + 0.20*Competition
      + 0.10*Access + 0.10*(100-CannibalPenalty)
```

- 展示品牌：**小李充电**；禁止雇主站名  
- 治理图例标题：**数据质量**；文案：**不处理终端 GPS 漂移**  
- 选址非顶栏：缺口 CTA「发起选址」

## Gate E

见 `docs/acceptance-side-path.md` + `07` Gate E：

- [x] 能源缺口可见  
- [x] 选址可点出分  
- [x] 治理分色文案  

主路径回归：`docs/acceptance-main-path.md` 仍适用。

## Downstream

- **WS-F**：讲稿与仓库审计 / demo-script  
- 或集成 Gate 全量检查（总控开工卡）

## Out of scope (honored)

- 履约深做  
- 未重构 D 架构（仅扩展 pack 分支）  
- 未改 processed 生成 / grid_id  
- 未提交 Key / 雇主站名  
- 无 ML 选址

## Known limits

1. 选址 R 用格邻域近似，非精确路网缓冲。  
2. 竞品密度：合成数据几乎全是小李站，Competition 分项偏「空白」叙事。  
3. 治理问题为规则 mock（按 entity 下标抽样），非真实质检流水线。  
4. 能源负荷 Tab / 资产结构深页未做（Should 浅路径以缺口+选址为主）。
