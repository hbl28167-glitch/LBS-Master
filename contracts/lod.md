# LOD · scale bands (PRD 05.1 §3.7)

Principle: **structure first, detail later** (same as consumer maps). Avoid thousands of stores lit at once.

## `lodLevel` enum

| `lodLevel` | Zoom guide (Leaflet-ish) | Roads | Zones | Points (store/charger) |
|------------|--------------------------|-------|-------|-------------------------|
| `city` | ≲ 11 | motorway / trunk / primary (+ important secondary) | aggregated or large zones | **hide** dense points or strong cluster |
| `district` | ~12–13 | + secondary / tertiary | full zone detail | clustered points |
| `block` | ≳ 14 | + core residential / service | full | expand points; fences / ETA rings; **store focus** allowed |

Exact zoom cutovers are UI implementation detail; **band names above are the contract**.

## AppContext linkage

- UI sets `lodLevel` from map zoom (or user override).
- `storeFocusMode === true` bypasses dense multi-store rendering regardless of band (single store + coverage).
- Road layers still respect QC: if roads QC failed, show banner — do not claim road analysis.

## Heat vs LOD

| `heatRenderMode` | city | district | block |
|------------------|------|----------|-------|
| `poly` (default) | on | on | on |
| `grid` (200–300m, variable res) | optional / off by default | on if selected | on if selected |
| `kde` | optional | on if selected | on if selected |

Fine grid is **not** the old 1km citywide hero mesh.
