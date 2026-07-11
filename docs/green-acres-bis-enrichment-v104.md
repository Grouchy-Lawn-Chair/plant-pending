# v104 Green Acres BIS enrichment

This adds a focused database-quality script for Green Acres product pages.

The script reads each target product page and looks for:

```js
_BISConfig.product = { ... };
```

It parses that product object and fills missing planner fields from the product `description`, `content`, `tags`, `variants`, and images.

## Normal app use

You do not need this for normal app use.

```powershell
npm install
npm run dev
```

## Preview the scraper on 10 products

```powershell
npm run enrich-green-acres-bis:dry-run
```

## Fill missing Green Acres fields

```powershell
npm run enrich-green-acres-bis
npm run database
```

Or run both together:

```powershell
npm run database:refresh-green-acres
```

## What it fills

- light requirement
- water needs
- growth habit
- growth rate when present
- size/height/width tags when present
- attributes like Herb, Edible, Pollinator Attracting
- product tags
- variants/prices/images when missing

## What it does not force

Botanical name is optional. The app uses the Green Acres product name as the source-of-truth display name.
