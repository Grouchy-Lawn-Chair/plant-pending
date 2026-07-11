# v.071 matched silhouette clumps

## What changed
- Clump silhouettes now match the exact normal icon file by using the same icon filename with `-s.svg` added.
- If a matching `-s.svg` does not exist for that exact icon, that plant stays in normal individual-symbol mode instead of switching to a mismatched clump shape.
- Clump footprint sizing now matches the same icon inset math used by the normal top-down symbols.
- Clump trigger now uses the normal visible symbol footprint, so switching to clump mode should better line up with when the icons visually touch.
- Slightly reduced clump fill opacity and outline growth to keep the clump closer to the single-symbol look.

## What to check
1. Place one clump-capable plant by itself and note the icon shape.
2. Place a second of the exact same plant until it touches.
3. Confirm the clump silhouette now matches the single icon’s outside shape better.
4. Confirm the color stays consistent.
5. Confirm plants whose exact icon does not have a `-s.svg` simply stay as individual symbols.
6. Check that clumping does not begin too early.


## v.072 – Clump opacity match
- Matched merged clump fill opacity to the same transparency used by individual plant symbols.
- Kept outline and number rendering unchanged so clumps feel like merged versions of the same plant, not darker/heavier new symbols.


## v.074 – Silhouette detection and clump trigger fix
- Removed the hardcoded silhouette filename allow-list so newly added `-s.svg` files work without code changes.
- Clump silhouettes now use the matching icon filename plus `-s.svg` for eligible families.
- Made the clump trigger a little more generous so visually touching compact plants clump reliably.
- Kept clumping limited to perennial, shrub/bush, and small flowering icons.


## v.075 - clump opacity fix
- Fixed the SVG filter order so the goo/merge filter no longer forces the clump fill back to 100% opaque.
- The clump fill opacity is now applied after the merge filter, matching the regular single-plant symbol transparency.
- Kept the outline fully readable.


## v.076 – real post-merge fill opacity
- Reworked the clump fill filter so the silhouettes merge first, then the plant color and opacity are applied after the merge.
- Removed the boosted clump opacity and now uses the raw plant opacity setting for merged clumps.
- Keeps the dark outline solid and keeps the centered number readable.


## v.077 – lighter clump fill
- Lowered clump fill opacity because flat silhouette fills read darker than the soft single-plant radial wash.
- Kept the merged outline solid and the number readable.
- No changes to clump trigger or silhouette matching.


## v.078 - outline ring fix
- Changed the clump outline from a filled black silhouette behind the plant color to a true outside-only ring.
- This prevents reduced-opacity fills from showing the black shape underneath and getting darker.
- Kept the current clump trigger and silhouette matching from v.077.


## v.079 – Clump fill saturation tune
- Increased clump fill opacity now that the black under-shape has been removed.
- Keeps the true outside-only outline ring from v.078.
- Goal: clumps should be richer than v.078, but not as solid/dark as v.076/v.077.

## v.080 – polish pass
- Added a display setting to turn same-plant clump merging on or off.
- Added clump strength options: Tight, Normal, Loose.
- Saved clump settings with the current plan, exported plans, and print view.
- Cleaned HTML entities in plant/catalog names so ® and ™ display correctly.
- Added price normalization for Green Acres prices that were accidentally displayed as cents-based dollar amounts, e.g. `$950.00-$10.50` becomes `$9.50-$10.50`.

## v82, Green Acres Design Scores

Added a derived design-score layer from the v81 Green Acres normalized data.

Run:

```bash
npm run database-v82
```

New outputs:

```text
public/green_acres_design_scores.json
public/green_acres_design_scores_report.csv
public/green_acres_design_score_summary.json
```

Scores include pool safety, messiness, evergreen value, waterwise value, slope usefulness, privacy usefulness, color interest, pet safety, and layout reliability. These are heuristic generator signals, not botanical guarantees.

## v83 Green Acres Score-Aware Generator

