# Garden Planner v110 – filter cleanup and inspector rework

## Changed

- Removed Green Acres only and Missing Green Acres fields from the visible filters.
- Removed the old garden-type filter group from the UI because it was confusing and often produced empty results.
- Left only practical quick filters and a small size-filter section.
- Added a Photoshop-style inspector rail on the right side with icons for Zones, Groups, Legend, and Debug.
- Darkened the inspector panels, zone cards, group plant search overlay, and form controls.
- Reorganized Zone Settings into tabs:
  - Generate
  - Site info
  - Style & zone
- Kept click-outside-to-close and draggable Zone Settings behavior.
- Header updated to Garden Planner ver. 110.

## Validation

- npm run typecheck
- npm run build
