# HANDOFF WS-A

- 仓绝对路径：`C:\Users\hongbol\Documents\LBS-Master`
- 当前 branch / commit：`master`（以 `git rev-parse HEAD` 为准）
- 范围：仓库骨架 / 可移植 / **contracts（含 05.1 对齐）**
- 如何跑 test：
  1. `cd` 到仓根（任意盘符/用户目录均可）
  2. Node 18+
  3. `npm test` 或 `npm run verify:paths`

## contracts 路径（下游必读）

| 路径 | 用途 |
|------|------|
| `contracts/README.md` | 索引 + 05.1 delta |
| `contracts/app-context.md` | AppContext 全字段（含 05.1） |
| `contracts/zone.schema.json` | 区面 zone |
| `contracts/zone-color-tokens.md` | 商业紫/工业浅蓝/住宅米白等 token |
| `contracts/lod.md` | city \| district \| block |
| `contracts/store-focus.md` | 到店单店聚焦 |
| `contracts/road-display.md` | roadDisplayMode + congestion 展示 |
| `contracts/grid.schema.json` | 细格/遗留格（**非**默认主视觉） |
| `contracts/scene-gap.schema.json` | 供需 base 行 |
| `contracts/payload.schema.json` | manifest 头 |

## 05.1 新增 AppContext 字段

- `roadDisplayMode`: `cong` \| `grade` \| `biz`（默认 `cong`）
- `heatRenderMode`: `poly` \| `grid` \| `kde`（默认 `poly`）
- `lodLevel`: `city` \| `district` \| `block`
- `storeFocusId` / `storeFocusMode`
- `selected_zone_id` / `selected_road_id` / `active_pack`
- `congestion.share_blocked` \| `difficulty_coeff` \| `narrative`（只读展示/可快照）

## 破坏性变更

| 项 | 说明 |
|----|------|
| **无 grid_id 算法变更** | 字符串规则未动；禁止下游自行改 id 生成 |
| 产品语义 | 1km 糊格 **不得**再作默认主视觉（05.1 Won't）；schema 保留供细格热力/迁移 |
| 默认图层 | 总览默认路网+区面+面热力+水系，而非粗格填色 |
| 字段扩展 | 旧 UI 若写死仅 05 字段，需读新字段（缺省按 app-context 默认） |

## 下游注意

| WS | 注意 |
|----|------|
| **B / B2** | 路网 QC 门禁；区面几何产出应对齐 `zone.schema.json` + color_token；勿再把 1km 格当产品主交付 |
| **C** | 指标优先挂 **zone_type × grade × time_of_day**；输出拥堵系数供 `congestion.difficulty_coeff`；实体量级见 05.1 |
| **D** | 读 `roadDisplayMode` / `heatRenderMode` / `lodLevel`；叙事条+路段分析；默认开路网 |
| **E** | 到店 `storeFocus*`；五大 Tab 可点 |
| **F** | 讲稿与审计按 05.1，勿再吹「格网看板」 |

## 体验验收

- **以 PRD 05.1 为准**（压过旧「能点出行即过」）。
- 示意 UI：`Byteda\P1\demo\`（非正式，不在本仓迭代生产数据）。

## 已知问题

- 本 WS-A 续工 **只改 contracts/README/HANDOFF**，未改 public 业务 UI、未重跑合成。
- `npm run build` / 路网数据状态见 HANDOFF-B2 / INTEGRATION。
- 源码 portable：`scripts/` + `public/` 禁止盘符绝对路径（`verify:paths`）。