v83 connects the v82 design-score data to the existing zone generator without changing the UI.

Main changes:

- Plant records now load optional Green Acres design scores from `green_acres_design_scores.json`.
- Auto-pick is ranked by pool safety, messiness, evergreen, waterwise, slope, privacy, color, and layout reliability scores.
- The generator builds a smaller per-zone palette so generated plans use fewer random one-off plants.
- Fill spacing now uses median plant width instead of smallest plant width.
- Generated plant count is lower and spacing is stricter to reduce overlap warnings.
- Duplicate/repeat plants are limited unless the user intentionally supplies a planting group.
- Generator debug logs include `generatorPaletteIds`, `generatorPalette`, and `generatorScore` values.

Run:

```bash
npm run database-v83
npm run dev
```

## v83 Rock Scale Fix

Fixed rock rendering so 1 ft, 2 ft, 3 ft, and 4 ft rocks display at distinct sizes based on the calibrated plan scale. The previous 24px minimum made 1 ft and 2 ft rocks appear the same as 3 ft rocks on a scaled plan.


## v84 - Zone Planting Types and Front/Back Edges

- Added planting type field to zones.
- Added simple front/back edge roles.
- Added right-panel controls for edge roles.
- Added selected-zone edge click cycling on the canvas.
- Updated generator scoring, palette selection, density, and placement rules by planting type.
- Kept exclusion zones blocking plant placement.
- Added `npm run database-v84` alias for the existing database pipeline.


## v84a Generator Fixes

- Strengthened flower-bed front/back layering so low plants prefer Front edges and medium/tall plants prefer Back edges.
- Changed hedge-row generation from mixed fill to a clipped-row behavior.
- Hedge rows now repeat one hedge candidate along the marked Back edge, or the longest edge if no Back edge is marked.
- Added generated `displayWidthFt` for hedge-row plants so clipped hedges do not render at full mature shrub spread.
- Updated live canvas, warnings, debug snapshots, and print view to respect `displayWidthFt` when present.

## v84b - Flower Bed, Hedge Density, and Plant-Pool Fixes

- Flower Bed mode now strongly prioritizes actual flowering plants.
- Flower Bed mode now heavily reduces agaves, mangaves, succulents, grasses, and plain shrubs unless they have a strong flower-bed signal.
- Flower Bed mode now generates denser layouts at 50% and 100% density.
- Hedge Row mode now bypasses the normal repeated-plant limit so rows can fill properly.
- Hedge Row mode keeps the v84a clipped display width behavior.
- Added `GREEN_ACRES_V84B_FLOWER_HEDGE_DENSITY_FIXES.md`.

Validation:

```bash
npm run typecheck
npm run build
```

Both passed.

## v84c, Density + Flower Bed Layer Fixes

- Moved density slider into the generator panel near Generate.
- Flower Bed mode now uses stronger front/middle/back lanes when edges are marked.
- Flower Bed mode now generates denser-looking layouts.
- Flower Bed mode excludes succulent-pack style plants more reliably.
- Hedge Row density now changes spacing more clearly, so lower densities do not look like 100%.

## v84d – True density coverage

- Density now means coverage.
- Hedge row density covers a percentage of the selected back edge.
- Hedge row plants are evenly spaced across the full selected edge.
- Flower bed and grass drift density are based on available zone area coverage.
- Exclusion zone area is subtracted from available zone area for coverage math.
- Planting type controls plant mix and pattern, not what 50% means.
- Planting seed affects variation, not target coverage.

## v84e - Visual coverage calibration

- Adjusted generator density math so 100% looks visually fuller on the plan.
- Added visual coverage calibration for flower beds, grass drifts, mixed borders, slopes, groundcover fill, pool planters, and rock gardens.
- Kept hedge-row density as edge coverage.
- Tightened high-density flower-bed and grass-drift spacing.
- Added debug fields: `visualCoverageCalibration` and `effectivePlantAreaPx`.
