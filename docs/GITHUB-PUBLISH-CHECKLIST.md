# GitHub 发布检查清单

> 用途：每次将 LBS Master 推送到公开 GitHub 仓库前执行。检查只针对作品集发布，不代表生产安全审计。

## 1. 功能与测试

- [ ] `npm test` 全部通过；
- [ ] `npm run copy:public-data` 成功；
- [ ] `npm run copy:regional-data` 成功；
- [ ] `npm run serve` 后可打开 `http://127.0.0.1:4173/`；
- [ ] 中台总览、到店、出行、履约、能源、治理均可切换；
- [ ] 六区选择可用，Ready/Conditional 状态与数据一致；
- [ ] 陆家嘴能源异常诊断可以进入、退出并恢复原地图状态；
- [ ] 地图可拖拽、缩放，实体悬停/点击和建筑懒加载正常。

## 2. 敏感信息

- [ ] `.env` 未进入 Git；
- [ ] `public/config.local.js` 未进入 Git；
- [ ] 示例配置中的 `amapKey` 为空；
- [ ] 没有 access token、密码、Cookie、私有 URL 或个人身份数据；
- [ ] 没有公司内部数据、真实业务站点清单或真实用户数据。

建议检查：

```powershell
git status --short
git diff --cached
git grep -n -i -E "api[_-]?key|access[_-]?token|secret|password"
```

## 3. 数据与许可

- [ ] README 明确标注 Synthetic；
- [ ] OSM 数据保留 `© OpenStreetMap contributors` 与 ODbL 声明；
- [ ] 功能地块没有被描述为官方法定规划区；
- [ ] ETA 没有被描述为商业导航或真实实时路况；
- [ ] 高德 Key 未提交；
- [ ] 自定义水系矢量保持为空，不声称存在可靠黄浦江过滤。

## 4. 仓库体积

- [ ] `.venv`、`node_modules`、缓存目录未进入 Git；
- [ ] 区域和实验原始 OSM 下载未进入 Git；
- [ ] `public/data/**` 运行时复制数据未进入 Git；
- [ ] `data/processed/metrics_heat_fine.json` 未进入 Git；
- [ ] 没有单文件超过 100 MB；
- [ ] 超过 50 MB 的可再生文件优先排除或改用 Release/LFS。

## 5. 作品集内容

- [ ] README 与当前页面和数据状态一致；
- [ ] 没有把规划态写成已完成成果；
- [ ] 没有把模拟收益写成真实业务收益；
- [ ] 六区真实建筑完成度描述准确；
- [ ] 快速启动命令在另一目录可以执行；
- [ ] 仓库描述和首页文案适合公开展示。

## 6. 提交与发布

建议首次公开提交信息：

```text
feat: prepare LBS Master portfolio release
```

发布前最后检查：

```powershell
git status --short
git diff --stat
git diff --check
```

在 GitHub Desktop 中完成提交后，使用 `Publish repository` 创建远程仓库。首次发布建议先设为 Private，在线复核 README 和文件列表后再改为 Public。
