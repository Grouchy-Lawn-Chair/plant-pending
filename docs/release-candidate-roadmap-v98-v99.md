# v98/v99 Release Candidate Notes

This version combines the planned v98 QA pass and v99 planting-plan recipe pass.

## v98 scope

- Keep the generator stable.
- Fix obvious bad behavior only.
- Confirm all six planting types still run: pool planter, slope planting, flower bed, grass drift, hedge row, rock garden.

## v99 scope

- Add explicit planting-plan recipes so generated layouts act like designed plant communities.
- Limit palette size by planting type.
- Clamp plant counts so mature spreading plants reduce the need for excessive individual plants.
- Keep rocks generated automatically for rock gardens.

## Release rule

No new major features before 1.0 after this. Only bug fixes and obvious planting behavior corrections.

## Commands

```powershell
npm install
npm run database
npm run dev
```

Old version commands are kept as aliases, but the main command is `npm run database`.
