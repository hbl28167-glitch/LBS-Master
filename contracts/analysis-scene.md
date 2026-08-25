# analysis_scene (PRD 05.2 §3.2)

Global analysis context. **Exactly two dimensions** control road impedance, congestion color, isochrones, and business difficulty:

```js
analysis_scene = {
  time_scenario: "wd_pm_peak",  // one of 6
  weather: "clear"              // clear | rain | extreme
}
```

There is **one** global `analysis_scene` for the session. All packs (overview / energy / ride / …) read the same pair.

## time_scenario (6 bins · 平峰已合并)

| ID | Display (zh) | Day type | Clock windows (configurable) | Meaning |
|----|--------------|----------|------------------------------|---------|
| `wd_night` | 工作日 · 夜间 | Mon–Fri | 22:00–06:00 | Free-flow base; night ops |
| `wd_am_peak` | 工作日 · 早高峰 | Mon–Fri | **07:00–09:00** | Commute; **typical elevated/interchange anchors** |
| `wd_day_offpeak` | 工作日 · 平峰 | Mon–Fri | 09:00–17:00 (incl. midday) | Inter-peak baseline |
| `wd_pm_peak` | 工作日 · 晚高峰 | Mon–Fri | **17:00–19:30** | **Intraday pressure upper bound** |
| `we_day` | 周末/节假 · 日间 | Sat/Sun+holiday | 10:00–20:00 | Shifted/longer peaks; retail-tourism |
| `we_night` | 周末/节假 · 夜间 | same | 20:00–10:00 | Relatively free |

**Removed / not a separate chooser:** `wd_noon` (merged into `wd_day_offpeak`).

## weather

| ID | Display | Effect |
|----|---------|--------|
| `clear` | 晴/常规 | Baseline (`weather_f = 1.0`) |
| `rain` | 雨 | CI / impedance up (`~1.15`) |
| `extreme` | 极端 (Should) | Further up (`~1.35`) |

## AppContext placement

Preferred canonical fields (05.2):

```js
analysis_scene: { time_scenario, weather }
```

**Legacy aliases (compat, not second truth):**

| Legacy field | Maps to |
|--------------|---------|
| `time_of_day` | Prefer same string as `time_scenario` when it is one of the 6; else migrate |
| `weather` | Same as `analysis_scene.weather` (keep top-level mirror OK) |
| `scenario` `"A"`\|`"B"` | **Deprecated as analysis driver.** Optional UI shortcut only (e.g. B ⇒ rain); must not invent a third scene axis |
| `season_or_node` | Calendar/node label for metrics if needed; **not** a third analysis card |

Writers should set `analysis_scene` first; readers may fall back to `time_of_day` + `weather` until UI fully migrates.

## Camera / 镜头 (not analysis)

| Concept | Role |
|---------|------|
| `mapCamera` / flyTo presets (陆家嘴/虹桥/临港…) | **Map navigation only** — `flyTo` / setView |
| Forbidden | Treating lens labels as global narrative scene or third scenario card |

Changing camera **must not** change `analysis_scene`, road colors, or isochrones.

## city_CI seed (clear · Synthetic)

| time_scenario | city_CI |
|---------------|--------:|
| wd_night | 1.00 |
| wd_am_peak | 1.75 |
| wd_day_offpeak | 1.30 |
| wd_pm_peak | 1.95 |
| we_day | 1.45 |
| we_night | 1.05 |

All CI / speeds are **Synthetic** (shape informed by public mobility patterns; **no live traffic API**).
