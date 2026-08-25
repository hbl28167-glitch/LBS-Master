# Road display & congestion (PRD 05.1 §3.6 · **05.2 §3.3**)

## `roadDisplayMode`

| value | meaning |
|-------|---------|
| `cong` | **Default.** Whole-way congestion color (no direction split). |
| `grade` | Highway class / speed band (line width + class color). |
| `biz` | Business-difficulty tint (ride/fulfillment hardship from same CI table). |

## Congestion class enum (4 bins · Must)

Whole-way **one** class from Synthetic CI (not live API):

| `cong_class` | Meaning (口述) | Typical CI guide (tunable) |
|--------------|----------------|----------------------------|
| `free` | 畅通 | low CI |
| `slow` | 缓行 | moderate |
| `cong` | 拥堵 | high |
| `severe` | 严重拥堵 | very high / anchor corridors at am peak |

```js
// per road feature (processed or runtime paint props)
{
  road_id: string,
  cong_class: "free" | "slow" | "cong" | "severe",
  ci_way: number,          // optional raw
  synthetic: true          // always declare
}
```

**Legend Must** show four bins + **Synthetic** attribution. Interview line: red = structural corridor stress under current `analysis_scene`, not “city uniformly broken”.

## Drivers (same table as accessibility)

```text
analysis_scene = (time_scenario, weather)
CI_way = city_CI[time] * weather_f * corridor_f(way, time)
v_way  = v0(highway) / CI_way
cong_class = bin(CI_way)
```

- **Early-peak anchors** (name whitelist): only strong under `wd_am_peak` (莘庄立交、南北高架、…).  
- **Anti solid-red:** class × corridor differentiation; night skews `free`/`slow`.  
- Business `congestion.difficulty_coeff` / `congestion_coeff` **must** share this table with `analysis_scene` (not a parallel ad-hoc switch).

## AppContext congestion display

```js
congestion: {
  share_blocked: null,       // share in cong|severe among visible ways
  difficulty_coeff: 1,     // == f(analysis_scene), for narrative/KPI
  city_ci: null,             // optional chip CI≈x
  narrative: null,
  synthetic: true
}
```

## Click → 路段分析

`selected_road_id` → right rail: name, highway class, `cong_class`, related zones, business impact copy.

## Gate

Until roads QC passes (WS-B2), UI shows **「路网分析未达标」** and must not claim road analysis or isochrones ready.

## Compliance

Runtime: **no** external live congestion API. Values are **Synthetic**; shape may reference public mobility patterns with attribution in UI footer.
