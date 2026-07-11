# v85b source-backed database plan

v85b returns to the v84f app baseline and adds real database ingestion. It does not use the v85 inferred fallback cleanup.

## Goal

Plug holes in the Green Acres plant database using downloaded or API-dumped source databases:

- USDA PLANTS checklist and characteristics files
- Wikipedia/Kaggle companion planting graph
- Permapeople full API dump
- OpenFarm archive for later field mapping

## Trust order

1. Green Acres product/tag/page data
2. USDA PLANTS taxonomy/checklist
3. USDA PLANTS characteristics data
4. Permapeople API/cache
5. Companion graph data for relationship fields only
6. OpenFarm archived data only after schema mapping

## Provenance

Every filled field gets a `sourceProvenance` entry. If no source-backed value is found, the field remains missing and appears in:

```text
public/green_acres_source_backed_still_missing_report.csv
```

Changed fields appear in:

```text
public/green_acres_source_backed_enrichment_report.csv
```

Summary appears in:

```text
public/green_acres_source_backed_summary.json
```

## Commands

Download source files:

```bash
npm run download-source-databases -- --kaggle-companion --kaggle-usda-checklist
npm run download-source-databases -- --permapeople
npm run download-source-databases -- --openfarm
```

Run enrichment:

```bash
npm run source-backed-enrich-green-acres
npm run score-green-acres-design
```

Full pipeline:

```bash
npm run database-v85b
```

## Important limitation

This zip includes the ingestion tools, not the third-party databases themselves. Kaggle and Permapeople require your credentials/API keys. USDA official downloads may need to be downloaded manually if the site does not expose a stable direct file URL.
