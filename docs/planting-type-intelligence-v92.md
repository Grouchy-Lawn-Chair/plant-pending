# v92 Planting-Type Intelligence

v92 keeps the v91 compact source-subset workflow and tightens the generator rules for planting types.

## Changes

- Flower bed now favors true flowering perennials/annuals and compact flowering accents.
- Flower bed now strongly excludes succulents, agaves, kalanchoe/panda plant, oleander, rockrose/cistus, and big shrub choices.
- Pool planter now prefers clean architectural and grass/strappy plants and heavily avoids toxic, messy, bee-attracting, or high-flower plants.
- Grass drift now uses grass/strappy plants only instead of mixing in agaves or random accents.
- Slope planting now favors groundcovers, grasses, and slope-score plants.
- Rock garden now favors architectural, succulent, groundcover, and small low-water plants.
- Hedge row still repeats one hedge-style candidate as a maintained/clipped row.

## Commands

Normal use:

```powershell
npm install
npm run database-v92
npm run dev
```

Only if raw source files changed:

```powershell
npm run database-v91-local-sources
npm run database-v92
npm run dev
```
