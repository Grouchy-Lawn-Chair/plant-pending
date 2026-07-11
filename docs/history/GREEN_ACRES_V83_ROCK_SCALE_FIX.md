# v83 Rock Scale Fix

Bug fix for rock rendering scale.

## Problem

Rock records were correctly saving `rockSizeFt` as 1, 2, 3, or 4, but the canvas renderer clamped all rocks to a 24px minimum size.

When the plan scale was around 7.5 pixels per foot, this meant:

- 1 ft rock = 7.5px, clamped to 24px
- 2 ft rock = 15px, clamped to 24px
- 3 ft rock = 22.5px, clamped to 24px
- 4 ft rock = 30px, displayed larger

So 1 ft, 2 ft, and 3 ft rocks appeared visually the same.

## Fix

Changed the rock renderer to respect the calibrated feet-to-pixels scale and only use a small 8px emergency minimum.

Now, at a 7.5 px/ft scale:

- 1 ft rock renders around 8px
- 2 ft rock renders around 15px
- 3 ft rock renders around 22.5px
- 4 ft rock renders around 30px

## Files changed

- `src/components/GardenCanvas.tsx`
