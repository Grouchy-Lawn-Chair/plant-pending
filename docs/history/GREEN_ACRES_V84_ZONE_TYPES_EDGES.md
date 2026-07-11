# v84 - Zone Planting Types and Simple Front/Back Edges

## Purpose

v84 teaches the zone generator that different beds should be planted differently. A flower bed, hedge row, grass drift, slope planting, pool planter, rock garden, and mixed border now get different palette and density behavior.

## New zone fields

- `plantingType`
  - `mixedBorder`
  - `flowerBed`
  - `hedgeRow`
  - `grassDrift`
  - `slopePlanting`
  - `poolPlanter`
  - `rockGarden`
- `edgeRoles`
  - `front: number[]`
  - `back: number[]`

Edges are zero-based internally. The UI labels them Edge 1, Edge 2, etc.

## Simple edge rules

- Front edge: lower and cleaner plants preferred. Tall plants are blocked near the front.
- Back edge: taller structure plants preferred. Low filler is discouraged near the back for flower beds, pool planters, and mixed borders.
- Unmarked edge: ignored by generator.
- If no front/back edge is marked, the generator behaves like a normal zone.

## UI changes

For a selected planting zone, the right panel now has:

- Planting type selector
- Front/back edge controls

On the map, when a zone is selected, its edges can also be clicked to cycle:

1. Unmarked
2. Front
3. Back
4. Unmarked

## Generator changes

The generator now changes plant choice and density by planting type:

- Flower bed: more layered, avoids oversized shrubs.
- Hedge row: fewer repeated shrubs, better for screen/row logic.
- Grass drift: favors grasses, sedges, lomandra, rushes, and similar plants.
- Slope planting: favors groundcovers, spreading plants, medium anchors, and grasses.
- Pool planter: favors low-mess, evergreen, architectural, and grass/strappy plants.
- Rock garden: favors succulents, low plants, architectural plants, and more open spacing.
- Mixed border: balanced default.

Exclusion zones continue to block plant placement.
