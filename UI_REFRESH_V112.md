# Garden Planner v112 – card details + inspector cleanup

## Changes

- Plant card compact row is cleaner:
  - Removed active placement status bar.
  - Size is text-only.
  - Sun and water use icon + value with tooltip.
  - More details footer now shares space with price.
  - Waterwise now reads Waterwise / Not waterwise.
  - Maintenance now reads Low / Medium / High.
- Removed the top Hide library button.
- File menu closes when clicking outside it.
- Zone settings defaults to Site info first, then Generate, then Style & zone.
- Generate planting layout moved above Front / back edges.
- Added helpful hover titles to key zone-generation sections.
- Selected item panel only appears on the Zones inspector tab, so changing right rail tabs hides it.
- Plant details panel is cleaner:
  - Removed Top-down SVG symbol info box.
  - Removed duplicate image/source box.
  - Removed Green Acres catalog-match badge/title clutter.
  - Kept price and Green Acres page link in a compact box.
  - Notes moved to the bottom of the selected item controls.

## Validation

- npm run typecheck passed.
- npm run build passed.
