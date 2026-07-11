# v95 Landscape Pro Planting Directives

Generated: 2026-07-11T15:17:30.209Z

This file is the app-facing design directive. It translates the research sources into rules the generator can use. The main correction is: planting types are not plant families. A pool planter is not a succulent bed, and a slope is not a sedum bed. Each area has a job, a site fit, a palette structure, and a placement style.

## Core rules

### rightPlantRightPlace
Match plants to the actual site first: sun, water, slope, drainage, soil, heat, mature size, and maintenance.

App use: Filter/rank candidates before layout. Do not use drought-tolerant as a synonym for cactus/succulent.

### hydrozones
Group plants with similar water needs and similar site conditions. Put lowest-water plants in longest sun and driest areas; higher-water plants in partial shade or runoff-collecting areas.

App use: Keep generated palettes within a narrow water band and avoid mixing high-water plants into low-water zones.

### plantCommunities
Design planting areas as small communities: repeated matrix plants, structural anchors, seasonal accents, and edge/filler plants.

App use: Generate fewer species than plant count. Repeat plants in drifts/clumps instead of selecting 20 unrelated species.

### matureSize
Place plants by mature size, not nursery container size. Use smaller or upright plants in narrow spaces; avoid plants that will outgrow the bed.

App use: Use mature width for spacing. In tight strips, prefer plants under the width limit or narrow/upright forms.

### layering
Use low plants at edges/fronts, medium matrix plants through the body, and taller shrubs/anchors to the back or corners.

App use: Honor marked front/back edges and use height roles during placement.

### rhythmAndUnity
Repeat plant forms and colors to create unity, rhythm, and a designed look. Avoid confetti-style random mixing.

App use: Use limited palettes, repeated drifts, and consistent forms rather than one of everything.

### permeableAndSoil
Favor permeable hardscape, mulch, living soil, rain capture, and organic/non-synthetic materials.

App use: Use rocks/paths/swales as optional plan elements and avoid overplanting where hardscape or maintenance access should remain.

## Planting areas

### slopePlanting
Purpose: Stabilize soil, slow winter runoff, tolerate Sacramento heat/clay, and look intentional year-round.

Should feel like: A repeated dry-slope community, not a succulent collection.

Palette target: 4-9 species, ideal 6.

Composition:
- matrixGroundcoverOrSpreadingShrub: 35% (dwarf coyote brush; prostrate ceanothus; creeping manzanita; California buckwheat; rosemary/germander style groundcovers)
- deepRootedGrassOrSedge: 25% (deergrass; blue grama; fescue; rush/sedge where appropriate)
- lowShrubOrNativeShrub: 25% (ceanothus; manzanita; coffeeberry; toyons/large shrubs only as anchors)
- seasonalFlowerAccent: 10% (California fuchsia; penstemon; yarrow; buckwheat)
- succulentOrRockAccent: 5% (sedum/dudleya only as accents)

Placement rules:
- Place larger shrubs uphill/back/corners as anchors, not in the middle of every open space.
- Mass groundcovers and spreading shrubs in overlapping drifts to knit soil.
- Cluster grasses in 3s, 5s, or small drifts, not evenly sprinkled one-by-one.
- Leave some maintenance access and rock/mulch negative space; full coverage means mature canopy, not filling every pixel with individual plants.

### poolPlanter
Purpose: Create a clean, low-mess, heat-reflection-tolerant planting by pool/concrete without litter, heavy bee traffic, or unsafe spines dominating.

Should feel like: Clean evergreen/everpresent foliage with color and structure, not a cactus/succulent bed.

Palette target: 3-7 species, ideal 5.

Composition:
- cleanEvergreenShrub: 30% (pittosporum; westringia; euonymus; teucrium/germander; dwarf olive style shrubs)
- grassOrStrappyFoliage: 30% (lomandra; carex/sedge; juncus/rush; phormium/flax; dianella/flax lily; astelia)
- colorFoliage: 20% (variegated, silver, blue, bronze, burgundy, purple, gold foliage plants)
- architecturalAccent: 15% (agave, yucca, aloe, hesperaloe, cordyline as limited accent)
- lowFlowerAccent: 5% (very limited low-litter flowers only when not bee-heavy near water)

Placement rules:
- Repeat 1–2 main foliage plants for rhythm; add a few accent plants, not a dozen species.
- Keep spiky plants away from walkways and pool traffic edges.
- Use front/back edges: lower plants at pool edge, taller plants against wall/fence/back edge.
- Favor foliage color over heavy flower drop for pool color.

### flowerBed
Purpose: Create intentional color using layered flower/perennial masses with repeat bloom and front/middle/back structure.

Should feel like: Layered flower/perennial bed with repeated drifts, not a shrub catalog dump.

Palette target: 5-10 species, ideal 7.

Composition:
- frontLowColor: 25%
- middleFlowerMatrix: 45%
- backTallFlowerOrShrub: 20%
- textureFoliageSupport: 10%

Placement rules:
- Use repeated drifts of 3–7 plants.
- Layer low/front, medium/middle, tall/back.
- Avoid one-of-everything randomness.

### grassDrift
Purpose: Create movement and texture using repeated grass-like clumps.

Should feel like: Massing of grasses/strappy plants in clumps, not isolated dots.

Palette target: 1-5 species, ideal 3.

Composition:
- mainGrassMatrix: 70%
- secondaryGrassTexture: 20%
- accentGrassOrStrappyColor: 10%

Placement rules:
- Use odd-number clumps.
- Repeat one species per clump.
- Vary clump size and spacing.

### hedgeRow
Purpose: Create a readable clipped or repeated screen/edge.

Should feel like: One repeated hedge plant, not a mixed shrub border.

Palette target: 1-2 species, ideal 1.

Composition:
- evergreenClippableShrub: 100%

Placement rules:
- Use even spacing along the marked edge/back.
- Repeat the same plant unless user intentionally chooses a mixed screen.

