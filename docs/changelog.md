# Garden Planner Changelog

Detailed historical notes are stored in `docs/history/`.

## v84f

- Cleaned up root documentation files into `docs/history/`.
- Widened front/back edge click hit boxes.
- Tuned flower bed and grass drift visual density so 100% reads fuller.
- Changed grass drift placement to clumped drifts instead of evenly sprinkled plants.
- Kept hedge display width fixed so low-density hedge rows do not intentionally shrink plant symbols.


## v92 - Planting-type intelligence

- Tightened auto-pick/generator palette rules by planting type.
- Flower beds now prefer real flowering plants and avoid succulents, oleander, and rockrose-heavy shrub palettes.
- Pool planters now avoid toxic/messy/bee-attracting plants more strongly.
- Grass drifts now only use grass-like/strappy plants.
- Slope and rock garden palettes are more constrained to their intended plant styles.
- Added `database-v92` script, currently mapped to the v91 database pipeline.

## v94 - Research Classification Layer

- Added `scripts/classify-green-acres-research.mjs`.
- Added Green Acres-only research classification outputs for pool, slope, flower bed, hedge row, grass drift, rock garden, streetscape, native, wildlife, shade, and mixed borders.
- Added UC Master Gardeners Sacramento County WEL garden-number source signals.
- Added UC Davis Arboretum All-Star source signals.
- Updated generator to use the research role scores and behavior flags.
- Pool planter now prioritizes low-mess foliage, grasses, lomandra/sedges, clean shrubs, and foliage color; succulents/agaves are accents only.
- Slope planting now prioritizes groundcovers, spreading shrubs, grasses/sedges, manzanita/ceanothus/juniper/grevillea/rosemary/lantana/germander-style plants; sedum/stonecrop/succulents are accents only.
- Debug logs now include research role scores and behavior flags for generated palettes.
