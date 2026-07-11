#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.join(root, 'public', 'green_acres_catalog.csv');
const normalizedJsonPath = path.join(root, 'public', 'green_acres_normalized.json');
const qualityReportPath = path.join(root, 'public', 'green_acres_data_quality_report.csv');
const summaryPath = path.join(root, 'public', 'green_acres_normalization_summary.json');

function parseCSV(text) {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(current);
      current = '';
      if (row.some(v => String(v).trim() !== '')) rows.push(row);
      row = [];
    } else {
      current += char;
    }
  }
  row.push(current);
  if (row.some(v => String(v).trim() !== '')) rows.push(row);
  return rows;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCSV(filePath, headers, records) {
  const out = [headers.map(csvEscape).join(',')];
  for (const record of records) out.push(headers.map(h => csvEscape(record[h] ?? '')).join(','));
  fs.writeFileSync(filePath, out.join('\n') + '\n', 'utf8');
}

function rowsToObjects(rows) {
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(values => {
    const row = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = values[i] ?? '';
    return row;
  });
}

function dedupe(values) {
  const seen = new Set();
  const out = [];
  for (const value of values.map(v => String(v || '').trim()).filter(Boolean)) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'plant';
}

const TAG_PREFIX_MAP = [
  ['Attributes_', 'attributes'],
  ['Available in Store_', 'availableSeasons'],
  ['Bloom_', 'bloomSeasons'],
  ['Flower Color_', 'flowerColors'],
  ['Foliage Color_', 'foliageColors'],
  ['Growth Habit_', 'growthHabits'],
  ['Growth Rate_', 'growthRates'],
  ['Height_', 'heightTags'],
  ['Landscape Use_', 'landscapeUses'],
  ['Light Requirement_', 'lightRequirements'],
  ['Plants_', 'plantCategories'],
  ['Size_', 'nurserySizes'],
  ['Shrubs_', 'shrubCategories'],
  ['Annuals_', 'annualCategories'],
  ['Perennials_', 'perennialCategories'],
  ['Trees_', 'treeCategories'],
  ['USDA Zone_', 'usdaZones'],
  ['Water Requirement_', 'waterNeedsTags'],
  ['Width_', 'widthTags'],
];

function parseTags(rawTags) {
  const buckets = {
    attributes: [], availableSeasons: [], bloomSeasons: [], flowerColors: [], foliageColors: [],
    growthHabits: [], growthRates: [], heightTags: [], landscapeUses: [], lightRequirements: [],
    plantCategories: [], nurserySizes: [], shrubCategories: [], annualCategories: [], perennialCategories: [], treeCategories: [],
    usdaZones: [], waterNeedsTags: [], widthTags: [], unparsedFilterTags: [], rawTags: [],
  };
  const tags = String(rawTags || '').split(';').map(t => t.trim()).filter(Boolean);
  buckets.rawTags = tags;
  for (const tag of tags) {
    let matched = false;
    for (const [prefix, bucket] of TAG_PREFIX_MAP) {
      if (tag.startsWith(prefix)) {
        buckets[bucket].push(tag.slice(prefix.length).trim());
        matched = true;
        break;
      }
    }
    if (!matched && /^[A-Za-z ]+:.+/.test(tag)) buckets.unparsedFilterTags.push(tag);
  }
  for (const key of Object.keys(buckets)) buckets[key] = dedupe(buckets[key]);
  return buckets;
}

function normalizePriceString(text) {
  if (!text) return '';
  return String(text).replace(/\$(\d{3,6})\.00\b/g, (_m, digits) => {
    const cents = Number.parseInt(digits, 10);
    if (!Number.isFinite(cents)) return _m;
    return `$${(cents / 100).toFixed(2)}`;
  }).replace(/\s+/g, ' ').trim();
}

function pricesFromText(text) {
  const normalized = normalizePriceString(text);
  const matches = [...normalized.matchAll(/\$(\d+(?:\.\d{1,2})?)/g)];
  return matches.map(m => Math.round(Number(m[1]) * 100)).filter(n => Number.isFinite(n));
}

function formatPrice(cents) {
  if (!Number.isFinite(cents)) return '';
  return `$${(cents / 100).toFixed(2)}`;
}

