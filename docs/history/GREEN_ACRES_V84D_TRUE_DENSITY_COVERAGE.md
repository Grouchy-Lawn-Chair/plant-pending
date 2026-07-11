# v84d – True Density Coverage

This patch makes the density slider mean the same thing across planting types.

## Main rule

- Hedge row density = percent of the selected back edge covered by clipped hedge plants.
- Flower bed density = percent of available zone area covered by plant circles.
- Grass drift density = percent of available zone area covered by plant circles.

Planting type changes plant mix and pattern. It does not redefine what 50% means.

## Hedge rows

Hedge rows now calculate plant count from selected back-edge length and clipped hedge display width:

```
target covered length = back edge length × density
plant count = target covered length ÷ clipped hedge display width
```

Plants are then spaced evenly across the whole selected edge so lower density creates an even row with visible gaps.

## Flower beds and grass drifts

Area-based layouts now calculate plant count from usable zone area and average displayed plant circle area:

```
target covered area = usable zone area × density
plant count = target covered area ÷ average displayed plant area
```

Exclusion zones are subtracted from usable area when they sit inside the planting zone.

## Seed behavior

The planting seed should change plant selection and positions, not the meaning of density.
