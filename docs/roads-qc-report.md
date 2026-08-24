# Roads QC report · WS-B2

- generated: 2026-08-24T08:43:58.458Z
- label: **after**
- verdict: **PASS**
- features: 56578
- length_km: 16453.6
- tertiary(+link): 10239
- endpoints: 51690
- dangling_tips (deg=1): 1660
- components: 55
- largest_component_endpoint_ratio: 0.996 (min 0.85)
- anchor→road m: P50=87 P90=241.5 max=405.7

## Gates

- OK `tertiary_gt_0`
- OK `largest_ratio_ok`
- OK `anchor_p90_ok`
- OK `feature_gt_1000`

## Before / After

| metric | before | after |
|--------|-------:|------:|
| features | 34738 | 56578 |
| tertiary | 0 | 10239 |
| largest_ratio | 0.8804 | 0.996 |
| dangling_tips | 3381 | 1660 |
| components | 987 | 55 |
| anchor P90 m | 9019.1 | 241.5 |

## by_highway (count)

```json
{
  "tertiary": 10103,
  "primary": 13868,
  "primary_link": 874,
  "trunk_link": 1939,
  "trunk": 3614,
  "tertiary_link": 136,
  "secondary": 17621,
  "motorway": 4195,
  "motorway_link": 3810,
  "secondary_link": 418
}
```

## Notes

- Connectivity uses **endpoint graph** (way endpoints quantized); mid-vertex T-junctions without shared endpoints still look disconnected — snap helps tips only.
- Anchor distance is true geometry check (not GCJ self-compare).
- © OpenStreetMap contributors (ODbL).
