# LBS-Master

Portable LBS mid-platform sandbox (Shanghai domain). Static map shell + Node build pipeline.

**Requirements:** Node.js **18+**

## Quick start (another machine)

1. Clone or copy this repo to any directory.
2. `cd` into the repo root (path can be anything; no fixed username/drive required).
3. `npm install` (optional until dependencies are added; scaffold has none).
4. Copy `.env.example` → `.env` and set `AMAP_KEY=` (Amap/Gaode open platform key; self-provided).
5. Copy `public/config.local.example.js` → `public/config.local.js` and set `amapKey`.
6. `npm test` — must pass (includes portable path check).
7. `npm run build` — geo + synthetic (anchors → grids → landuse → roads → alignment → metrics → verify → manifest). Optional: `npm run download:osm` first if no local raw.
8. Open `public/index.html` via a static server, or serve `public/` (e.g. `npx --yes serve public`).
9. Confirm no hard-coded machine paths; keys only in gitignored local files.
10. For map tiles you need a valid Amap key; without it the shell should degrade, not crash.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm test` | Run tests (portable paths, later unit tests) |
| `npm run verify:paths` | Scan `scripts/` + `public/` for absolute drive paths |
| `npm run build` / `build:geo` | WS-B geo + WS-C synthetic → `data/processed/*` |
| `npm run build:synthetic` | metrics_ride/chg + 小李 chargers only |
| `npm run verify:synthetic` | Gate C: cover + rain gap + brand check |
| `npm run download:osm` | Tiled Overpass → `data/raw/osm/` (gitignored) |
| `npm run verify:alignment` | Rewrite `docs/alignment-sample.md` |

## Layout

- `contracts/` — AppContext, grid, scene-gap, payload schemas (frozen field names)
- `scripts/` — Node build pipeline (roads, grids, synthetic, …)
- `data/raw/` — raw OSM etc. (gitignored; download locally)
- `data/static/` — anchors, calendar, weather coefficients
- `data/processed/` — build outputs consumed by the UI
- `public/` — static front-end
- `tests/` — automated checks
- `docs/` — HANDOFF and demo notes

## Data & licensing (placeholders)

- **OSM / ODbL:** Road network from OpenStreetMap. Attribute **© OpenStreetMap contributors**. Raw extracts stay out of the main repo by default; see download notes in later docs.
- **Amap (Gaode) Key:** Required for official basemap tiles. Obtain from the Amap open platform; store only in `.env` / `config.local.js` (never commit real keys).
- **Business metrics:** Synthetic (`synthetic: true` in manifest). Brand placeholder: 小李*. No employer site names in delivery.

## Compliance

- Relative paths only in source under `scripts/` and `public/`.
- No API keys in git.
- No non-public employer site rosters.
