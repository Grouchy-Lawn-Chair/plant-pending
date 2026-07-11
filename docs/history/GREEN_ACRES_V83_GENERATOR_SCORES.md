# v83 Green Acres Score-Aware Generator

v83 keeps the UI unchanged and focuses on the zone generator engine.

## What changed

- Loads `public/green_acres_design_scores.json` into each plant record when available.
- Auto-pick now ranks plants using the v82 Green Acres design scores instead of mostly old category/waterwise logic.
- Generator now builds a smaller design palette for each zone instead of randomly picking from a huge candidate list.
- Plant selection is weighted by score, so better-fit plants are more likely to be selected.
- Fill spacing now uses a median plant width instead of the smallest plant width.
- Default generated plant count was reduced so small zones do not get overpacked.
- Mature-width spacing checks are stricter to reduce overlap warnings.
- Auto-pick limits repeated plants unless the user intentionally supplies a small planting group.
- Generator debug logs now include the selected palette and generator scores.

## Score inputs used

The generator can use these v82 fields when present:

- `poolSafeScore`
- `messinessScore`
- `evergreenScore`
- `waterwiseScore`
- `slopeScore`
- `privacyScore`
- `colorInterestScore`
- `petSafeScore`
- `layoutReliabilityScore`
- `bestUses`
- `flags`

## Zone behavior

The generator now looks at zone styles, zone name, and zone notes to infer intent.

Examples:

- Pool styles or names favor high `poolSafeScore`, low `messinessScore`, evergreen plants, and waterwise plants.
- Slope or groundcover intent favors `slopeScore`, groundcover traits, and lower spreading plants.
- Privacy intent favors `privacyScore`, evergreen shrubs, and plants with useful height.
- Modern or rock garden intent favors architectural plants, grasses, sedges, agaves, aloes, lomandra, and colorful foliage.
- Full sun and afternoon sun reward plants tagged as sun tolerant.
- Shade zones reward shade-compatible plants.

## Files changed

- `src/types/plant.ts`
- `src/utils/csvParser.ts`
- `src/App.tsx`
- `package.json`
- `GREEN_ACRES_V83_GENERATOR_SCORES.md`

## Commands

Run the app as usual:

```bash
npm install
npm run dev
```

Rebuild the Green Acres database files if needed:

```bash
npm run database-v83
```

`database-v83` currently runs the v81 normalization and v82 scoring pipeline. v83 itself uses those output files inside the app.

## Testing notes

The production build and TypeScript check passed.

```bash
npm run typecheck
npm run build
```
