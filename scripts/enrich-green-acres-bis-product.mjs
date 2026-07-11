#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.join(root, 'public', 'green_acres_catalog.csv');
const reportPath = path.join(root, 'public', 'green_acres_bis_enrichment_report.csv');
const summaryPath = path.join(root, 'public', 'green_acres_bis_enrichment_summary.json');

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const dryRun = args.has('--dry-run');
const all = args.has('--all');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 0;
const delayArg = process.argv.find(a => a.startsWith('--delay-ms='));
const delayMs = delayArg ? Number(delayArg.split('=')[1]) : 250;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

function rowsToObjects(rows) {
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(values => {
    const row = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = values[i] ?? '';
    return row;
  });
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

function splitList(value) {
  return String(value || '')
    .split(';')
    .map(v => v.trim())
    .filter(Boolean);
}

function mergeList(existing, additions) {
  return dedupe([...splitList(existing), ...additions]).join('; ');
}

function normalizeUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw, 'https://idiggreenacres.com');
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return raw.split('?')[0];
  }
}

function htmlDecode(text) {
  return String(text || '')
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&ndash;|&mdash;/gi, '-');
}

function stripHtml(html) {
  return htmlDecode(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findJsonObjectAfterMarker(html, marker) {
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const braceStart = html.indexOf('{', start + marker.length);
  if (braceStart < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = braceStart; i < html.length; i++) {
    const char = html[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return html.slice(braceStart, i + 1);
    }
  }
  return null;
}

function parseBisProduct(html) {
  const jsonText = findJsonObjectAfterMarker(html, '_BISConfig.product');
  if (!jsonText) return null;
  return JSON.parse(jsonText);
}

function extractCharacteristic(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<li[^>]*>[\\s\\S]*?(?:<strong>|<b>)\\s*${escaped}\\s*:?\\s*<\\/(?:strong|b)>\\s*([\\s\\S]*?)<\\/li>`, 'i'),
    new RegExp(`${escaped}\\s*:?\\s*<\\/?[^>]*>\\s*([^<\\n]+)`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return stripHtml(match[1]).replace(/^:\s*/, '').trim();
  }
  return '';
}

function parseSizeFromText(text) {
  const clean = stripHtml(text).replace(/–/g, '-').replace(/to/gi, '-');
  const tall = clean.match(/([\d.]+(?:\s*[-]\s*[\d.]+)?\s*(?:'|ft|feet|"|in|inch|inches)?)\s*(?:tall|high)\b/i);
  const wide = clean.match(/([\d.]+(?:\s*[-]\s*[\d.]+)?\s*(?:'|ft|feet|"|in|inch|inches)?)\s*wide\b/i);
  if (tall || wide) {
    return `Size: ${tall ? `${tall[1].trim()} tall` : ''}${tall && wide ? ', ' : ''}${wide ? `${wide[1].trim()} wide` : ''}`;
  }
  return clean ? `Size: ${clean}` : '';
}

function sizeTagsFromSizeText(sizeText) {
  const out = [];
  const clean = sizeText.replace(/–/g, '-').replace(/\s+/g, ' ');
  const tall = clean.match(/([\d.]+(?:\s*-\s*[\d.]+)?\s*(?:'|ft|feet|"|in|inch|inches)?)\s*tall/i);
  const wide = clean.match(/([\d.]+(?:\s*-\s*[\d.]+)?\s*(?:'|ft|feet|"|in|inch|inches)?)\s*wide/i);
  const toTag = value => String(value || '')
    .replace(/\s+/g, '')
    .replace(/feet|foot/gi, 'ft')
    .replace(/'/g, 'ft')
    .replace(/inches|inch/gi, 'in')
    .replace(/"/g, 'in');
  if (tall) out.push(`Height_${toTag(tall[1])}`);
  if (wide) out.push(`Width_${toTag(wide[1])}`);
  return out;
}

function tagsToVariants(product) {
  return (product.variants || []).map(variant => {
    const label = variant.public_title || variant.title || variant.name || '';
    const cents = Number(variant.price);
    return `${label} $${(cents / 100).toFixed(2)}`;
  }).filter(Boolean).join('; ');
}

function imageUrl(product) {
  const img = product.featured_image || product.images?.[0] || product.media?.[0]?.src || '';
  if (!img) return '';
  return String(img).startsWith('//') ? `https:${img}` : img;
}

function deriveAttributes(product, plainText) {
  const additions = [];
  const text = plainText.toLowerCase();
  const tags = product.tags || [];
  if (tags.some(t => /^Herb$/i.test(t)) || /\bherb\b|\bteas?\b|natural sweetener|fresh or dried|harvest leaves/.test(text)) additions.push('Herb');
  if (/edible|natural sweetener|fresh or dried|harvest|fruit|vegetable|veggie|tea|culinary|flavor/.test(text)) additions.push('Edible');
  if (/pollinator-attracting|draw pollinators|attracts pollinators|pollinator friendly/.test(text)) additions.push('Pollinator Attracting');
  if (/attracts bees/.test(text)) additions.push('Attracts Bees');
  if (/attracts butterflies/.test(text)) additions.push('Attracts Butterflies');
  if (/attracts hummingbirds/.test(text)) additions.push('Attracts Hummingbirds');
  return dedupe(additions);
}

function addTagValue(row, field, prefix, value) {
  if (!value) return;
  row[field] = mergeList(row[field], [value]);
  const tag = `${prefix}${value}`;
  row.Green_Acres_Tags = dedupe([...splitList(row.Green_Acres_Tags), tag]).join('; ');
}

function shouldFetch(row) {
  if (all) return true;
  const warnings = String(row.Green_Acres_Data_Quality_Warnings || '');
  if (/missing_(height|width|light|water|attributes)/.test(warnings)) return true;
  if (!row.Green_Acres_Light_Requirement || !row.Green_Acres_Water_Needs || !row.Green_Acres_Attributes) return true;
  return false;
}

async function fetchProduct(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'GardenPlannerDataEnricher/1.0 (+local user script)',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

if (!fs.existsSync(catalogPath)) {
  console.error(`Missing ${catalogPath}`);
  process.exit(1);
}

const rowsRaw = parseCSV(fs.readFileSync(catalogPath, 'utf8'));
const headers = rowsRaw[0].map(h => h.trim());
const rows = rowsToObjects(rowsRaw);
const targets = rows.filter(row => row.Green_Acres_URL && shouldFetch(row)).slice(0, limit > 0 ? limit : undefined);
const report = [];
let fetched = 0;
let productsFound = 0;
let changedRows = 0;
const changedByField = {};

console.log(`Green Acres BIS enrichment`);
console.log(`Targets: ${targets.length}${limit ? ` (limit ${limit})` : ''}`);
console.log(dryRun ? 'Mode: dry run, no files will be changed' : 'Mode: update public/green_acres_catalog.csv');

for (const [index, row] of targets.entries()) {
  const productUrl = normalizeUrl(row.Green_Acres_URL);
  const before = { ...row };
  const record = {
    Plant_ID: row.Plant_ID,
    Product_Name: row.Green_Acres_Product_Name || row.Common_Name,
    URL: productUrl,
    Status: '',
    Changed_Fields: '',
    Error: '',
  };
  try {
    if (delayMs && index > 0) await sleep(delayMs);
    const html = await fetchProduct(productUrl);
    fetched++;
    const product = parseBisProduct(html);
    if (!product) {
      record.Status = 'no_bis_product_found';
      report.push(record);
      continue;
    }
    productsFound++;
    const descriptionHtml = product.description || product.content || '';
    const plain = stripHtml(descriptionHtml);
    const changed = [];
    const setIfBlank = (field, value) => {
      const clean = String(value || '').trim();
      if (!clean) return;
      if (force || !String(row[field] || '').trim()) {
        if (row[field] !== clean) {
          row[field] = clean;
          changed.push(field);
          changedByField[field] = (changedByField[field] || 0) + 1;
        }
      }
    };

    setIfBlank('Green_Acres_Product_ID', product.id);
    setIfBlank('Green_Acres_Product_Handle', product.handle);
    setIfBlank('Green_Acres_Product_Name', product.title);
    setIfBlank('Green_Acres_URL', `https://idiggreenacres.com/products/${product.handle}`);
    setIfBlank('Green_Acres_Image_URL', imageUrl(product));
    setIfBlank('Green_Acres_Variants', tagsToVariants(product));
    if (product.price_min || product.price) {
      const min = Number(product.price_min || product.price);
      const max = Number(product.price_max || product.price_min || product.price);
      const priceText = min === max ? `$${(min / 100).toFixed(2)}` : `$${(min / 100).toFixed(2)}-$${(max / 100).toFixed(2)}`;
      setIfBlank('Green_Acres_Price_Text', priceText);
    }

    const tags = Array.isArray(product.tags) ? product.tags.map(String) : [];
    if (tags.length) {
      const merged = dedupe([...splitList(row.Green_Acres_Tags), ...tags]).join('; ');
      if (merged !== row.Green_Acres_Tags) {
        row.Green_Acres_Tags = merged;
        changed.push('Green_Acres_Tags');
        changedByField.Green_Acres_Tags = (changedByField.Green_Acres_Tags || 0) + 1;
      }
    }

    const size = extractCharacteristic(descriptionHtml, 'Size');
    const light = extractCharacteristic(descriptionHtml, 'Light Requirement');
    const water = extractCharacteristic(descriptionHtml, 'Water Needs');
    const growthHabit = extractCharacteristic(descriptionHtml, 'Growth Habit');
    const growthRate = extractCharacteristic(descriptionHtml, 'Growth Rate');
    const usda = extractCharacteristic(descriptionHtml, 'USDA Zone') || extractCharacteristic(descriptionHtml, 'USDA Zones');
    const landscapeUse = extractCharacteristic(descriptionHtml, 'Landscape Use') || extractCharacteristic(descriptionHtml, 'Landscape Uses');
    const foliage = extractCharacteristic(descriptionHtml, 'Foliage Color');
    const flower = extractCharacteristic(descriptionHtml, 'Flower Color');
    const bloom = extractCharacteristic(descriptionHtml, 'Bloom Time') || extractCharacteristic(descriptionHtml, 'Bloom Season');

    const sizeText = size ? parseSizeFromText(size) : '';
    setIfBlank('Green_Acres_Page_Size_Text', sizeText);
    setIfBlank('Green_Acres_Landscape_Size_Text', sizeText);
    for (const tag of sizeTagsFromSizeText(sizeText)) {
      row.Green_Acres_Tags = dedupe([...splitList(row.Green_Acres_Tags), tag]).join('; ');
    }

    addTagValue(row, 'Green_Acres_Light_Requirement', 'Light Requirement_', light);
    addTagValue(row, 'Green_Acres_Water_Needs', 'Water Requirement_', water);
    addTagValue(row, 'Green_Acres_Growth_Habit', 'Growth Habit_', growthHabit);
    addTagValue(row, 'Green_Acres_Growth_Rate', 'Growth Rate_', growthRate);
    addTagValue(row, 'Green_Acres_USDA_Zone', 'USDA Zone_', usda);
    addTagValue(row, 'Green_Acres_Landscape_Uses', 'Landscape Use_', landscapeUse);
    addTagValue(row, 'Green_Acres_Foliage_Color', 'Foliage Color_', foliage);
    addTagValue(row, 'Green_Acres_Flower_Color', 'Flower Color_', flower);
    if (bloom) row.Green_Acres_Tags = dedupe([...splitList(row.Green_Acres_Tags), `Bloom_${bloom}`]).join('; ');

    const attrs = deriveAttributes(product, plain);
    if (attrs.length) {
      row.Green_Acres_Attributes = mergeList(row.Green_Acres_Attributes, attrs);
      row.Green_Acres_Tags = dedupe([...splitList(row.Green_Acres_Tags), ...attrs.map(a => `Attributes_${a}`)]).join('; ');
    }

    row.Green_Acres_Page_Last_Crawled = new Date().toISOString();
    row.Green_Acres_Notes = dedupe([...splitList(row.Green_Acres_Notes.replaceAll(' | ', '; ')), `BIS product enriched ${new Date().toISOString()}`]).join(' | ');

    for (const field of Object.keys(row)) {
      if (row[field] !== before[field] && !changed.includes(field)) {
        changed.push(field);
        changedByField[field] = (changedByField[field] || 0) + 1;
      }
    }

    if (changed.length) changedRows++;
    record.Status = changed.length ? 'updated' : 'no_change';
    record.Changed_Fields = dedupe(changed).join('; ');
  } catch (error) {
    record.Status = 'error';
    record.Error = error?.message || String(error);
  }
  report.push(record);
  console.log(`[${index + 1}/${targets.length}] ${record.Status}: ${record.Product_Name}`);
}

if (!dryRun) {
  writeCSV(catalogPath, headers, rows);
  writeCSV(reportPath, ['Plant_ID','Product_Name','URL','Status','Changed_Fields','Error'], report);
  fs.writeFileSync(summaryPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    targets: targets.length,
    fetched,
    productsFound,
    changedRows,
    changedByField,
    dryRun,
    outputs: ['public/green_acres_catalog.csv', 'public/green_acres_bis_enrichment_report.csv', 'public/green_acres_bis_enrichment_summary.json'],
  }, null, 2) + '\n', 'utf8');
}

console.log(JSON.stringify({ targets: targets.length, fetched, productsFound, changedRows, changedByField, dryRun }, null, 2));
