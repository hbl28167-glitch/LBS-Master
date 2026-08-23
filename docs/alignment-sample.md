# Alignment sample · WS-B

- built_at: 2026-08-23T09:52:31.755Z
- samples: 22
- paired_with_anchors: 16
- residual_median_m: 0
- residual_p90_m: 0
- roads_features: 34738
- roads_source: local_overpass_json
- **verdict: PASS**

## Method

1. Take public WGS84 landmarks (Shanghai incl. Lingang).
2. Convert with `scripts/lib/gcj.js` → GCJ-02.
3. Where `anchors_shanghai.json` has same id, compute residual metres.
4. Check `roads_gcj.geojson` exists and record source.

## Notes

- none

Honest residual: China offset model is not centimetre-grade; visual stack on Amap should be road-centre coincident at city scale. Do not claim sub-metre.

## Table

| id | name | wgs_lng | wgs_lat | gcj_lng | gcj_lat | d_lng | d_lat | residual_m | pair |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| lujiazui | 陆家嘴 | 121.4998 | 31.2397 | 121.504233 | 31.237686 | 0.004433 | -0.002014 | 0 | vs_anchor_gcj |
| peoples_square | 人民广场 | 121.4737 | 31.2304 | 121.478223 | 31.228458 | 0.004523 | -0.001942 | 0 | vs_anchor_gcj |
| hongqiao_hub | 虹桥枢纽 | 121.315 | 31.194 | 121.31951 | 31.192031 | 0.00451 | -0.001969 | 0 | vs_anchor_gcj |
| pudong_airport | 浦东机场 | 121.799 | 31.143 | 121.803304 | 31.1409 | 0.004304 | -0.0021 | 0 | vs_anchor_gcj |
| xujiahui | 徐家汇 | 121.436 | 31.188 | 121.440617 | 31.186119 | 0.004617 | -0.001881 | 0 | vs_anchor_gcj |
| jing_an_temple | 静安寺 | 121.4455 | 31.2235 | 121.450101 | 31.22162 | 0.004601 | -0.00188 | 0 | vs_anchor_gcj |
| wujiaochang | 五角场 | 121.514 | 31.298 | 121.518387 | 31.295968 | 0.004387 | -0.002032 | 0 | vs_anchor_gcj |
| zhangjiang | 张江 | 121.601 | 31.203 | 121.605199 | 31.200785 | 0.004199 | -0.002215 | 0 | vs_anchor_gcj |
| anting | 安亭 | 121.16 | 31.293 | 121.164553 | 31.29112 | 0.004553 | -0.00188 | 0 | vs_anchor_gcj |
| dishui_lake | 滴水湖 | 121.925 | 30.905 | 121.929085 | 30.902633 | 0.004085 | -0.002367 | 0 | vs_anchor_gcj |
| lingang_new_city | 临港主城 | 121.908 | 30.893 | 121.912078 | 30.890615 | 0.004078 | -0.002385 | 0 | vs_anchor_gcj |
| nanjing_east_road | 南京东路 | 121.484 | 31.236 | 121.488489 | 31.234031 | 0.004489 | -0.001969 | 0 | vs_anchor_gcj |
| zhongshan_park | 中山公园 | 121.417 | 31.22 | 121.421645 | 31.218155 | 0.004645 | -0.001845 | 0 | vs_anchor_gcj |
| century_park | 世纪公园 | 121.555 | 31.218 | 121.559255 | 31.215832 | 0.004255 | -0.002168 | 0 | vs_anchor_gcj |
| songjiang_university | 松江大学城 | 121.213 | 31.05 | 121.217434 | 31.047906 | 0.004434 | -0.002094 | 0 | vs_anchor_gcj |
| baoshan_steel | 宝山 | 121.487 | 31.403 | 121.491493 | 31.401084 | 0.004493 | -0.001916 | 0 | vs_anchor_gcj |
| waitan | 外滩 | 121.4905 | 31.2405 | 121.494966 | 31.238514 | 0.004466 | -0.001986 | — | self_offset_only |
| yangpu_bridge_s | 杨浦大桥南 | 121.54 | 31.255 | 121.544298 | 31.252881 | 0.004298 | -0.002119 | — | self_offset_only |
| minhang_dev | 闵行开发区 | 121.38 | 31.05 | 121.384624 | 31.048059 | 0.004624 | -0.001941 | — | self_offset_only |
| jinshan | 金山城区 | 121.34 | 30.74 | 121.344528 | 30.737822 | 0.004528 | -0.002178 | — | self_offset_only |
| chongming_s | 崇明南门附近 | 121.4 | 31.62 | 121.404686 | 31.618259 | 0.004686 | -0.001741 | — | self_offset_only |
| dianshan_lake | 淀山湖东 | 120.98 | 31.1 | 120.9843 | 31.097847 | 0.0043 | -0.002153 | — | self_offset_only |
