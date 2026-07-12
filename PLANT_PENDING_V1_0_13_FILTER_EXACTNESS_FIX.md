# Plant Pending v1.0.13 Filter exactness fix

Fixes a too-broad Green Acres category match.

Problem:
- Category values like `shrubs-under-2-tall` could match the broad tag `SHRUBS`.
- That meant a specific mega-menu category could accidentally include all shrubs.

Fix:
- Green Acres filters now match exact normalized values or a plant value that contains the selected value.
- They no longer match when the selected value merely contains a shorter broad value.
- Example: `SHRUBS` no longer matches `shrubs-under-2-tall`.
- `Full Sun or Morning Sun/Afternoon Shade` still matches `Full Sun`.
