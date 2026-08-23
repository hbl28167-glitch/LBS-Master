# HANDOFF WS-A

- 仓绝对路径：`C:\Users\hongbol\Documents\LBS-Master`
- 当前 branch / commit：（见文末 git 写入；以 `git rev-parse --abbrev-ref HEAD` / `git rev-parse HEAD` 为准）
- 如何跑 test：
  1. `cd` 到仓根（任意盘符/用户目录均可）
  2. Node 18+
  3. `npm test` 或 `npm run verify:paths`
- 下游 WS-B 应从哪读 contracts：
  - `contracts/app-context.md`
  - `contracts/grid.schema.json`
  - `contracts/scene-gap.schema.json`
  - `contracts/payload.schema.json`
  - 字段与 `06-LBS-Master-实现计划-v1.md` 跨 WS 接口一致；禁止擅自改名
- 已知问题：
  - `npm run build` 仅为占位 echo，真实管道由 WS-B/C 实现
  - `public/index.html` 与业务 JS 未建（WS-D）
  - 无 npm 运行时依赖；`npm install` 可选
  - 未下载 OSM、无 processed 数据（预期）
