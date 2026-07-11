# v91 source database management

v91 separates big raw source downloads from the compact data the app actually needs.

## Keep local only

These are large source files. Do not include them in normal project zip uploads:

- `data/source-databases/raw/`
- `data/source-databases/cache/`
- `data/source-databases/permapeople-plants.json`
- `data/source-databases/permapeople-companions.json`
- `data/source-databases/usda-plants-checklist.txt`
- `data/source-databases/usda-california-checklist.txt`

## Include in project zip

These are small enough and are limited to Green Acres plants:

- `data/source-databases/processed/green-acres-source-subset.json`
- `data/source-databases/processed/green-acres-permapeople-matches.json`
- `data/source-databases/processed/green-acres-companion-graph.csv`
- `data/source-databases/processed/green-acres-source-subset-report.csv`
- `public/green_acres_source_subset_summary.json`

## Commands

Build the Green Acres-only subset from local raw sources:

```bash
npm run build-green-acres-source-subset
```

Rebuild the app database using the already-built processed subset:

```bash
npm run database-v91
```

Rebuild everything when raw local source databases are present:

```bash
npm run database-v91-local-sources
```

## Current v91 subset results

Using the source files in v90, v91 matched:

- USDA national checklist: 772 of 1,440 Green Acres plants
- USDA California checklist: 369 of 1,440
- Permapeople: 705 of 1,440
- Kaggle companion graph: 171 of 1,440

The raw Permapeople dump was 9,070 records. The processed Green Acres-only Permapeople match file is about 1.5 MB.
