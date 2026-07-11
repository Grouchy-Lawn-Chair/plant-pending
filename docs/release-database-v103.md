# v103 Release database notes

The app now ships with the generated database JSON files in `public/`.

Normal use:

```powershell
npm install
npm run dev
```

You do not need to run `npm run database` every time. The database is already built and included in the zip.

Only run `npm run database` when changing source plant data or database-building scripts, such as:

- Green Acres CSV/source data
- research classification scripts
- design score scripts
- planting recipe/directive scripts
- raw source database subset files

For regular UI/code changes and testing, skip the database command.
