# LBS-Master

Portable **LBS mid-platform sandbox** (Shanghai domain).  
Static map shell + Node build pipeline. Synthetic business metrics on real-ish spatial fabric (OSM roads → GCJ, grids, anchors).

**Not:** consumer navigation, commercial traffic, or a single-industry BI.  
**Is:** a demo-ready sample of *spatial objects + regional policy + multi-scene orchestration* for the Agent era.

**Requirements:** Node.js **18+**

**体验验收以 PRD 05.1（地图体验与空间体系）为准**；`Byteda\P1\demo\` 下 UI 仅为布局/叙事示意，**非正式**数据与交付。

---

## Architecture (three layers)

```text
┌─────────────────────────────────────────────────────────┐
│ Business packs (top nav)                                  │
│  Overview · Ride · Energy · Governance · (stubs…)         │
│  Siting = action inside Energy (not its own top tab)      │
└──────────────────────────┬──────────────────────────────┘
                           │ capability calls only
┌──────────────────────────▼──────────────────────────────┐
│ Capability mid-layer                                      │
│  grid · scene gap · road overlay · S5 siting · quality    │
└──────────────────────────┬──────────────────────────────┘
┌──────────────────────────▼──────────────────────────────┐
│ Data foundation                                           │
│  roads/grids/entities · calendar/weather · manifest       │
│  Adapter: demo (小李* synthetic)                          │
└─────────────────────────────────────────────────────────┘
```

Frozen field names live under `contracts/`. UI reads only `public/data/*` (copied from `data/processed` + `data/static`).

---

## Quick start (another machine)

1. Clone or copy this repo to **any** directory (no fixed drive/username).
2. `cd` into the repo root.
3. `npm install` (optional until runtime deps are added; scaffold has none beyond Node).
4. Copy `.env.example` → `.env` and set `AMAP_KEY=` (**self-provided** Amap/Gaode key; never commit).
5. Copy `public/config.local.example.js` → `public/config.local.js` and set `amapKey`.
6. `npm test` — must pass (includes portable path scan).
7. Data for UI:
   - If you already have `data/processed/*`: `npm run copy:public-data`
   - Full pipeline: `npm run build`  
     Optional first: `npm run download:osm` (writes gitignored raw OSM).
8. `npm run serve` → http://localhost:4173  
9. No hard-coded machine paths in `scripts/` / `public/`. Keys only in gitignored local files.
10. Without `amapKey`, shell uses a fallback basemap + banner (does not crash). GCJ roads may look slightly offset vs WGS tiles — expected.

---

## Demo main path (Must · ~3–5 min)

Full talk track: [`docs/demo-script.md`](docs/demo-script.md)

| Step | UI |
|------|-----|
| 1 | Open Overview — grid + ride_gap |
| 2 | Enter **出行** — inherit region/time/selection |
| 3 | demand + supply + gap on together |
| 4 | TopN list + read-only formula |
| 5 | Scenario **B · rain** — gap worsens via coefficients (not a live A/B experiment) |
| 6 | Toggle **路网** — corridor / 临港 copy in side panel |
| 7 | **导出 snapshot** — JSON download |

**Should (WS-E):** 能源网络 → 小李充电 + chg gap → **发起选址** (S5 scores) → 数据治理 (quality colors; no terminal-GPS claims).

Acceptance checklists: `docs/acceptance-main-path.md`, `docs/acceptance-side-path.md`.

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
- **Amap (Gaode) Key:** Required for official basemap tiles. Obtain from the Amap open platform; store only in `.env` / `config.local.js`. **Bring your own key** — none ships in the repo.
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

> Shanghai-domain LBS mid-platform sandbox: unified grids & scene-gap contracts, deep ride demand×supply path, light energy siting & governance. OSM→GCJ roads, synthetic 小李* metrics, static UI, clone-anywhere. BYO Amap key. Not a nav app.
