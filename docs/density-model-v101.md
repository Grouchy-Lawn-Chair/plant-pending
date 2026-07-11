# v101 Density Model Fix

Density was over-counting plants that were placed tightly inside clumps. Because the app visually merges/overlaps repeated symbols, a zone could technically contain many plants but still look empty.

v101 changes density to mean visible coverage:

- Larger planting types now spread clumps apart instead of stacking plants on top of each other.
- Grass drift, slope, pool, and rock garden use wider drift spacing.
- Repeat limits were raised for grass and slope so the generator does not fail early.
- High density avoids hiding plants inside the same visual blob.
- Flower bed and mixed border behavior were left mostly alone because those were testing well.
