# v84c, Density + Flower Bed Layer Fixes

This patch tightens the v84 planting-type generator behavior after testing v84b.

## Why

User testing showed:

- Flower Bed mode was generating more plants at higher density, but it still did not look visually packed enough.
- Flower Bed front/back layering was too weak. Taller plants could still land too far forward.
- Hedge Row at 100% looked good, but lower densities looked nearly the same.
- The density slider was too far away from the Generate button.

## Changes

### Flower beds

- Increased Flower Bed target density.
- Increased Flower Bed maximum generated plant count.
- Added stronger front / middle / back lane generation when front/back edges are marked.
- Front lane now strongly prefers low plants.
- Middle lane now prefers medium plants.
- Back lane now prefers medium/tall plants.
- Flower Bed placement uses tighter spacing so beds read as fuller.
- Assorted succulent-style plants are no longer treated as valid flower-bed candidates just because they may have flower metadata.

### Hedge rows

- Hedge rows now use a real density-to-spacing curve.
- Low density produces wider spacing.
- High density produces a tight clipped hedge row.
- Repeat limits remain bypassed for hedge rows.

### UI

- Moved Plant density into the Planting Seed Generator panel, directly above the Generate button.

## Notes

- Layout mode still influences where the generator places plants: fill, edge, corner, or groundcover fill.
- Planting seed should only change random choices/positions. It should not change the density formula.
- Density is interpreted differently by planting type. A 50% hedge row and 50% flower bed are not intended to have the same number of plants.
