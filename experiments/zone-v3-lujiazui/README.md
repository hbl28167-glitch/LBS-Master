# 陆家嘴功能区 V3 · 视觉试点

独立实验：使用现有 OSM/GCJ 路网围合自然街区，并叠加开放建筑轮廓，与当前 V2 凸包功能区做同镜头对比。

- 不覆盖正式 `zones_shanghai`。
- 不生成正式 `zone_type`。
- 建筑：OpenStreetMap / Overpass，ODbL。
- 道路：项目现有 OSM 衍生路网，ODbL。
- 当前阶段只验证边界形态。

运行：

```powershell
node scripts/build-pilot.js
node ../../scripts/serve-static.js preview 4283
```

打开 `http://127.0.0.1:4283/`。
