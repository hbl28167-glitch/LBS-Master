# 主路径验收（PRD 05.1 · WS-D 地图台）

> 运行：`npm run copy:public-data` → `npm run serve` → http://localhost:4173  
> **请 Ctrl+F5 强刷**  
> 日期：2026-08-24 · 包：WS-D（05.1 大改）

## 05.1 成功指标

| # | 指标 | 结果 | 备注 |
|---|------|------|------|
| 1 | 第一眼地图感：无 1km 糊格；底图+路网+区面+面热力 | [x] | 默认 `heatRenderMode=poly`，区面类型色 |
| 2 | 路网默认开；可点路段 → 路段分析 | [x] | 拥堵/等级/业务难度三模式 |
| 3 | 情景联动：雨天路色+难度系数变 | [x] | A=clear / B=rain × TOD |
| 4 | 热力三模式同指标 | [x] | 区面默认；细格需 heat_fine；KDE 质心软圆 |
| 5 | LOD：缩小主干、放大支路/点 | [x] | city/district/block |
| 6 | 黄浦江水系默认显示 | [x] | `water_shanghai.geojson` |
| 7 | 五大 Tab 均可点（非 disabled） | [x] | 到店/履约/能源/治理最小可讲 |
| 8 | 出行深：demand×supply+拥堵+导出 | [x] | TopN + snapshot JSON |
| 9 | 无 Key 不崩溃 | [x] | fallback 底图 + banner |

## 演示叙事（手走）

| # | 步骤 | 结果 |
|---|------|------|
| 1 | 打开总览：认路网+区面+黄浦江 | [x] |
| 2 | 路网模式切拥堵/等级 → 点过江路段读叙事 | [x] |
| 3 | 情景切 B 雨 → 难度系数升、路更红 | [x] |
| 4 | 进出行：缺口 TopN + 公式 | [x] |
| 5 | 进履约/到店/能源：有图层与列表 | [x] |
| 6 | 导出 snapshot 成功 | [x] |

## 红线

| 项 | 结果 |
|----|------|
| 禁止 demand 冒充 gap（无 supply 禁用） | [x] |
| scene 徽章 + 只读公式 | [x] |
| Synthetic / 小李*；无雇主站名 | [x] |
| config.local.js gitignore | [x] |

## 已知限制

- 细格热力文件较大，若未 copy 会回退区面并提示。  
- 路段拥堵为等级×情景合成色（非真实路况 API）。  
- 到店单店聚焦为最小实现（覆盖圈+淡化其它店）。
