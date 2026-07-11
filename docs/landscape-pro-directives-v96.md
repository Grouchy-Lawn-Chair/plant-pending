# v96 Landscape Pro Directives

v96 extends the v95 pro planting logic to every planting area type and fixes rock gardens.

## What changed

- All planting types now expose community roles in debug output.
- Pool planter and slope planting keep the v95 community/drift logic.
- Flower bed now classifies generated plants as low/front, middle mass, tall/back, or support.
- Grass drift now classifies matrix grasses versus accent grasses and keeps clump-style placement.
- Hedge row now classifies hedge-main plants and keeps the one-primary-species row logic.
- Rock garden now generates actual rock objects inside the zone and places plants around them.

## Rock garden behavior

Rock garden zones now add 2 to 5 generated rocks depending on density and zone size. Rocks use the existing rock SVG set (`rock1.svg` through `rock6.svg`), random gray shades, 2-4 ft sizes, and normal rock selection/editing controls.

Rock garden plants are still intentionally sparse: low mats/groundcovers, architectural accents, and color accents. The rocks are the anchors; plants should tuck around them instead of filling the whole zone like a flower bed.
