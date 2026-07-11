# v97 Command Cleanup

v97 adds one current database command so the app is easier to run.

## Normal commands

After downloading a new project zip:

```powershell
npm install
npm run database
npm run dev
```

If you already ran `npm install` and `npm run database` in this same folder, you can usually reopen the app with:

```powershell
npm run dev
```

## What `npm run database` does

It rebuilds the compact app-ready plant data files in `public/`:

- `green_acres_normalized.json`
- `green_acres_design_scores.json`
- `green_acres_research_classification.json`
- `pro_planting_area_directives.json`

It does not download the giant raw source databases.

## When raw source data changes

Use this only when the local source files changed, such as USDA, Permapeople, Kaggle, OpenFarm, or the Green Acres source subset:

```powershell
npm run database:local-sources
```

## Old database commands

Old commands like `database-v91`, `database-v94`, and `database-v95` are historical. They can stay in `package.json` for now so old notes do not break, but the command to use going forward is:

```powershell
npm run database
```
