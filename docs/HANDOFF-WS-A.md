# HANDOFF WS-A

- 仓绝对路径：`C:\Users\hongbol\Documents\LBS-Master`
- 当前 branch / commit：`master` / `1f5569b2169c341840ec16d38fa7b5b718487430`
- 如何�?test�?  1. `cd` 到仓根（任意盘符/用户目录均可�?  2. Node 18+
  3. `npm test` �?`npm run verify:paths`（等价于 `node --test tests/` / `node tests/portable-paths.test.js`�?- 下游 WS-B 应从哪读 contracts�?  - `contracts/app-context.md`
  - `contracts/grid.schema.json`
  - `contracts/scene-gap.schema.json`
  - `contracts/payload.schema.json`
  - 字段�?`06-LBS-Master-实现计划-v1.md` �?WS 接口一致；禁止擅自改名
- 已知问题�?  - `npm run build` 仅为占位 echo，真实管道由 WS-B/C 实现
  - `public/index.html` 与业�?JS 未建（WS-D�?  - �?npm 运行时依赖；`npm install` 可�?  - 本机 shell 若未�?Node 加入 PATH，需先装 Node 18+ 或把 `node` 加入 PATH 后再�?`npm test`
  - 未下�?OSM、无 processed 数据（预期）
