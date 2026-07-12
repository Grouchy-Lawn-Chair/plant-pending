# Plant Pending v1.0.25 – Print map layer fix

Problem:
- The print preview looked correct in the browser.
- When printing/saving to PDF, map layers drifted apart: background/zone geometry and plant symbols no longer lined up.

Cause:
- The print map used a scaled inner canvas with CSS transforms.
- Browser print/PDF rendering can handle transformed layers differently from normal screen rendering.

Changed:
- Rebuilt `PlanMap` print rendering to avoid the scaled inner transform.
- Background, zones, plants, and rocks now use direct page-frame coordinates.
- Zones render in an SVG using scaled coordinates.
- Plant/rock positions are calculated directly into the printed frame.
- This should keep all map layers aligned in actual print/PDF output.

Build check:
- npm run build passed.
