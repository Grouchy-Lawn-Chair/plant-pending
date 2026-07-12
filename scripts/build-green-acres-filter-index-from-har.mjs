#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const csvPath = path.join(root, 'public', 'green_acres_catalog.csv');
const outPath = path.join(root, 'public', 'green_acres_filter_index.json');
const harArg = process.argv[2];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current || row.length) {
    row.push(current);
    if (row.some(cell => cell.trim() !== '')) rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows.map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function addValues(counter, values) {
  if (!Array.isArray(values)) return;
  values.forEach(value => {
    const label = String(value || '').trim();
    if (!label) return;
    counter.set(label, (counter.get(label) || 0) + 1);
  });
}

function labelFromSlug(slug) {
  return slug
    .replace(/[™®]/g, '')
    .split('-')
    .filter(Boolean)
    .map(part => ['and', 'or', 'of', 'the'].includes(part) ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace('Shrubs Under 2 Tall', "Shrubs Under 2' Tall")
    .replace('Shrubs 2 4 Tall', "Shrubs 2'-4' Tall")
    .replace('Shrubs 4 6 Tall', "Shrubs 4'-6' Tall")
    .replace('Shrubs 6 and Taller', "Shrubs 6' and Taller");
}

function sectionForSlug(slug) {
  if (slug.includes('rose')) return 'Roses';
  if (slug.includes('vine')) return 'Vines';
  if (slug.includes('tree') || ['citrus', 'palms'].includes(slug)) return 'Trees';
  if (slug.includes('shrub') || slug === 'topiary') return 'Shrubs';
  if (['veggies', 'herbs', 'veggies-and-herbs'].includes(slug)) return 'Veggies & Herbs';
  if (slug.includes('houseplant') || slug === 'air-plants') return 'Houseplants';
  if (slug === 'annuals') return 'Annuals';
  if (['perennials', 'spring-blooming', 'summer-blooming', 'fall-blooming', 'groundcover', 'ornamental-grass', 'succulents'].includes(slug)) return 'Perennials';
  if (slug.includes('sod') || slug.includes('turf') || slug.includes('blend')) return 'Sod';
  return 'Collections';
}

const groupDefs = [
  ['plantCategories', 'Category / Mega menu', 'category'],
  ['attributes', 'Attributes', 'tag'],
  ['landscapeUses', 'Landscape Use', 'tag'],
  ['bloomSeasons', 'Bloom Time', 'tag'],
  ['flowerColors', 'Flower Color', 'tag'],
  ['foliageColors', 'Foliage Color', 'tag'],
  ['fallColors', 'Fall Color', 'tag'],
  ['lightRequirements', 'Light Requirement', 'tag'],
  ['waterNeeds', 'Water Needs', 'tag'],
  ['growthHabits', 'Habit', 'tag'],
  ['heightTags', 'Height', 'tag'],
  ['widthTags', 'Width', 'tag'],
  ['growthRates', 'Growth Rate', 'tag'],
  ['usdaZones', 'USDA Zones', 'tag'],
  ['availableSeasons', 'Available In', 'tag'],
  ['nurserySizes', 'Container Size', 'shopping'],
];

const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const counters = Object.fromEntries(groupDefs.map(([key]) => [key, new Map()]));

rows.forEach(row => {
  const raw = row.Green_Acres_Filter_Data_JSON || '';
  if (!raw.trim()) return;
  try {
    const data = JSON.parse(raw);
    groupDefs.forEach(([key]) => addValues(counters[key], data[key]));
  } catch {
    // Skip malformed row-level filter JSON.
  }
});

let boostFilterApiRequestsSeen = 0;
const collectionSlugs = new Map();

if (harArg && fs.existsSync(harArg)) {
  const har = JSON.parse(fs.readFileSync(harArg, 'utf8'));
  for (const entry of har.log?.entries || []) {
    const url = entry.request?.url || '';
    if (url.includes('services.mybcapps.com/bc-sf-filter/filter')) {
      boostFilterApiRequestsSeen += 1;
    }
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes('idiggreenacres.com')) continue;
      const match = decodeURIComponent(parsed.pathname).match(/^\/collections\/([^/?#]+)(?:\/v::(?:ca|tx))?\/?$/);
      if (match) {
        const slug = match[1];
        if (slug !== 'all') collectionSlugs.set(slug, (collectionSlugs.get(slug) || 0) + 1);
      }
    } catch {
      // ignore
    }
  }
}

const groups = groupDefs.map(([key, label, kind]) => {
  const values = Array.from(counters[key].entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ label: value, value, count, matchMode: 'filterData' }));

  if (key === 'plantCategories') {
    const menuValues = Array.from(collectionSlugs.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([slug, count]) => ({
        label: labelFromSlug(slug),
        value: slug,
        count,
        section: sectionForSlug(slug),
        matchMode: 'collectionSlug',
      }));

    return {
      key,
      label,
      kind,
      values: [
        ...menuValues,
        ...values.filter(value => !menuValues.some(menuValue => menuValue.label.toLowerCase() === value.label.toLowerCase())),
      ],
    };
  }

  return { key, label, kind, values };
});

const priceRanges = [
  ['Under $10', '0-999'],
  ['$10-$25', '1000-2500'],
  ['$25-$50', '2500-5000'],
  ['$50-$100', '5000-10000'],
  ['$100+', '10000-up'],
].map(([label, value]) => {
  const [lowRaw, highRaw] = value.split('-');
  const low = Number(lowRaw);
  const high = highRaw === 'up' ? Number.POSITIVE_INFINITY : Number(highRaw);
  const count = rows.filter(row => {
    const min = Number(row.Green_Acres_Price_Min_Cents);
    const max = Number(row.Green_Acres_Price_Max_Cents || row.Green_Acres_Price_Min_Cents);
    return Number.isFinite(min) && Number.isFinite(max) && max >= low && min <= high;
  }).length;
  return { label, value, count, matchMode: 'priceRange' };
});

groups.push({ key: 'priceRanges', label: 'Price', kind: 'price', values: priceRanges });

const index = {
  generatedAt: new Date().toISOString(),
  source: {
    plantCatalog: 'public/green_acres_catalog.csv',
    har: harArg ? path.basename(harArg) : null,
    boostFilterApiRequestsSeen,
    collectionUrlsSeen: Array.from(collectionSlugs.values()).reduce((total, count) => total + count, 0),
    uniqueCollectionSlugsSeen: collectionSlugs.size,
  },
  matching: {
    semantics: 'Within each group, multiple selected values use OR. Across groups, selected groups stack with AND.',
    plantFields: ['Green_Acres_Filter_Data_JSON', 'Green_Acres_Tags', 'Green_Acres_Product_Handle', 'Green_Acres_Source_Categories'],
  },
  groups,
};

fs.writeFileSync(outPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
console.log(`Groups: ${groups.length}`);
console.log(`Values: ${groups.reduce((total, group) => total + group.values.length, 0)}`);
