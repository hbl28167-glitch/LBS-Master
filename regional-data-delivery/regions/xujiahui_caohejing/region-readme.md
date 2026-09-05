# 徐家汇—漕河泾 (xujiahui_caohejing)

## bbox_wgs
`121.39, 31.145, 121.465, 31.215`

## 数据
- 道路/建筑：OSM Overpass，ODbL
- 功能分类 / 速度缺失值 / 实体与经营指标：**Synthetic**（字段已标记）

## QC
- road: **conditional_pass** giant=0.9519 n=3810
- zone: **pass** assign=1 zones=573
- entity: **pass** n=12 residential_origin=3

## 情景方向
平峰晴 → 晚高峰晴 → 晚高峰雨：ETA 上升、coverage_10min_ratio 下降、gap 变差（见 scenario-metrics.json）。

## 业务闭环
- 异常：晚高峰及雨天情景下，10 分钟服务覆盖率下降、ETA P90 上升、缺口扩大
- 根因：跨江/主干阻抗上升 + 住宅需求点与供给节点路网距离拉大（Synthetic 情景）
- 动作：跨江候选点/补站或运力调整；优先覆盖两侧住宅需求点
- 收益：覆盖率回升、lost_orders 下降（见 scenario-metrics 方向）
- 风险：Synthetic 经营数字不可当真实营收；等时需主控侧 Road V3 接入

## 住宅
residential 功能区数量：444；residential_origin 实体：3
