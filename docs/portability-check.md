# Portability check · 换目录实测

| 项 | 值 |
|----|-----|
| 日期 | **2026-08-24**（WS-F 05.1 续工复核） |
| 操作者 | WS-F 代理 |
| 源目录 | 开发机仓库根（任意盘符/用户名；源码无写死路径） |
| 初测 | 2026-08-23 拷贝至 `…/Temp/opencode/lbs-master-port-check` |
| 复核 | 2026-08-24：`portable-paths` 于当前仓 **52 files OK**；无 `.env` 真 Key 入仓 |

## 步骤与结果

| # | 步骤 | 结果 |
|---|------|------|
| 1 | 整树拷贝到新目录（排除 `node_modules`、`.git`、`data/raw`） | OK（08-23） |
| 2 | 新目录 portable-paths | **OK** |
| 3 | `node --test` portable + gcj | **9/9 pass**（08-23） |
| 4 | `scripts/lib/paths.js` ROOT | 运行时 resolve 到新目录；源码无盘符字面量 |
| 5 | `.env` / 真 Key | **无**；`config.local.js` gitignore，example 空模板 |
| 6 | 2026-08-24 源仓 `verify:paths` | **OK (52 files)** |

## 源仓审计（05.1 续工）

| 检查 | 结果 |
|------|------|
| 绝对路径 `scripts/` + `public/` | 0 violation |
| 真 Key 入仓 | 无 `.env`；`config.local.js` 不跟踪 |
| 雇主站名 | 展示 **小李***；禁词表仅 verify 门禁 |
| 巨型 raw OSM | `data/raw/**` gitignore |
| ODbL / 高德 | README 署名；Key BYO |
| 打开方式 | 必须 `http://127.0.0.1:4173/` 或 `start-demo.bat`，禁止 `file://` |

## 换机清单

```text
1. 安装 Node.js 18+
2. clone / 拷贝到任意目录
3. （可选）config.local.js / .env — 勿提交真 Key
4. npm test
5. npm run copy:public-data   # 或 npm run build
6. npm run serve  或  start-demo.bat
7. 浏览器 http://127.0.0.1:4173/  · Ctrl+F5
8. 口播 docs/demo-script.md（PRD 05.1）
```

## 结论

- **换目录路径检测通过**；UI 需 copy/build 后 serve。  
- 05.1 演示叙事见 `docs/demo-script.md`（地图感→点路→出行→履约/到店）。  
- **Byteda demo HTML 非正式产品。**

## 边界

- 未做第二台物理机 OS 重装级验证。  
- 未提交任何真实 Key。
