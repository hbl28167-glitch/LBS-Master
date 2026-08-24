# Road display & congestion (PRD 05.1 §3.6)

## `roadDisplayMode`

| value | meaning |
|-------|---------|
| `cong` | **Default.** Whole-way congestion color (no direction split). |
| `grade` | Highway class / speed band (line width + class color). |
| `biz` | Business-difficulty tint (ride/fulfillment hardship from congestion rules). |

## Click → 路段分析

Selected road populates `selected_road_id` and right rail “路段分析”: name, class, congestion band, related zones, **business impact copy**.

## Runtime drivers (WS-C)

```text
time_of_day × weather/scenario × road_class_rules
  → per-way congestion class
  → congestion.difficulty_coeff + narrative
  → ride effective supply friction / fulfillment ETA risk
```

## Gate

Until roads QC passes (WS-B2), UI must show **「路网分析未达标」** and must not claim road analysis is ready.

## Related AppContext

- `roadDisplayMode`
- `selected_road_id`
- `congestion.share_blocked` | `difficulty_coeff` | `narrative`
