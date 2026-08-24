# LBS-Master

Portable **LBS business map console** (Shanghai domain).  
Static shell + Node build pipeline. Synthetic ops metrics on spatial fabric: **OSM→GCJ roads (analyzable)**, **typed zones**, water, entities.

**Not:** consumer navigation, live traffic API, or a single-industry BI.  
**Is:** map-first mid-platform sample — *road narrative + zone heat + multi-scene packs* for the Agent era.

**Requirements:** Node.js **18+**

**Acceptance truth:** PRD **05.1** (map UX / spatial system).  
**Informal only:** `Byteda/P1/demo/*.html` — layout/story preview, **not** this repo’s product data or QC’d roads. Do not demo those HTML files as LBS-Master.

---

## Architecture (three layers)

```text
┌─────────────────────────────────────────────────────────┐
│ Business packs (top nav · all clickable)                  │
│  Overview · O2O · Ride · Fulfillment · Energy · Gov       │
│  Siting = action inside Energy (not its own top tab)      │
└──────────────────────────┬──────────────────────────────┘
                           │ capability calls only
┌──────────────────────────▼──────────────────────────────┐
│ Capability mid-layer                                      │
│  zone gap · road line analysis · heat modes · S5 · quality│
└──────────────────────────┬──────────────────────────────┘
┌──────────────────────────▼──────────────────────────────┐
│ Data foundation                                           │
│  roads_gcj · zones · water · entities · coeffs · manifest │
│  Adapter: demo (小李* synthetic)                          │
└─────────────────────────────────────────────────────────┘
```

Frozen field names live under `contracts/`. UI reads only `public/data/*` (copied from `data/processed` + `data/static`).

---

## Quick start (another machine)

1. Clone or copy this repo to **any** directory (no fixed drive/username).
2. `cd` into the repo root.
3. `npm install` (optional until runtime deps are added; scaffold has none beyond Node).
4. Optional BYO Gaode: copy `.env.example` → `.env` / `config.local.example.js` → `config.local.js` (**never commit** real keys). Basemap defaults to Gaode GCJ tiles; fallback only if tiles fail.
5. `npm test` — must pass (portable path scan).
6. Data for UI:
   - If `data/processed/*` exists: `npm run copy:public-data`
   - Full pipeline: `npm run build` (roads QC, zones, synthetic, copy)  
     Optional: `npm run download:osm` / `download:osm:core` (gitignored raw).
7. `npm run serve` **or** double-click `start-demo.bat` → **http://127.0.0.1:4173/** → **Ctrl+F5**  
   Do **not** open `index.html` via `file://`.
8. Source under `scripts/` / `public/` uses relative paths only.

**UI (PRD 05.1):** map-first — basemap + **water** + **roads default on** (cong/grade/biz) + **typed zones** + **poly heat**. Six tabs clickable. **No 1km grid hero.**

---

## Demo main path (Must · ~3–5 min · PRD 05.1)

Full talk track: [`docs/demo-script.md`](docs/demo-script.md)  
Checklists: `docs/acceptance-main-path.md` · `docs/acceptance-side-path.md`

| Step | UI action |
|------|-----------|
| 1 | **总览** first paint: 路网 + 区面类型色 + 面热力 + 黄浦江（认地图感） |
| 2 | 路网模式 拥堵/等级/难度 → **点过江路段** → 右侧「路段分析」；或点 **叙事·晚高峰过江** |
| 3 | 情景 **B · 雨**（或 **叙事·雨天出行**）→ 路更堵 + 叙事条难度系数升 |
| 4 | **出行** → zone demand×supply÷difficulty · TopN · 只读公式 |
| 5 | **履约** 时效圈随雨缩小，或 **到店** 点店 → 单店聚焦覆盖圈 |
| 6 | **导出 snapshot** → context + rows JSON |

