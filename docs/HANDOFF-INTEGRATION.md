# HANDOFF · 集成总检（Gate 0→F）

| 项 | 值 |
|----|-----|
| 日期 | **2026-08-23** |
| 仓 | 单一 repo：`LBS-Master`（git `master`；07 称 main，本仓直线分支名 = `master`） |
| HEAD（检时） | `f355ff2` — docs: fix HANDOFF-WS-F encoding and pin hash |
| 依据 | `07` 总闸 · `05` §成功指标 · `docs/HANDOFF-WS-A`…`F` · acceptance 主/副路径 |
| 范围 | **只报告与修阻塞集成的 bug**；本轮 **无阻塞 bug，无代码修补** |

---

## 1. 单一仓与提交链

| 检查 | 结果 |
|------|------|
| 独立 git 根 + README | **PASS** |
| A→F 均在同一 `master` | **PASS**（无分叉第二仓） |
| 关键提交 | A scaffold → B geo `f5e46df` → C synthetic `da91ce0` → D app `aaa830a` → E energy/gov `92081c9` → F demo/audit `7007bd3` |
| HANDOFF-WS-A…F 齐全 | **PASS** |

---

## 2. Gate 勾选（07）

### Gate 0 — 仓存在

| 项 | 结果 | 证据 |
|----|------|------|
| 独立 lbs-master 根与 git | **PASS** | `master` @ `f355ff2` |
| README 换机步骤可跟 | **PASS** | README Quick start + Volume + ODbL/Key |

### Gate A — 骨架

| 项 | 结果 | 证据 |
|----|------|------|
| `npm test` / node tests | **PASS** | 9/9（portable-paths + gcj）；Node v22.17.1 |
| `verify:paths` 无绝对盘符 | **PASS** | `portable-paths: OK (32 files)` |
| `contracts/` 四件套 | **PASS** | app-context.md · grid · scene-gap · payload |

### Gate B — 空间

| 项 | 结果 | 证据 |
|----|------|------|
| `grids.json` 非空 + 临港 | **PASS** | count=17280；lingang/dishui 类 labels 格 ≈924 |
| `roads_gcj` 可加载 | **PASS** | 34738 features；`npm run build` 重生 OK；copy → `public/data` |
| `alignment-sample.md` ≥20 点 | **PASS** | 22 samples · verdict **PASS** |
| `manifest` bbox + OSM 署名 | **PASS** | `bbox_gcj` + `osm_attribution` + `synthetic: true` |

### Gate C — 经营

| 项 | 结果 | 证据 |
|----|------|------|
| `metrics_ride` 覆盖 grids 主体 | **PASS** | 51840 rows；**17280/17280** grid 覆盖 100% |
| 系数表 + rain gap 方向 | **PASS** | `verify-synthetic: OK`；样例 `sh:1000:69:61` clear gap 60.8 → rain 85.9（Δ>0） |
| 小李实体无雇主站名 | **PASS** | 106×「小李充电」；雇主关键词命中 0 |

### Gate D — 主路径（面试必过）

| 项 | 结果 | 证据 |
|----|------|------|
| 配 AMAP_KEY 后底图 | **PARTIAL** | 代码路径：有 Key → 高德瓦片；**本机无真实 Key 文件**，未做有 Key 目视叠图。无 Key → CARTO fallback + banner，**不崩溃**（D HANDOFF / acceptance 已记） |
| OV→出行→双层→A/B→路网→导出 | **PASS（接线+既有验收）** | `acceptance-main-path.md` 8 步全 [x]；本轮复核：UI id/bind/export/roads/data 文件齐全；`build` 含 `copy-public-data` 11 files |
| scene 徽章可见 | **PASS** | `#scene-badge` + pack 切换写 scene |
| 换目录仍能跑 | **PASS** | `docs/portability-check.md`：换目录 9/9 tests |

> 本轮总控 **未再开浏览器人工点 7 步**（无本机 GUI 强制依赖）；以 D 验收单 + 静态接线 + 全量 build/copy 为据。若面试前要 100% 手感确认：`npm run serve` 跟 `docs/demo-script.md` 走一遍即可（约 5 分钟）。

