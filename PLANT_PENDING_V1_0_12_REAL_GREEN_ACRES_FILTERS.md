# Plant Pending v1.0.12 Real Green Acres filters

Adds a real Green Acres filter index and filter panel based on the captured Green Acres HAR plus the local 1,440-plant catalog.

What changed:
- Added `public/green_acres_filter_index.json`
- Added `scripts/build-green-acres-filter-index-from-har.mjs`
- Added Green Acres filter fields to loaded plants:
  - raw product tags
  - parsed filter data JSON
  - product handle
  - source categories
  - price min/max
- Added real Green Acres filter groups to the app:
  - Category / Mega menu
  - Attributes
  - Landscape Use
  - Bloom Time
  - Flower Color
  - Foliage Color
  - Light Requirement
  - Water Needs
  - Habit
  - Height
  - Width
  - Growth Rate
  - USDA Zones
  - Available In
  - Container Size
  - Price
- Filtering uses OR inside one Green Acres group and AND across groups.
- Kept older helper filters under a separate “Older helper filters” section.

Notes:
- The HAR captured 100 Boost filter API requests and 36 unique collection slugs.
- Most matching comes from `Green_Acres_Filter_Data_JSON` and `Green_Acres_Tags`, which is more reliable than trying to click every checkbox combination.
- This version keeps v1.0.11 import plan UX and the v1.0.10/v1.0.9 rock fixes.
