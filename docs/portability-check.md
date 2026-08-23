# Portability check · 换目录实测

| 项 | 值 |
|----|-----|
| 日期 | **2026-08-23** |
| 操作者 | WS-F 代理 |
| 源目录 | 开发机上的仓库根（任意盘符/用户名均可；源码无写死路径） |
| 实测目录 | 拷贝至临时路径 `…/AppData/Local/Temp/opencode/lbs-master-port-check`（**换目录**，非同路径打开） |
| Node | v22.17.1（便携 node；目标机需自备 Node 18+） |

## 步骤与结果

| # | 步骤 | 结果 |
|---|------|------|
| 1 | 整树拷贝到新目录（排除 `node_modules`、`.git`、`data/raw`） | OK |
| 2 | 在新目录执行 portable-paths 扫描 | **OK** — `portable-paths: OK (32 files scanned)` |
| 3 | 在新目录 `node --test tests/portable-paths.test.js tests/gcj.test.js` | **9/9 pass** |
| 4 | `scripts/lib/paths.js` 解析 `ROOT` | 解析为**新目录绝对路径**（运行时 `path.resolve`，源码无盘符字面量） |
| 5 | `.env` / `config.local.js` | 源仓与拷贝均 **不存在** 真 Key 文件；example 仅空模板 |
| 6 | gitignore 抽检 | `.env`、`public/config.local.js`、`data/raw/osm/*` 均被忽略规则覆盖 |

## 源仓审计（同日）

| 检查 | 结果 |
|------|------|
| `git status` | clean（审计前） |
| 绝对路径扫描 `scripts/` + `public/` | 0 violation |
| 真 Key 入仓 | 无（无 `.env`、无 `config.local.js`） |
| 雇主站名 / 禁品牌展示 | UI 与数据为 **小李***；`verify-synthetic` 含禁词表属防护，非展示 |
| 巨型 raw OSM | `data/raw/**` gitignore；不入主仓 |
| git 已跟踪体积（约） | **~16.6 MB**（不含 raw / public/data 运行时拷贝） |
| 工作区含 processed 时量级 | 约数十 MB 级本地文件；策略见 README Volume |

## 换机清单（给下一台电脑）

```text
1. 安装 Node.js 18+
2. clone / 拷贝仓库到任意目录
3. copy .env.example → .env          # 可选，管道用
4. copy public/config.local.example.js → public/config.local.js  # 填 amapKey
5. npm test
6. npm run copy:public-data   # 或 npm run build
7. npm run serve              # http://localhost:4173
```

## 结论

- **换目录可运行检测通过**（路径测试 + GCJ 单测）。  
- UI 全链路需本机 `copy:public-data`/`build` 后 `serve`（`public/data` 默认不入 git）。  
- 高德 Key **自备**；无 Key 可降级演示。

## 未做 / 边界

- 未在第二台物理机重装 OS 级验证（本记录 = **换目录/换路径根** 实测，满足 PRD「不绑死本机路径」）。  
- 未在本记录中提交任何真实 Key。