### Gate E — 副路径

| 项 | 结果 | 证据 |
|----|------|------|
| 能源缺口可见 | **PASS** | `acceptance-side-path` + `metrics_chg` / nav-energy |
| 选址出分 | **PASS** | S5 CTA + 权重（HANDOFF-E） |
| 治理分色文案 | **PASS** | 数据质量图例；不处理终端 GPS 漂移 |

### Gate F — 发布

| 项 | 结果 | 证据 |
|----|------|------|
| demo-script 3–5 分钟 | **PASS** | `docs/demo-script.md` |
| 无 .env 真 Key 入仓 | **PASS** | 无 `.env` / `config.local.js`；gitignore |
| 体积策略 | **PASS** | README Volume；raw + `public/data/**` gitignore；git 跟踪 ~16.6MB 级 |

---

## 3. 命令实跑（本轮）

```text
node --test tests/portable-paths.test.js tests/gcj.test.js  → 9/9 pass
node scripts/verify-synthetic.js                            → OK
node scripts/build-all.js                                   → exit 0
  anchors → grids → landuse → roads → alignment PASS
  → synthetic → verify-synthetic → manifest → copy-public-data (11 files)
```

说明：PATH 上若无 `npm`，等价于 `node scripts/…` / `node --test …`（README 要求 Node 18+）。

---

## 4. 对照 PRD §成功指标

| 指标 | 结论 |
|------|------|
| 主路径可演示 | **达标**（清单 + 数据 + 壳） |
| 副路径可演示 | **达标**（E） |
| 路网-底图对齐 | **达标（文档/算法）**；有 Key 目视叠图建议面试前自看一眼 |
| 换机可运行 | **达标（换目录+相对路径+README）**；第二台物理机未在本轮重装验证 |
| GitHub 可承载 | **达标**（无密钥、无 raw OSM、体积策略） |
| 合规 | **达标**（Synthetic · 小李* · 0 雇主站名） |
| scene 不混读 | **达标**（徽章+公式） |
| 面试复述 | **材料齐**（demo-script）；需人练口播 |

---

## 5. 通过项 / 失败项 / 阻塞

### 通过

- Gate 0 / A / B / C / E / F：**全过**
- Gate D：**主路径与换目录过**；有 Key 底图为 **PARTIAL（环境无 Key，非代码阻塞）**
- `npm test` 等价命令与 **全量 `build`：成功**
- 无集成阻塞 bug，**无需回炉任何开工卡改代码**

### 失败 / 缺口（非阻塞）

| 项 | 级别 | 说明 |
|----|------|------|
| 本轮未浏览器手点 7 步 | 低 | 跟 demo-script 预演即可关闭 |
| 无真实 AMAP_KEY 目视验高德底图 | 低 | BYO Key；fallback 可讲 |
| 分支名 `master` 非 `main` | 信息 | 单直线仓，不影响演示 |
| HANDOFF-A 文案略旧（曾写 build 占位） | 信息 | 实际 build 已由 B/C 实现；不挡集成 |
| 本机 PATH 可能无 npm | 环境 | 装 Node 或把 node 进 PATH |

### 阻塞集成的 bug

**无。**

---

## 6. 是否可面试 / 可换机演示

| 问题 | 结论 |
|------|------|
| **是否达到「可换机演示」？** | **是（M2+M3 级）** |
| 条件 | 目标机 Node 18+；`copy:public-data` 或 `build`；可选 BYO 高德 Key；按 README / demo-script |
| 缺哪张开工卡回炉？ | **不需要回炉 A–F** |
| 建议用户动作 | ① 面试前本机 `serve` 手走 demo-script 一遍 ② 若有 Key 看一眼路网叠高德 ③ 推 GitHub 前再扫 `.env` |

### 一句话

> **集成总检通过：可换机、可讲主路径、副路径可点；无阻塞缺陷。** Gate D 的「有 Key 底图」与「浏览器手感」留给你 5 分钟预演关闭即可宣称面试就绪。
