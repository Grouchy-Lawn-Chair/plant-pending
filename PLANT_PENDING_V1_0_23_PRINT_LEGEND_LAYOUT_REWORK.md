# Plant Pending v1.0.23 – Print legend and footer layout rework

Changed:
- Moved the master-page plant legend to its own full print page.
- Master page now focuses on overall plan + zone summary.
- Full numbered plant legend uses the page width properly.
- Footer is now compact, standard-height, and anchored to the bottom of each page.
- Footer logo remains, but much smaller.
- Pages use flex layout so content and footer do not overlap.
- Keeps zone photo pages; content is moved to extra pages instead of dropped.

Build check:
- npm run build passed.
