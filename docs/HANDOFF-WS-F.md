# HANDOFF WS-F

- branch：`master`
- commit：`7007bd3` — `docs: demo script and release audit`（钉死见后续 pin commit）
- 依赖：WS-D 主路径 + WS-E 副路径（均已交付）
- 范围：讲稿、README、合规审计、换目录实测 — **无产品功能开发**

## How to demo

```bash
cd <repo-root>
npm test
npm run copy:public-data   # if public/data empty
# optional BYO key:
#   cp public/config.local.example.js public/config.local.js
npm run serve
# → http://localhost:4173
# Talk track: docs/demo-script.md
```

## Artifacts

| path | note |
|------|------|
| `docs/demo-script.md` | 3–5 min 口播（时代→三层→OV/出行→A/B→路网→导出→收束；E 可选 60s） |
| `README.md` | 架构图、主路径、scripts、config、ODbL/Key、体积策略、GitHub blurb |
| `docs/portability-check.md` | 2026-08-23 换目录实测 |
| `docs/HANDOFF-WS-F.md` | 本文件 |

## Gate F

| 项 | 结果 |
|----|------|
| demo-script 3–5 分钟 | [x] `docs/demo-script.md` |
| 无 .env 真 Key 入仓 | [x] 无 `.env` / `config.local.js`；example 空模板；gitignore |
| 体积策略说明 | [x] README Volume + raw/public/data gitignore |
| 路径扫描 | [x] portable-paths OK（32 files）；换目录 9/9 tests |
| 讲稿红线 | [x] 不写真 A/B 实验、不写商用导航；Synthetic / 小李* |

## Audit notes

- `scripts/verify-synthetic.js` 含品牌禁词正则（含防护用词）— **门禁，非 UI 展示**。
- HANDOFF 内可保留本机绝对路径说明「可换机」；**源码** `scripts/`/`public/` 无盘符字面量。
- git 跟踪约 **16.6 MB** 量级；raw OSM 与 `public/data/**` 不入仓。

## Milestone call

| 里程碑 | 状态 |
|--------|------|
| **M2** 主路径 + 换机/讲稿 | **可演示**（D + F） |
| **M3** 能源/选址/治理浅 + 仓库审计 | **可演示**（E 验收单全勾 + 本 WS-F 审计） |
| M4 | 非 v1 必达（苏杭等） |

## Downstream

- 用户/总控按 `07-LBS-Master-WS拼接与集成.md` 做 **Gate A–F 总检**。
- 可选：推远程、填 GitHub About 为 README 末「Suggested GitHub blurb」。

## Out of scope (honored)

- 无大重构；未扩苏杭
- 未改 grid_id / processed 生成逻辑
- 未提交 Key / 雇主站名
