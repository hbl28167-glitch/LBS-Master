# Zone color tokens (PRD 05.1 §3.3)

Fixed palette for product UI and demo alignment. Implement as CSS variables or map paint props; **do not invent ad-hoc fills** for the same `zone_type`.

| token | zone_type | grade (if any) | fill (hex guide) | notes |
|-------|-----------|----------------|------------------|--------|
| `zone.commercial.premium` | commercial | premium | `#6B3FA0` | 高端商圈 — deeper purple |
| `zone.commercial.mass` | commercial | mass | `#8E6BB8` | 大众商圈 |
| `zone.commercial.community` | commercial | community | `#B39DDB` | 社区配套 |
| `zone.industrial.default` | industrial | — | `#90CAF9` | 工业区浅蓝 |
| `zone.residential.high_density_mass` | residential | high_density_mass | `#F5F0E8` | 高密大众 — 米白 |
| `zone.residential.upgrade` | residential | upgrade | `#EFE8DC` | 改善型 — 暖灰白 |
| `zone.residential.premium_low_density` | residential | premium_low_density | `#E8E0D4` | 高档低密 — stroke/saturation for tier |
| `zone.office.default` | office | — | `#26A69A` | 办公/CBD/园区 — 青/蓝绿，区别工业浅蓝 |
| `zone.hub.default` | hub | — | `#FFC107` | 枢纽 — 黄/金 |
| `zone.tourism.default` | tourism | — | `#E07040` | 文旅 — 橙/棕 |
| `zone.open.default` | open | — | `#E8EDE6` | 农田/空旷 — 极淡绿灰 |
| `zone.mixed.default` | mixed | — | `#CFD8DC` | 混合 |
| `zone.other.default` | other | — | `#B0BEC5` | 其它 |

## Stroke / label

- Default stroke: slightly darker than fill, opacity ~0.85; residential tiers may rely more on stroke weight than fill hue.
- Heat overlay on zones: semi-transparent; **must not bury road casings** (Z-order: heat above zone fill, below selection).

## Mapping from legacy `grid.landuse` (migration aid only)

| grid.landuse | preferred zone_type |
|--------------|---------------------|
| retail | commercial |
| residential | residential |
| office | office |
| industrial_park | industrial |
| hub | hub |
| scenic | tourism |
| mixed | mixed |
| other | other |

`grid_id` algorithm is **unchanged** by this table. Product heat default is **zone poly**, not 1km grid.
