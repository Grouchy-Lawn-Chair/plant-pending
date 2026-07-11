# v102 release cleanup

This version is a UI cleanup pass for the release candidate.

## Changed

- Added visible app version number in the header: Garden Planner v102.
- Simplified plant search filters.
  - Removed the old WEL garden-type filter block from the main UI.
  - Kept the useful filters: Green Acres only, CA native, flowering, pollinator, hide messy, high waterwise, under 4 ft tall, under 6 ft wide.
  - Fixed Clear filters so the default Green Acres-only setting does not count as an active filter.
- Removed the old Planting goals checklist from Zone Settings.
  - Planting type, density, variety, layout mode, sun/water, and front/back edges are the main generator controls now.
- Removed two-letter initials from the label selector.
  - Label options are now Numbers, Off, and Callouts.
- Moved display style to a global canvas setting.
  - Display options are now Icon, Image, and Color circle.
  - The global display selector applies to all placed plants.
- Removed the per-plant Display style selector from the right sidebar.

## Kept

- Sun amount, afternoon sun, and waterwise priority because the generator still uses those settings.
- Planting type, layout mode, density, and variety because these are core generator controls.
- Front/back edges because flower beds, hedge rows, and layered layouts use them.
- Assigned planting group because custom plant groups still work, even if most testing uses auto-pick.
