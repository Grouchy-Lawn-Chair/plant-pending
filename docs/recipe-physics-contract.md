# Recipe Physics Behavior Contract

Status: authoritative implementation contract for the Recipe Grid Lab and production recipe generator.

This document exists to prevent the recipe engine from drifting back into simple random placement or fixed-count scattering.

## Core mental model

The planting zone is a container. Plants are physical bodies placed into that container like marbles in a jar.

The engine must:

1. Add plant bodies using the recipe mix.
2. Let physics settle them inside the zone.
3. Apply plant-specific forces while they settle.
4. Prune bodies that cannot remain valid inside the zone.
5. Detect meaningful open space.
6. Add more bodies into those gaps.
7. Repeat until the requested fullness target is reached or the engine proves that no valid placement remains.

The engine must not treat fullness as an arbitrary fixed plant count.

## Required generation loop

The production loop is:

`fill -> settle -> prune -> refill -> settle -> validate`

### Fill

- Add plants incrementally according to the recipe percentages or explicit per-plant counts.
- Fullness is driven by measured occupied area in the zone, not by a hard-coded formula such as `10 + density * 30`.
- The engine may estimate a starting batch, but it must continue adding plants until the measured target is reached.
- New-seed generation must preserve the same species counts and plant sizes unless the user changes a control.

### Settle

- Matter.js bodies must collide using the same effective dimensions used by the renderer and overlap checker.
- Bodies may overlap only within the configured allowance.
- The seed changes the arrangement, not the identity, color, icon, size, or count of each species.

### Prune

- Remove placements whose centers fall outside the zone.
- When required by the recipe, also reject plants whose required physical body cannot fit inside the zone.
- Pruning must be recorded in diagnostics by plant and by reason.
- Pruned plants do not silently disappear from the requested total; the engine must attempt to refill the vacancy.

### Refill

- Search for the largest valid open gaps.
- Add the next plants required by the recipe mix into those gaps.
- Continue until the target fullness is reached or no valid insertion remains after the configured retry limit.
- The final debug record must report the real requested target, placed total, rejected total, measured coverage, and shortfall.

## Fullness contract

Fullness is mature visual coverage of the planting zone.

Suggested interpretation:

- 25%: airy
- 50%: moderate
- 75%: mostly filled
- 100%: dense mature planting

100% does not require mathematically perfect coverage. It should target approximately 85-90% visible mature coverage while retaining the recipe's intended spacing and readable plant groups.

The slider must not merely multiply plant count. It must use:

- zone area
- each plant's physical/display diameter
- allowed overlap
- plant-specific spacing
- grouping/drift behavior
- edge/layer constraints
- open-space measurements after settling

A run at 100% that reports substantially lower measured coverage is not complete and must continue the refill loop.

## Plant-specific spacing

Each recipe plant needs a spacing control independent of drift size.

Required values:

- `tight`
- `natural`
- `loose`

Spacing controls the preferred gap between neighboring plants after accounting for mature diameter.

Conceptual behavior:

- Tight: near-touching or slight permitted overlap
- Natural: normal mature spacing
- Loose: visible breathing room

The exact numeric multipliers may be tuned, but they must be centralized and tested.

## Drift and clump behavior

Each plant also needs a grouping mode:

- `individual`
- `small-drift`
- `medium-drift`
- `large-drift`
- `continuous-mass`

Suggested initial ranges:

- Small drift: 3-5 plants
- Medium drift: 6-10 plants
- Large drift: 11-18 plants
- Continuous mass: as many as needed to create one connected planting mass

These are starting ranges, not rigid counts. They may scale with zone size and available plant count.

### Drift centers

- Plants in a drift share a drift center.
- The drift center is created before individual plant placement.
- Same-species plants are attracted toward their assigned drift center.
- Multiple drift centers must be separated so the result reads as distinct groups rather than one pile.

### Random space between groups

The engine must support random but controlled space between drift groups.

This is not random spacing between every individual plant. It is randomized separation between group envelopes.

