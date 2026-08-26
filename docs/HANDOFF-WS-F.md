# HANDOFF WS-F · PRD 05.2 讲稿与合规审计

- branch：`master`
- 依赖：D `a21cc7d` 呈现 · E `74f0d0a` 能源看板+等时圈 · B zones/CI
- 范围：demo-script / README 演示段 / 审计 — **无产品功能开发**
- 规格：`Byteda/P1/05.2-LBS-Master-PRD-可达评估与能源服务圈.md`

## How to demo

```bash
cd <repo-root>
npm run copy:public-data
npm run serve
# http://127.0.0.1:4173/  · Ctrl+F5
# 口播 docs/demo-script.md
```

禁止：`file://`；禁止 Byteda `P1/demo/*.html` 冒充正式版。

## Artifacts

| path | note |
|------|------|
| `docs/demo-script.md` | **05.2 重写**：两卡→路网结构红+图例→区面贴路→趋势一句→能源 KPI→站→圈→Δ→决策 |
| `README.md` | 演示主路径对齐旅程 A/B |
| `docs/HANDOFF-WS-F.md` | 本文件 |

## 真实点击路径（与 D/E 一致）

```text
# 旅程 A
总览 · sel-time × sel-weather
  → 早高峰·晴：廊道 CI 结构红 + 图例
  → 区面贴路
  → 24h 趋势竖线
  → （可选）晚高峰 / 雨 = 压力上界

# 旅程 B（主打）
能源 · KPI 条
  → 站列表点 site（小李充电）
  → 5/10/15 圈 + 覆盖表
  → 平峰晴 vs 晚峰雨 Δ + 决策句
  → 导出 snapshot
```

## Gate F

| 项 | 结果 |
|----|------|
| demo-script 3–5 min · 05.2 旅程 | [x] |
| 红线话术（真路况/真A-B/导航/糊格/雇主名） | [x] 表内禁止列 |
| 无真 Key 入仓 | [x] 无 `.env`；config.local gitignore |
| 源码无绝对路径 | [x] portable-paths（见下） |
| ODbL / Synthetic | [x] README |
| Byteda demo 非正式 | [x] demo-script + README |

## Audit（本波）

- 讲稿与 acceptance 旅程 A/B 对齐  
- 镜头 flyTo ≠ scene：讲稿写明  
- 无功能代码改动  

## 阻塞（仅记录）

| 项 | 指向 |
|----|------|
| 等时/CI 为合成近似 | 产品边界，讲稿已诚实声明 |
| 工作区可能有 roads 脏文件未提交 | 勿与本 docs commit 混提 |

## Out of scope

- 无大功能开发；未扩城
