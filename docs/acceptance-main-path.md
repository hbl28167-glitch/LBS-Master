# 主路径验收（PRD 05.2 · 旅程 A · WS-D 呈现）

> `npm run copy:public-data` → `npm run serve` → http://localhost:4173 → **Ctrl+F5**  
> 日期：2026-08-25

## 旅程 A · 总览定语境

| # | 步骤 | 结果 |
|---|------|------|
| 1 | 打开总览：区面贴路感 + 路网 + 江（非 1km 糊格） | [x] |
| 2 | 右栏 **24h 趋势**：双峰形态；当前 scene 竖线 | [x] |
| 3 | 时间卡 → 工作日·早高峰，天气·晴：廊道/高架更红 | [x] |
| 4 | 时间卡 → 工作日·晚高峰：CI/难度到上界带 | [x] |
| 5 | 天气 → 雨：CI 上浮、芯片与路色变 | [x] |
| 6 | 点南北高架/莘庄等锚点路段 → 路段分析有 CI 档+文案 | [x] |
| 7 | 镜头陆家嘴/虹桥/临港 **仅 flyTo**，不改 scene | [x] |

## 05.2 控件与呈现

| 项 | 结果 |
|----|------|
| 仅两主卡改 analysis_scene（时间6档×天气） | [x] |
| 左坞：底图/水系/路网/区面/热力/站店/圈/图例 + 路网模式 + 热力形态 | [x] |
| +/- 左下可点，不被坞遮挡 | [x] zoom=bottomleft · 坞=topleft · 图例=bottomright |
| 路况四档图例 + Synthetic 小字 | [x] 畅通/缓慢/拥堵/严重 |
| 早 vs 晚 vs 夜色可辨；高架锚点 > 次干 | [x] 烟测 am elev CI>sec |
| 区面 road_convex_hull 为主（非椭圆阵） | [x] 113 hull / 5 fallback |
| 无 Key 不崩溃；Synthetic 可见 | [x] |
| 切 Tab 保留 basemap/roads 等开关偏好 | [x] |

## 红线

| 项 | 结果 |
|----|------|
| 镜头不冒充情景 | [x] |
| 禁止 demand 当 gap | [x] |
| Key 不进仓 | [x] |

## E 可否开工

**可以。** analysis_scene 两卡 + 路网 CI 色 + 图层总线已稳；能源 Tab 可进、site 可点；等时圈/站网 KPI 深做归 WS-E。
