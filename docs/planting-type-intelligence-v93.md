# v93 Planting Type Intelligence Tuning

This patch adjusts the generator after v92 testing showed two over-corrections:

- Pool planter was behaving like a succulent bed.
- Slope planting was behaving like a sedum/succulent groundcover bed.

## Pool planter changes

Pool planter now favors a mixed low-mess pool palette:

- grasses and strappy foliage
- clean foliage shrubs
- colorful foliage plants
- architectural plants as accents
- succulents/agaves as accents only

It still avoids high-mess, bee-heavy, toxic/caution plants, lavender, roses, and oleander for automatic pool planter generation.

## Slope planting changes

Slope planting now favors a broader slope palette:

- non-succulent groundcovers
- spreading shrubs
- erosion-control shrubs
- grasses and strappy plants
- flowering/trailing slope plants
- only one succulent/stonecrop style accent, when it scores well

This keeps succulents from dominating slope layouts.

## Commands

```powershell
npm install
npm run database-v93
npm run dev
```