**Not the product:** Byteda `P1/demo/` HTML mockups.

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm test` | Portable paths + GCJ unit tests |
| `npm run verify:paths` | Scan `scripts/` + `public/` for absolute drive paths |
| `npm run build` / `build:geo` | WS-B/C pipeline → `data/processed/*` + copy to `public/data/` |
| `npm run copy:public-data` | Copy processed/static JSON into `public/data/` for the UI |
| `npm run serve` | Static server on `public/` (port 4173) |
| `npm run build:synthetic` | metrics_ride/chg + 小李 chargers only |
| `npm run verify:synthetic` | Gate C: cover + rain gap + brand ban-list |
| `npm run download:osm` | Tiled Overpass → `data/raw/osm/` (**gitignored**) |
| `npm run verify:alignment` | Rewrite `docs/alignment-sample.md` |

---

## Config

| File | Tracked? | Role |
|------|----------|------|
| `.env.example` | yes | Template: `AMAP_KEY=` |
| `.env` | **no** | Local secrets |
| `public/config.local.example.js` | yes | Template: `amapKey: ""` |
| `public/config.local.js` | **no** | Browser basemap key |
| `data/static/*` | yes | Calendar, weather coeffs, corridor copy, anchors |
| `data/processed/*` | partial | Build outputs (see volume policy) |
| `data/raw/**` | **no** | Giant OSM extracts |
| `public/data/**` | **no** | Runtime copy of data for static server |

---

## Layout

- `contracts/` — AppContext (+05.1 road/heat/LOD/storeFocus), zone + color tokens, grid, scene-gap, payload（见 `contracts/README.md`）
- `scripts/` — Node build pipeline (paths via `scripts/lib/paths.js` → repo root only)
- `data/raw/` — raw OSM (gitignored)
- `data/static/` — anchors, calendar, weather, corridor copy
- `data/processed/` — build outputs
- `public/` — static front-end + local Leaflet vendor
- `tests/` — automated checks
- `docs/` — HANDOFF, demo script, acceptance, portability

---

## Data, licensing & attribution

- **OSM / ODbL:** Road network from OpenStreetMap. Attribute **© OpenStreetMap contributors**. Comply with [ODbL](https://www.openstreetmap.org/copyright) when redistributing derived databases. Raw Overpass extracts stay **out of git** by default (`data/raw/**`); see `docs/osm-download.md`.
- **Amap (Gaode):** Basemap tiles (GCJ). **BYO** open-platform key if you use key-gated APIs; store only in gitignored `.env` / `config.local.js`. **No real key in git.** Demo shell may use public raster TMS without committing secrets.
- **Business metrics:** Synthetic (`synthetic: true` in manifest). Brand placeholder: **小李***. No employer site names in delivery.
- **Leaflet:** Local vendor copy under `public/vendor/leaflet` (BSD-2-Clause).

---

## Volume policy (GitHub-friendly)

| Class | Policy |
|-------|--------|
| Source + contracts + static JSON | In git (small) |
| `public/vendor/leaflet` | In git (offline demo) |
| `data/processed` grids/metrics/roads | May be committed for clone-and-serve demos if total stays modest; prefer rebuild via `npm run build` when cutting size |
| `public/data/**` | **gitignore** — always `copy:public-data` or `build` after clone |
| `data/raw/osm/**` | **gitignore** — download locally; do not PR multi‑hundred‑MB dumps |
| Target | Main tree comfortable **&lt; ~200MB**; oversized artifacts → GitHub Releases or rebuild-from-script |

Typical order of magnitude after local build (informal): processed roads/grids/metrics tens of MB combined; raw OSM larger and local-only.

Portability record: [`docs/portability-check.md`](docs/portability-check.md).

---

## Compliance

- Relative paths only in source under `scripts/` and `public/` (`npm run verify:paths`).
- No API keys in git.
- No non-public employer site rosters; synthetic brand **小李*** only.
- Demo script must not claim live A/B experiments or commercial navigation.

---

## Docs map

| Doc | What |
|-----|------|
| `docs/demo-script.md` | 3–5 min talk track |
| `docs/acceptance-main-path.md` | Gate D checklist |
| `docs/acceptance-side-path.md` | Gate E checklist |
| `docs/portability-check.md` | Swap-machine / swap-dir proof |
| `docs/HANDOFF-WS-*.md` | Per-workstream handoffs |
| `contracts/README.md` | Contract index + 05.1 delta |
| `docs/osm-download.md` | Overpass download notes |
| `docs/synthetic-rules.md` | Synthetic metric rules |
| `docs/alignment-sample.md` | Road/basemap sample notes |
| Byteda `P1/05.1-…` | Map UX acceptance (external spec) |
| Byteda `P1/demo/` | Informal layout preview only |

---

## Suggested GitHub blurb

> Shanghai LBS **business map console** (PRD 05.1): analyzable OSM→GCJ roads, typed zones, water, zone heat, road-segment narrative, ride + fulfillment + O2O focus. Synthetic 小李* metrics. Static UI, clone-anywhere. BYO Gaode config. Not a nav app / not live traffic.
