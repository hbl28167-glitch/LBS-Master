# LBS-Master

Portable **LBS business map console** (Shanghai domain).  
Static shell + Node build pipeline. Synthetic ops metrics on spatial fabric: **OSM→GCJ roads (analyzable)**, **typed zones**, water, entities.

**Not:** consumer navigation, live traffic API, or a single-industry BI.  
**Is:** map-first mid-platform sample — *two-card analysis_scene · structural road CI · site service rings* for the Agent era.

**Requirements:** Node.js **18+**

**Acceptance truth:** PRD **05.2** (scenario cards, road CI, energy board + isochrones). Map shell history: 05.1.  
**Informal only:** `Byteda/P1/demo/*.html` — layout preview, **not** this product. Do not demo those HTML files as LBS-Master.

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
│  analysis_scene · road CI · E.fromPoint rings · S5 · gap  │
└──────────────────────────┬──────────────────────────────┘
┌──────────────────────────▼──────────────────────────────┐
│ Data foundation                                           │
│  roads_gcj · zones · scenario_ci · sites+power · manifest │
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

**UI (PRD 05.2):** two cards **时间×天气** → `analysis_scene` only; structural **road CI** (not flat red); **road-aligned zones**; overview **24h CI trend**; **Energy** = site KPI board + 5/10/15 rings. **No 1km grid hero.** Lenses = flyTo only.

---

## Demo main path (Must · ~3–5 min · PRD 05.2)

Full talk track: [`docs/demo-script.md`](docs/demo-script.md)  
Checklists: `docs/acceptance-main-path.md` (旅程 A) · `docs/acceptance-side-path.md` (旅程 B)

| Step | UI action |
|------|-----------|
| 1 | **两卡** `#sel-time` × `#sel-weather` 定 scene；读 scene 芯片（镜头钮不改 scene） |
| 2 | 总览：早高峰·晴 → **廊道结构红** + 四档图例；区面贴路（非椭圆泡） |
| 3 | 右栏 **24h 趋势** 一句（双峰 + 当前档竖线）；可切晚峰/雨看 CI 上界 |
| 4 | **能源**：KPI 条 → 站列表点 **site** → 功率详情 → **5/10/15 圈** + 覆盖表 |
| 5 | **平峰晴 vs 晚峰雨 Δ** → 规则决策句 |
| 6 | **导出 snapshot**（scene + site + bands + Δ） |

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
| `contracts/README.md` | Contract index + 05.1/05.2 delta |
| `docs/osm-download.md` | Overpass download notes |
| `docs/synthetic-rules.md` | Synthetic metric rules |
| `docs/alignment-sample.md` | Road/basemap sample notes |
| Byteda `P1/05.1-…` | Map UX acceptance (external spec) |
| Byteda `P1/05.2-…` | analysis_scene / accessibility / energy site (external spec) |
| Byteda `P1/demo/` | Informal layout preview only |

---

## Suggested GitHub blurb

> Shanghai LBS **business map console** (PRD 05.2): two-card analysis_scene, structural road CI, road-aligned zones, 24h trend, energy site board + 5/10/15 service rings. OSM→GCJ, Synthetic 小李*. Clone-anywhere. BYO Gaode. Not nav / not live traffic API.
