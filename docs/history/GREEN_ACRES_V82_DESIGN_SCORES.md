# v82 Green Acres Design Scores

v82 keeps the app UI unchanged and adds a new derived database layer for future layout generation.

## What v82 adds

New script:

```bash
npm run score-green-acres-design
```

New full database command:

```bash
npm run database-v82
```

`database-v82` runs the v81 Green Acres normalization first, then generates design scores from the normalized Green Acres data.

## New output files

```text
public/green_acres_design_scores.json
public/green_acres_design_scores_report.csv
public/green_acres_design_score_summary.json
```

## Scores generated

Each Green Acres plant now gets these heuristic scores from 0 to 10:

```text
poolSafeScore
messinessScore
evergreenScore
waterwiseScore
slopeScore
privacyScore
colorInterestScore
petSafeScore
layoutReliabilityScore
```

Important note: these are design signals, not botanical guarantees. They are meant to help the future layout generator rank and filter plants.

## Score logic examples

Pool candidates get boosted by:

```text
Evergreen
Waterwise / low water
Container use
Clean architectural foliage
Grass / strappy / succulent-like plant type
Lower mature height and width
```

Pool candidates get reduced by:

```text
Heavy bloom
Attracts bees
Fruit / edible mess
Thorns / spines
Large mature height or width
High messiness score
```

Slope candidates get boosted by:

```text
Groundcover
Trailing / spreading habit
Waterwise / low water
Medium shrub scale
Slope / bank / erosion related landscape uses
```

Privacy candidates get boosted by:

```text
Evergreen
Mature height around 4 to 12 feet
Useful mature width
Upright / dense / bushy growth habit
```

Color interest gets boosted by:

```text
Flower colors
Bloom seasons
Showy or long bloom
Purple, red, orange, yellow, gold, silver, blue, gray, bronze, burgundy, or variegated foliage
Evergreen year-round structure
```

Layout reliability gets boosted by available data:

```text
Height
Width
Light requirement
Water need
Attributes
Landscape uses
```

It gets reduced when the plant has data quality warnings.

## Summary from this build

```text
Scored plants: 1,440
Pool candidates: 160
Low-mess pool candidates: 157
Slope candidates: 334
Privacy candidates: 204
Color accent candidates: 640
Waterwise candidates: 392
Needs manual review: 2
Attracts bees: 212
Pet Friendly tagged: 56
```

## How this should be used later

v82 does not change the visual app yet. The next generator version can use these files to make better choices.

Example future rules:

```text
Pool zone:
- Prefer poolSafeScore >= 7
- Prefer messinessScore <= 4
- Prefer evergreenScore >= 7
- Prefer waterwiseScore >= 7
- Avoid attracts_bees unless user allows pollinator plants near pool
```

```text
Slope zone:
- Prefer slopeScore >= 7
- Prefer waterwiseScore >= 6
- Prefer groundcover_or_trailing flag
- Mix with medium shrubs for structure
```

```text
Privacy zone:
- Prefer privacyScore >= 7
- Prefer evergreenScore >= 7
- Prefer height between 4 and 12 feet
```

## Files changed

```text
package.json
scripts/score-green-acres-design.mjs
public/green_acres_catalog.csv
public/green_acres_normalized.json
public/green_acres_data_quality_report.csv
public/green_acres_normalization_summary.json
public/green_acres_design_scores.json
public/green_acres_design_scores_report.csv
public/green_acres_design_score_summary.json
GREEN_ACRES_V82_DESIGN_SCORES.md
```
