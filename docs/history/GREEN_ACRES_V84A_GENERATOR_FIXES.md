# v84a Generator Fixes: Flower Bed Layers + Hedge Scale

This patch tightens the v84 planting-type generator behavior after real testing.

## Fixes

- Flower bed front/back behavior is stronger.
  - Front-marked edges now strongly prefer low plants.
  - Back-marked edges now strongly prefer medium/tall plants.
  - Tall plants are rejected near front edges.
  - Low plants are rejected near back edges for flower/mixed/pool beds.

- Hedge row behavior is now treated as a clipped row, not a mixed bed.
  - Hedge rows pick one strong hedge candidate and repeat it.
  - Hedge rows use the marked Back edge when available.
  - If no Back edge is marked, the longest zone edge is used.
  - Hedge rows use a trimmed display width so full mature spread does not create huge blobs.

## Display-width change

Generated hedge-row plants can now include:

```ts
displayWidthFt
```

This does not change the plant's real mature size in the plant database. It only controls plan display and generated spacing for maintained hedges.

Example: a Euonymus with a 5 ft mature width can display as an approximately 2 ft maintained hedge mass.

## Still future work

- Add a true rectangular hedge-row symbol/icon style.
- Add per-plant "maintained hedge width" data if we want more precision later.