function parseVariants(raw) {
  const parts = String(raw || '').split(';').map(v => v.trim()).filter(Boolean);
  return parts.map(part => {
    const match = part.match(/^(.*?)\s+\$(\d+(?:\.\d{1,2})?)\s*$/);
    if (!match) return { label: part, priceCents: null, priceDisplay: '', raw: part };
    const label = match[1].trim();
    const normalizedPrice = normalizePriceString(`$${match[2]}`);
    const cents = pricesFromText(normalizedPrice)[0] ?? null;
    const size = label.split('/')[0]?.replace(/\[v::[^\]]+\]/g, '').trim() || label;
    const option = label.includes('/') ? label.split('/').slice(1).join('/').replace(/\[v::[^\]]+\]/g, '').trim() : '';
    const locationMatch = label.match(/\[v::([^\]]+)\]/);
    return { label, size, option, locationCode: locationMatch?.[1] || '', priceCents: cents, priceDisplay: cents !== null ? formatPrice(cents) : '', raw: part };
  });
}

function priceSummary(priceText, variants) {
  const prices = [...pricesFromText(priceText), ...variants.map(v => v.priceCents).filter(n => Number.isFinite(n))];
  if (!prices.length) return { minCents: null, maxCents: null, display: normalizePriceString(priceText || '') };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { minCents: min, maxCents: max, display: min === max ? formatPrice(min) : `${formatPrice(min)}-${formatPrice(max)}` };
}

function parseFeetValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/Landscape Size:/i, '')
    .replace(/Size/i, '')
    .replace(/–/g, '-')
    .replace(/to/gi, '-')
    .trim();
  const inchToFt = n => n / 12;
  const nums = [...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot|"|in|inch|inches)?/gi)].map(m => Number(m[1]));
  if (!nums.length) return null;
  const hasInches = /"|\d\s*in(?:ch(?:es)?)?\b/i.test(cleaned) && !/'|ft|feet|foot/i.test(cleaned);
  const converted = nums.map(n => hasInches ? inchToFt(n) : n);
  return { raw, minFt: Math.min(...converted), maxFt: Math.max(...converted) };
}

