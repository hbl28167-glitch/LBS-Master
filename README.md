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
7. `npm run build` — geo + synthetic + copy to `public/data/`. Optional: `npm run download:osm` first if no local raw. If processed already exists: `npm run copy:public-data`.
8. Serve UI: `npm run serve` (or `npx --yes serve public -p 4173`) → open http://localhost:4173  
9. Confirm no hard-coded machine paths; keys only in gitignored local files.
10. For Gaode tiles set `amapKey` in `config.local.js`; without it the shell uses a fallback basemap and shows a banner (does not crash).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm test` | Run tests (portable paths, later unit tests) |
| `npm run verify:paths` | Scan `scripts/` + `public/` for absolute drive paths |
| `npm run build` / `build:geo` | WS-B/C pipeline → `data/processed/*` + `public/data/*` |
| `npm run copy:public-data` | Copy processed/static JSON into `public/data/` for the UI |
| `npm run serve` | Static server on `public/` (port 4173) |
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
