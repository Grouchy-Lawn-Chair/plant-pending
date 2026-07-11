# Plant Pending v114b - search + header polish

## Changed

- Removed the rounded tool-status pill from the upper-right header.
- Moved the Plant Pending commentary message into the main header row.
- Moved Shrub Score and title into the main header row.
- Removed the separate commentary/status row below the header.
- Debounced plant search input so filtering waits briefly instead of recalculating on every keystroke.
- Memoized plant filtering/sorting.
- Capped the initial plant list render to 120 cards with a Show more button.

## Why

Large saved plans with many placed objects plus a full 1,440-plant catalog made the browser do too much while typing. The app was filtering, logging, sorting, and rendering too many cards per keypress.
