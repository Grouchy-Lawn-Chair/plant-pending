# v84b Flower Bed, Hedge Density, and Plant-Pool Fixes

## Purpose

v84b tightens the first v84/v84a planting-type generator behavior after field testing.

## Fixes

### Flower beds now prioritize flowers

Flower Bed mode now strongly prefers actual flowering plants instead of waterwise architectural plants.

The generator now boosts plants with flower signals such as:

- `flowers`
- medium/high pollinator value
- flower-related names such as lavender, salvia, yarrow, verbena, lantana, dianthus, penstemon, gaura, kangaroo paw, society garlic, etc.

Flower Bed mode now heavily reduces:

- agave
- mangave
- aloe
- yucca
- crassula
- echeveria
- haworthia
- sempervivum
- senecio
- stonecrop/sedum
- cactus
- grasses unless they have a strong flower-bed signal

### Flower beds are denser

Flower Bed density now maps to fuller planting:

- increased flower-bed density multiplier
- higher flower-bed fill cap
- tighter flower-bed spacing
- higher repeat tolerance for flower beds

### Hedge rows repeat properly

Hedge rows now bypass the normal repeat limit because a hedge is supposed to repeat the same plant.

This fixes cases where the generator wanted 7-8 hedge plants but only placed 2-3 because it rejected repeated plants.

### Hedge rows still use clipped display width

The v84a clipped hedge display width behavior remains.

Example:

- Mature width may be 5 ft
- Generated hedge display width may be about 2 ft

That keeps hedge rows readable as maintained/clipped hedges instead of giant mature shrub blobs.

## Files changed

- `src/App.tsx`
- `GREEN_ACRES_UPDATE.md`
- `GREEN_ACRES_V84B_FLOWER_HEDGE_DENSITY_FIXES.md`

## Validation

Ran:

```bash
npm run typecheck
npm run build
```

Both passed.
