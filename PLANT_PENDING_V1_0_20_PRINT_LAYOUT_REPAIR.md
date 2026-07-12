# Plant Pending v1.0.20 – Print layout repair

Fixes based on the printed PDF review.

Problems observed:
- First printed page could be blank.
- Master plan split across two pages.
- Zone pages split awkwardly, especially when maps or plant image grids overflowed.
- Letter print mode still used too much 11x17-style spacing.
- Print button label was too verbose.

Changed:
- Print button now just says “Print.”
- Letter remains default.
- 11x17 remains available.
- Print pages now use true landscape page boxes with border-box sizing.
- Print shell is absolutely positioned during print to avoid the hidden app canvas creating a blank first page.
- Letter pages use tighter margins, padding, table rows, headers, zone cards, and stat cards.
- Zone photo cards are disabled on Letter to keep zone sheets from splitting. They still appear on 11x17.
- Zone mini maps are capped so skinny/wide zones do not overflow into the right column.
- Master plan legend count is reduced on Letter to keep the first page on one sheet.

Build check:
- npm run build passed.
