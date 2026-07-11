# v81 Green Acres Database Upgrade

v81 keeps the app UI alone and focuses on the plant database foundation.

## What changed

- Added `scripts/normalize-green-acres-source.mjs`.
- Added npm scripts:
  - `npm run normalize-green-acres`
  - `npm run database-v81`
- Updated `public/green_acres_catalog.csv` with normalized Green Acres fields.
- Added `public/green_acres_normalized.json` as the clean structured Green Acres data layer.
- Added `public/green_acres_data_quality_report.csv` for missing or weak source fields.
- Added `public/green_acres_normalization_summary.json` for a quick run summary.

## New catalog columns

The script adds these columns to `green_acres_catalog.csv`:

- `Green_Acres_Price_Min_Cents`
- `Green_Acres_Price_Max_Cents`
- `Green_Acres_Price_Display_Normalized`
- `Green_Acres_Variants_Normalized_JSON`
- `Green_Acres_Height_Min_ft`
- `Green_Acres_Height_Max_ft`
- `Green_Acres_Width_Min_ft`
- `Green_Acres_Width_Max_ft`
- `Green_Acres_Filter_Data_JSON`
- `Green_Acres_Data_Quality_Warnings`

## Green Acres tag prefixes normalized

The script reads product tags and page fields, then normalizes:

- `Attributes_`
- `Available in Store_`
- `Bloom_`
- `Flower Color_`
- `Foliage Color_`
- `Growth Habit_`
- `Growth Rate_`
- `Height_`
- `Landscape Use_`
- `Light Requirement_`
- `Plants_`
- `Shrubs_`
- `Annuals_`
- `Perennials_`
- `Trees_`
- `USDA Zone_`
- `Water Requirement_`
- `Width_`

## Price handling

Green Acres Shopify values that were stored like `$950.00` are normalized to `$9.50`.

Variant data is stored two ways:

1. Human-readable corrected text in `Green_Acres_Variants`.
2. Structured JSON in `Green_Acres_Variants_Normalized_JSON` with `priceCents` and `priceDisplay`.

## Why this matters

Green Acres is now treated as the primary database layer because these are the plants the app is actually planning around. USDA, companion planting, Permapeople, and OpenFarm can be layered in later as enrichment sources.

## Next recommended build

v82 should derive app-specific design scores from the normalized Green Acres fields:

- pool suitability
- slope suitability
- waterwise score
- evergreen score
- flower/mess risk
- pet-friendly flag
- color interest
- layout reliability
