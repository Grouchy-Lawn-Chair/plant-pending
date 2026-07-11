# v94 Research Classification

This version adds a Green Acres-only research classification layer before the generator picks plants.

## New outputs

- `public/green_acres_research_classification.json`
- `public/green_acres_research_classification_report.csv`
- `public/green_acres_pool_candidates.csv`
- `public/green_acres_slope_candidates.csv`
- `public/green_acres_research_classification_summary.json`

## Source priorities

1. Green Acres normalized product data and design scores.
2. UC Master Gardeners Sacramento County WEL list and its seven garden numbers.
3. UC Davis Arboretum All-Star source signals.
4. Rule-based horticultural behavior signals from names, categories, Green Acres tags, mature size, water need, flowers, foliage color, and habit.

## What changed

Pool planter is no longer treated as a succulent/agave category. It is treated as:

- low mess
- evergreen/everpresent when possible
- clean foliage
- foliage color preferred over flower drop
- grass/lomandra/sedge/strappy plants
- clean shrubs
- architectural accents allowed, but not dominant

Slope planting is no longer treated as a sedum/stonecrop category. It is treated as:

- groundcovers
- spreading shrubs
- erosion-control shrub forms
- grasses/sedges/rushes
- manzanita, ceanothus, juniper, grevillea, rosemary, lantana, germander, California fuchsia, buckwheat, sages, and similar waterwise slope plants
- succulents allowed as accents only

## Debugging

Generator debug logs now include research role scores and behavior flags so bad picks can be traced to the exact classification logic.
