# Source databases for Green Acres enrichment

This folder is for downloaded source datasets. The app does not guess missing plant data. It only enriches Green Acres records from files/API dumps placed here.

## Target files the enrichment script can read

Put or generate these files in this folder:

```text
usda-plants-checklist.csv          # USDA taxonomy/checklist names, symbols, family
usda-plant-characteristics.csv     # USDA characteristics: height, shade tolerance, moisture, growth habit
companion-plants.csv               # Wikipedia/Kaggle companion graph or similar node-edge CSV
permapeople-plants.json            # Full Permapeople plant API dump
permapeople-companions.json        # Optional Permapeople companion API dump
trefle-plants.json                 # Optional Trefle dump, if used later
```

Downloaded zip files and raw extracted folders go in:

```text
raw/
```

## Download commands

### Kaggle companion plants dataset

Requires Kaggle API credentials. Set these from your Kaggle account API token:

```bash
set KAGGLE_USERNAME=your_username
set KAGGLE_KEY=your_key
npm run download-source-databases -- --kaggle-companion
```

The script uses the Kaggle dataset slug:

```text
aramacus/companion-plants
```

### USDA PLANTS checklist from Kaggle mirror

This is a copy of USDA checklist data hosted by Kaggle. It is useful for names/common names/symbols.

```bash
set KAGGLE_USERNAME=your_username
set KAGGLE_KEY=your_key
npm run download-source-databases -- --kaggle-usda-checklist
```

Dataset slug:

```text
usdeptofag/usda-plants-checklist
```

### Official USDA PLANTS downloads

The official USDA PLANTS site has a downloads page. Download the complete checklist and plant characteristics data when available. If you have a direct file URL, the downloader can save it:

```bash
npm run download-source-databases -- --usda-official --usda-url=https://DIRECT_FILE_URL_HERE
```

If the USDA page only gives you a browser download, download it manually and place the CSV/TXT file here using the target names above.

### Permapeople full API dump

Requires Permapeople API headers:

```bash
set PERMAPEOPLE_KEY_ID=your_key_id
set PERMAPEOPLE_KEY_SECRET=your_key_secret
npm run download-source-databases -- --permapeople
```

Optional companion data dump:

```bash
npm run download-source-databases -- --permapeople-companions
```

### OpenFarm archive

OpenFarm is archived. This command downloads the GitHub archive into `raw/openfarm/` for inspection/import work:

```bash
npm run download-source-databases -- --openfarm
```

OpenFarm data is not automatically trusted for landscape height/water/light until we map exact fields from the archived schema.

## Enrichment workflow

After downloading or manually adding source files:

```bash
npm run source-backed-enrich-green-acres
npm run score-green-acres-design
```

Or run the full source-backed database pipeline:

```bash
npm run database-v85b
```

## No guessing policy

- Green Acres remains the primary buying/source catalog.
- USDA checklist can fill taxonomy, family, common/scientific names, and symbols.
- USDA characteristics can fill source-backed height, shade/light, water/moisture, and growth habit when those columns exist.
- Permapeople can fill light, water, zones, family, and companion/guild-style fields when exact/high-confidence matches exist.
- Companion graph data fills relationships only.
- Missing fields stay missing when no source-backed value exists.
