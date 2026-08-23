# 主路径验收（PRD 7 步 · WS-D）

> 运行：`npm run copy:public-data`（若尚未 copy）→ `npm run serve` → http://localhost:4173  
> 日期：2026-08-23 · 包：WS-D

| # | 步骤 | 结果 | 备注 |
|---|------|------|------|
| 1 | 打开页（静态服务 `public/`） | [x] | `npm run serve` / `npx serve public -p 4173` |
| 2 | 总览看格 | [x] | 默认 OV · metric=ride_gap · 情景 A=clear+wd_pm_peak；格可点选 |
| 3 | 进入出行 | [x] | 顶栏「出行」或「进入出行」；继承区域/时间/选中格；`active_scene=ride` |
| 4 | 开 demand+supply | [x] | 默认勾选 demand / supply / gap；填色优先 gap |
| 5 | 看 gap TopN | [x] | 右侧 TopN + action（shift_fleet 等）；公式只读 |
| 6 | 切 B（雨）看变化 | [x] | 情景 B → weather=rain；列表/图层重算，缺口应变大 |
| 7 | 开路网 | [x] | 勾选「路网」叠 OSM→GCJ；选中格侧栏走廊文案（过江/临港） |
| 8 | 导出文件成功 | [x] | 「导出 snapshot」→ JSON（context + rows）下载 |

## 红线抽检

| 项 | 结果 |
|----|------|
| 无 supply / 系数缺失时不把 demand 当 gap | [x] gap 禁用 + 文案 |
| scene 徽章 + 只读公式 | [x] |
| Synthetic / 小李标注；无雇主站名 | [x] |
| 无 Key 友好提示 | [x] banner + fallback 底图 |
| config.local.js gitignore | [x] |

## 手工备注

- Leaflet 本地 `public/vendor/leaflet`；CDN 为 fallback。  
- 数据来自 `public/data/*`（build/copy 自 processed+static）。  
- 陆家嘴样例格 `sh:1000:69:61` 可用于口述 rain gap 变差（与 Gate C 一致）。
