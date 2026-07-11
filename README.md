
## Quick start

For normal use, the database is already included. Run:

```powershell
npm install
npm run dev
```

Only rebuild the database if plant source data or database scripts changed:

```powershell
npm run database
```

# Garden Planner App

## Run it

```powershell
npm install
npm run database
npm run dev
```

Most days, after setup, just run:

```powershell
npm run dev
```

## Rebuild from local raw source databases

Only use this when the raw source files changed:

```powershell
npm run database:local-sources
```

See `docs/command-cleanup-v97.md` for details.