Each plant or recipe can define a group-gap range, for example:

- Small gap: 0.25-0.75 mature plant diameters
- Medium gap: 0.75-1.5 mature plant diameters
- Large gap: 1.5-2.5 mature plant diameters

For each drift pair, the engine samples a deterministic value from the selected range using the generation seed. This creates natural variation without making groups collapse together or spread unpredictably.

The same seed must reproduce the same group-gap values.

## Attraction and gravity

Attraction is a force layered on top of the jar-fill process. It does not replace filling.

### Back attraction

- Hedge and screening plants use strong attraction to selected back edges.
- The target is a band measured inward from the edge by the plant radius plus padding.
- Hedge rows should distribute plants along the edge, not collapse at the midpoint.
- A hedge may form one or more rows depending on fullness and available depth.
- Back attraction must be stronger than generic centering or open-space forces.

### Front attraction

- Low edging and foreground plants use attraction to selected front edges.
- Front plants may form ribbons or shallow drifts rather than a single perfect line.

### Middle layer

- Middle-layer plants occupy the band between front and back systems.
- They should not routinely touch either edge unless the recipe explicitly allows it.

### Accent plants

- Accent plants should remain individually readable.
- They may use minimum separation from same-species and other accent plants.

## Hedge behavior

A hedge is a special repeated structure, not a generic clump.

Required behavior:

- equal or near-equal spacing along selected back edges
- strong back-edge attraction
- centerline offset based on mature radius and trim allowance
- optional second row only when the recipe or fullness requires it
- no random species swapping
- no collapse into one central pile

## Size, identity, and visual stability

For a given recipe and unchanged controls:

- plant counts remain stable across seeds
- plant display width remains stable across seeds
- plant color remains stable by `plantId`
- plant icon family and icon choice remain stable by plant identity
- only positions, drift-center locations, and permitted rotation vary

## Overlap consistency

The following systems must use the same effective plant body dimensions:

- Matter.js collisions
- final overlap diagnostics
- app warnings
- debug snapshots
- rendered plant circles/symbol scale

The engine must not report zero unresolved overlaps while the final plan reports many overlap warnings.

## Debug contract

Every generation must capture:

- run ID and seed
- recipe and source
- complete zone polygon
- selected front/back edges
- all global controls
- all per-plant controls
- requested fullness target
- measured coverage after every fill/refill cycle
- exact counts requested and placed by plant
- drift assignments and drift centers
- sampled random group-gap values
- attraction strengths and target bands
- all rejected/pruned plants with reasons
- final placements and radii
- unresolved overlaps using production collision rules
- visual snapshot of the generated zone

Required event sequence:

- `recipe.generation.started`
- one or more `recipe.generation.cycle`
- `recipe.generation.completed` or `recipe.generation.failed`

## Non-negotiable acceptance tests

1. At 100% fullness, measured final coverage reaches the configured dense target unless the engine reports a genuine geometric shortfall.
2. Different seeds preserve species counts, sizes, colors, and icons.
3. Different seeds produce visibly different arrangements.
4. A small, medium, and large drift produce measurably different group sizes.
5. Random group spacing is deterministic for the same seed and varies across different seeds.
6. Hedge plants remain in a back-edge band and distribute along the selected edge.
7. Front plants remain in a front-edge band.
8. Pruned bodies are refilled when valid open space remains.
9. Physics overlap counts match final app overlap warnings.
10. Debug exports include every generation cycle and canvas snapshot.

## Implementation warning signs

The implementation has drifted away from this contract if any of these are true:

- fullness is converted directly into one fixed plant count
- the engine creates one batch and stops without refilling gaps
- `capacity` silently replaces the user's requested target
- rejected plants disappear without refill attempts
- clump strength only increases overlap instead of creating distinct drifts
- all plants target the center of the zone
- hedge plants use the same placement behavior as scattered perennials
- new seed changes colors, icons, widths, or species counts
- 100% fullness produces a visibly half-empty zone

Any future physics change must update this document and the associated tests in the same pull request.
