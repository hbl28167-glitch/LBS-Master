# 副路径验收（PRD 05.2 · WS-E 能源看板 + 等时圈）

> 运行：`npm run copy:public-data` → `npm run serve` → http://localhost:4173（Ctrl+F5）  
> 日期：2026-08-25 · 包：WS-E  
> 依赖：D `analysis_scene` 两卡 · C site+功率 · B 路网  
> 主路径：`docs/acceptance-main-path.md`

## 旅程 B（能源主打）

| # | 步骤 | 结果 | 备注 |
|---|------|------|------|
| 1 | 两卡定语境（时间×天气） | [x] | `analysis_scene` 全局 |
| 2 | 进 **能源** Tab | [x] | 无 disabled |
| 3 | KPI 条 ≥4 项有数 | [x] | 站数/功率MW/缺口区/覆盖·开放·高负荷 |
| 4 | 站列表单位 = **site** | [x] | 可排序：邻缺口/功率/利用/名 |
| 5 | 点站 → 详情含 **功率** | [x] | max_power / structure / total_rated_kw |
| 6 | 5/10/15 服务等时圈 | [x] | E.fromPoint · 路权 v0/CI |
| 7 | 覆盖区表 | [x] | ETA + 类型 + 是否缺口 |
| 8 | 情景Δ：平峰晴 vs 晚峰雨 | [x] | 结论卡模板句 + 圈随 scene 变 |
| 9 | 导出 snapshot 含 energy | [x] | access + compare |
| 10 | 到店单店聚焦 / 履约时效不回归 | [x] | 共用图层总线 |
| 11 | 出行主路径不坏 | [x] | OV→路网→出行 |

## 红线

| 项 | 结果 |
|----|------|
| 小李充电；无雇主站名 | [x] |
| 非真导航 API | [x] Synthetic 阻抗 |
| 禁止千桩同亮 | [x] site 粒度 + LOD |
| 选址 S5 仍可从缺口发起 | [x] 保留 |

## 口述

能源：KPI → 点高功率/邻缺口站 → 读 10min 覆盖 → 切晚峰雨看圈缩 → Δ 结论 → 导出。
