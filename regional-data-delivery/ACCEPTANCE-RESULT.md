# 多区域数据交付验收结果

> 由 `02-ACCEPTANCE-TEMPLATE.md` 填写  
> 日期：2026-08-30  
> `verify-all.js`：**CONDITIONAL**（error_count=0）  
> manifest：`manifest.json`

## 1. 交付概况

- 完成区域数：`5/5`
- 总体结论：`CONDITIONAL`
- 生产环境：Windows · Node 22（sitemap tools node）· Overpass 部分失败后本地 fallback

## 2. 根目录完整性

| 检查项 | 结果 |
|---|---|
| manifest.json | PASS |
| qc-summary.json | PASS |
| HANDOFF.md 10 问 | PASS |
| KNOWN-ISSUES.md | PASS |
| verify-all.js | PASS |
| 未改主应用 | PASS |

## 3. 五区汇总

| region_id | Road | Zone/Building | Residential | Business | Reproducible | 总结论 |
|---|---|---|---|---|---|---|
| qiantan_xuhui_riverside | PASS | PASS（真建筑 11k+） | PASS | PASS | PASS | **PASS** |
| xujiahui_caohejing | COND（giant 0.95） | PASS（真建筑 13k+） | PASS | PASS | PASS | **CONDITIONAL** |
| hongqiao_hub | PASS（裁剪路网） | COND* 种子建筑 | PASS | PASS | PASS | **CONDITIONAL** |
| zhangjiang | PASS（裁剪） | COND* 种子 | PASS | PASS | PASS | **CONDITIONAL** |
| lingang | PASS（裁剪） | COND* 种子 | PASS | PASS | PASS | **CONDITIONAL** |

\* 建筑为 synthetic_seed，功能区仍产出且含 residential；**主控展示真建筑请优先前滩/徐家汇或重拉 Overpass**。

## 4. 口径声明

- [x] OSM 来源/ODbL（成功下载区）  
- [x] WGS/GCJ 分文件  
- [x] 功能分类 Synthetic  
- [x] 速度来源可区分  
- [x] 实体与经营指标 Synthetic  
- [x] 未称真实/实时/官方  
- [x] 无个人信息/雇主站名  

## 5. 最终状态

**CONDITIONAL** — 可交付主控接入试点；生产级建筑/支路需网络恢复后重跑虹桥/张江/临港。

生产代理：regional-data-agent  
日期：2026-08-30
