# Plant Pending v1.0.14 – Plant card image overlay + example background restore fix

## What changed

### 1) Plant card layout tightened up
- Removed the separate name block below the image.
- Moved the plant name onto the image in a dark translucent overlay.
- Kept the category pill at the upper left.
- Increased image prominence so the card uses space better.
- Botanical name now appears in the image overlay when the card is selected.

### 2) Example plan background now survives refresh
- Added support for restoring the example plan background image on browser refresh.
- Includes backward-friendly fallback for older saved current example plans already in localStorage.
- Manual background changes now disable that auto-restore behavior so normal uploaded backgrounds do not automatically come back unless explicitly loaded.

## Files touched
- `src/components/PlantCard.tsx`
- `src/App.tsx`
- `src/types/plant.ts`

## Build check
- `npm run build` completed successfully.
