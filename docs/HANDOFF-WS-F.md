# HANDOFF WS-F · 05.1 讲稿与发布审计

- branch：`master`
- 依赖：WS-D 05.1 地图台 · WS-E 到店/履约/能源 · B2 路网 QC
- 范围：demo-script / README 演示段 / 合规审计 / portability 日期 — **无产品功能开发**
- 规格：`Byteda/P1/05.1-LBS-Master-PRD-地图体验与空间体系.md`

## How to demo

```bash
cd <repo-root>
npm run copy:public-data
npm run serve
# → http://127.0.0.1:4173/  · Ctrl+F5
# 口播：docs/demo-script.md
# 或 start-demo.bat
```

禁止：`file://` 打开 HTML；禁止把 `Byteda/P1/demo/*.html` 当正式产品演示。

## Artifacts

| path | note |
|------|------|
| `docs/demo-script.md` | **05.1 重写**：地图感→点路过江/雨→出行→履约或到店→导出 |
| `README.md` | 架构六 Tab、演示主路径与 05.1 对齐；Byteda demo 非正式 |
| `docs/portability-check.md` | 日期 2026-08-24 复核 |
| `docs/HANDOFF-WS-F.md` | 本文件 |

## Gate F（05.1）

| 项 | 结果 |
|----|------|
| demo-script 3–5 分钟 · 地图叙事 | [x] |
| 无真 Key 入仓 | [x] 无 `.env`；config.local gitignore |
| ODbL / 高德 BYO 写清 | [x] README |
| 体积策略 | [x] raw + public/data gitignore |
| 路径扫描 | [x] portable-paths OK（52 files） |
| 讲稿红线 | [x] 不写真 A/B、真路况 API、商用导航；不写 1km 糊格主视觉 |
| Byteda demo 非正式 | [x] demo-script + README 双写 |

## 真实点击路径（与 D/E 一致，讲稿已对齐）

```text
总览（路网+区面+江+面热力）
  → 点路 / 叙事·过江 → 路段分析
  → 情景 B 雨 → 难度系数
  → 出行 TopN
  → 履约时效圈 或 到店单店聚焦
  → 导出
```

## 阻塞（指向他包，本 WS 不修功能）

| 项 | 级别 | 指向 |
|----|------|------|
| 细格热力大文件未 copy 时回退区面 | 已知限制 | D / copy |
| 拥堵为合成色非真路况 | 产品边界 | 讲稿已诚实声明 |
| 工作区可能有未提交的 roads/geo 脏文件 | 环境 | 勿与本 docs commit 混提 |

## Audit 2026-08-24

- `npm run verify:paths` / portable-paths：**PASS**
- 雇主站名：讲稿与 README 仅 **小李***
- 绝对路径：源码扫描 0；HANDOFF 可写仓路径说明可换机

## Milestone

| 项 | 状态 |
|----|------|
| 05.1 口播材料 | **就绪** |
| 可换机演示文档 | **就绪**（预演仍建议本机 serve 手走一遍） |

## Out of scope (honored)

- 无大功能开发  
- 未扩苏杭  
- 未改 processed 生成逻辑