function parseHeightWidth(row, tags) {
  const heightRaw = tags.heightTags[0] || '';
  const widthRaw = tags.widthTags[0] || '';
  let height = parseFeetValue(heightRaw);
  let width = parseFeetValue(widthRaw);
  const landscape = row.Green_Acres_Landscape_Size_Text || row.Green_Acres_Page_Size_Text || '';
  if ((!height || !width) && landscape) {
    const after = landscape.replace(/Landscape Size:/i, '').trim();
    const tallMatch = after.match(/([\d.]+(?:\s*[-–]\s*[\d.]+)?\s*(?:'|ft|feet|"|in|inch|inches)?)\s*(?:tall|high|h\b)/i);
    const wideMatch = after.match(/([\d.]+(?:\s*[-–]\s*[\d.]+)?\s*(?:'|ft|feet|"|in|inch|inches)?)\s*(?:wide|w\b)/i);
    if (!height && tallMatch) height = parseFeetValue(tallMatch[1]);
    if (!width && wideMatch) width = parseFeetValue(wideMatch[1]);
  }
  return { height, width };
}

function qualityWarnings(row, normalized) {
  const warnings = [];
  if (!row.Green_Acres_Match || !/true|yes|1/i.test(row.Green_Acres_Match)) warnings.push('not_green_acres_match');
  if (!row.Green_Acres_Product_Name) warnings.push('missing_product_name');
  // Botanical name is optional for the planner; Green Acres product name is the display/source-of-truth name.
  if (!normalized.url) warnings.push('missing_product_url');
  if (!normalized.imageUrl && !row.Thumbnail_Local_Path) warnings.push('missing_image');
  if (!normalized.price.display) warnings.push('missing_price');
  if (!normalized.height?.maxFt) warnings.push('missing_height');
  if (!normalized.width?.maxFt) warnings.push('missing_width');
  if (!normalized.lightRequirements.length) warnings.push('missing_light');
  if (!normalized.waterNeeds.length && !row.Green_Acres_Water_Needs) warnings.push('missing_water');
  if (!normalized.attributes.length) warnings.push('missing_attributes');
  if (String(row.Green_Acres_Price_Text || '').match(/\$\d{3,6}\.00\b/)) warnings.push('raw_price_looked_like_shopify_cents');
  if (String(row.Green_Acres_Variants || '').match(/\$\d{3,6}\.00\b/)) warnings.push('variant_price_looked_like_shopify_cents');
  return warnings;
}

if (!fs.existsSync(catalogPath)) {
  console.error(`Missing ${catalogPath}`);
  process.exit(1);
}

const rows = rowsToObjects(parseCSV(fs.readFileSync(catalogPath, 'utf8')));
const originalHeaders = Object.keys(rows[0] || {});
const extraHeaders = [
  'Green_Acres_Price_Min_Cents', 'Green_Acres_Price_Max_Cents', 'Green_Acres_Price_Display_Normalized',
  'Green_Acres_Variants_Normalized_JSON', 'Green_Acres_Height_Min_ft', 'Green_Acres_Height_Max_ft',
  'Green_Acres_Width_Min_ft', 'Green_Acres_Width_Max_ft', 'Green_Acres_Filter_Data_JSON', 'Green_Acres_Data_Quality_Warnings'
];
const headers = [...originalHeaders, ...extraHeaders.filter(h => !originalHeaders.includes(h))];
const normalizedPlants = [];
const report = [];
let correctedPriceTextCount = 0;
let correctedVariantCount = 0;

for (const row of rows) {
  const tags = parseTags(row.Green_Acres_Tags || '');
  const variants = parseVariants(row.Green_Acres_Variants || '');
  const price = priceSummary(row.Green_Acres_Price_Text || '', variants);
  const { height, width } = parseHeightWidth(row, tags);
  const normalizedPriceText = normalizePriceString(row.Green_Acres_Price_Text || '');
  const normalizedVariantsText = (row.Green_Acres_Variants || '').split(';').map(v => normalizePriceString(v.trim())).filter(Boolean).join('; ');
  if (row.Green_Acres_Price_Text && row.Green_Acres_Price_Text !== normalizedPriceText) correctedPriceTextCount++;
  if (row.Green_Acres_Variants && row.Green_Acres_Variants !== normalizedVariantsText) correctedVariantCount++;

  const fallbackList = value => String(value || '').split(';').map(v => v.trim()).filter(Boolean);
  const normalized = {
    plantId: Number(row.Plant_ID) || row.Plant_ID,
    stablePlantKey: slugify(row.Green_Acres_Product_Handle || row.Green_Acres_Product_Name || row.Common_Name || row.Botanical_Name || row.Plant_ID),
    category: row.Category || '',
    productName: row.Green_Acres_Product_Name || row.Common_Name || row.Botanical_Name || '',
    commonName: row.Common_Name || '',
    botanicalName: row.Green_Acres_Botanical_Name || row.Botanical_Name || '',
    greenAcresProductId: row.Green_Acres_Product_ID || '',
    handle: row.Green_Acres_Product_Handle || '',
    url: row.Green_Acres_URL || '',
    imageUrl: row.Green_Acres_Image_URL || row.Thumbnail_URL || '',
    localImagePath: row.Green_Acres_Local_Image_Path || row.Thumbnail_Local_Path || '',
    price,
    variants,
    height: height ? { raw: height.raw, minFt: Number(height.minFt.toFixed(2)), maxFt: Number(height.maxFt.toFixed(2)) } : null,
    width: width ? { raw: width.raw, minFt: Number(width.minFt.toFixed(2)), maxFt: Number(width.maxFt.toFixed(2)) } : null,
    landscapeSizeText: row.Green_Acres_Landscape_Size_Text || row.Green_Acres_Page_Size_Text || '',
    lightRequirements: dedupe([...tags.lightRequirements, ...fallbackList(row.Green_Acres_Light_Requirement)]),
    waterNeeds: dedupe([...tags.waterNeedsTags, ...fallbackList(row.Green_Acres_Water_Needs)]),
    growthHabits: dedupe([...tags.growthHabits, ...fallbackList(row.Green_Acres_Growth_Habit)]),
    growthRates: dedupe([...tags.growthRates, ...fallbackList(row.Green_Acres_Growth_Rate)]),
    attributes: dedupe([...tags.attributes, ...fallbackList(row.Green_Acres_Attributes)]),
    landscapeUses: dedupe([...tags.landscapeUses, ...fallbackList(row.Green_Acres_Landscape_Uses)]),
    flowerColors: dedupe([...tags.flowerColors, ...fallbackList(row.Green_Acres_Flower_Color)]),
    foliageColors: dedupe([...tags.foliageColors, ...fallbackList(row.Green_Acres_Foliage_Color)]),
    bloomSeasons: tags.bloomSeasons,
    availableSeasons: dedupe([...tags.availableSeasons, ...fallbackList(row.Green_Acres_Available_In)]),
    usdaZones: dedupe([...tags.usdaZones, ...fallbackList(row.Green_Acres_USDA_Zone)]),
    categoriesFromTags: dedupe([...tags.plantCategories, ...tags.shrubCategories, ...tags.annualCategories, ...tags.perennialCategories, ...tags.treeCategories]),
    rawFilterTags: tags,
    source: {
      primary: 'Green Acres product tags and page fields',
      lastCrawled: row.Green_Acres_Page_Last_Crawled || row.Green_Acres_Last_Checked || '',
      matchConfidence: row.Green_Acres_Match_Confidence || '',
    }
  };
  const warnings = qualityWarnings(row, normalized);
  normalized.dataQualityWarnings = warnings;

  row.Green_Acres_Price_Text = normalizedPriceText;
  row.Green_Acres_Variants = normalizedVariantsText;
  row.Green_Acres_Price_Min_Cents = price.minCents ?? '';
  row.Green_Acres_Price_Max_Cents = price.maxCents ?? '';
  row.Green_Acres_Price_Display_Normalized = price.display || normalizedPriceText;
  row.Green_Acres_Variants_Normalized_JSON = JSON.stringify(variants);
  row.Green_Acres_Height_Min_ft = normalized.height?.minFt ?? '';
  row.Green_Acres_Height_Max_ft = normalized.height?.maxFt ?? '';
  row.Green_Acres_Width_Min_ft = normalized.width?.minFt ?? '';
  row.Green_Acres_Width_Max_ft = normalized.width?.maxFt ?? '';
  row.Green_Acres_Filter_Data_JSON = JSON.stringify({
    attributes: normalized.attributes,
    availableSeasons: normalized.availableSeasons,
    bloomSeasons: normalized.bloomSeasons,
    flowerColors: normalized.flowerColors,
    foliageColors: normalized.foliageColors,
    growthHabits: normalized.growthHabits,
    growthRates: normalized.growthRates,
    heightTags: tags.heightTags,
    widthTags: tags.widthTags,
    landscapeUses: normalized.landscapeUses,
    lightRequirements: normalized.lightRequirements,
    plantCategories: normalized.categoriesFromTags,
    nurserySizes: tags.nurserySizes,
    usdaZones: normalized.usdaZones,
    waterNeeds: normalized.waterNeeds,
  });
  row.Green_Acres_Data_Quality_Warnings = warnings.join('; ');

  normalizedPlants.push(normalized);
  report.push({
    Plant_ID: row.Plant_ID,
    Product_Name: normalized.productName,
    Botanical_Name: normalized.botanicalName,
    Green_Acres_URL: normalized.url,
    Warnings: warnings.join('; '),
    Price_Display: price.display,
    Height_ft: normalized.height ? `${normalized.height.minFt}-${normalized.height.maxFt}` : '',
    Width_ft: normalized.width ? `${normalized.width.minFt}-${normalized.width.maxFt}` : '',
    Light: normalized.lightRequirements.join('; '),
    Water: normalized.waterNeeds.join('; '),
  });
}

writeCSV(catalogPath, headers, rows);
fs.writeFileSync(normalizedJsonPath, JSON.stringify(normalizedPlants, null, 2) + '\n', 'utf8');
writeCSV(qualityReportPath, ['Plant_ID','Product_Name','Botanical_Name','Green_Acres_URL','Warnings','Price_Display','Height_ft','Width_ft','Light','Water'], report);

const warningCounts = {};
for (const record of report) {
  for (const warning of String(record.Warnings || '').split(';').map(w => w.trim()).filter(Boolean)) {
    warningCounts[warning] = (warningCounts[warning] || 0) + 1;
  }
}
const summary = {
  generatedAt: new Date().toISOString(),
  catalogRows: rows.length,
  normalizedPlants: normalizedPlants.length,
  correctedPriceTextRows: correctedPriceTextCount,
  correctedVariantRows: correctedVariantCount,
  warningCounts,
  outputs: [
    'public/green_acres_catalog.csv',
    'public/green_acres_normalized.json',
    'public/green_acres_data_quality_report.csv',
    'public/green_acres_normalization_summary.json'
  ]
};
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(summary, null, 2));
