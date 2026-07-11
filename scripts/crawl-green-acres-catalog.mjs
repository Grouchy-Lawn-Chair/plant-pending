#!/usr/bin/env node
/**
 * Full Green Acres catalog recrawler.
 *
 * Main use:
 *   npm run recrawl-green-acres -- --limit 25
 *   npm run recrawl-green-acres
 *
 * Targeted test:
 *   npm run recrawl-green-acres -- --search "Green Spire" --limit 1
 *
 * This recaptures Green Acres product data directly from the product page/Shopify JSON
 * and overwrites Green Acres-derived fields in public/green_acres_catalog.csv.
 *
 * It saves after every product. Close Excel before running because Excel locks CSV files.
 */

import fs from 'node:fs/promises';

const CSV_PATH = './public/green_acres_catalog.csv';
const BASE_DELAY_MS = 2800;
const JITTER_MS = 2200;
const MAX_RETRIES = 2;

const args = process.argv.slice(2);
const options = {
  limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : null,
  search: args.includes('--search') ? String(args[args.indexOf('--search') + 1] || '').toLowerCase() : '',
  keepGuesses: args.includes('--keep-guesses'),
};

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function nextDelay() { return BASE_DELAY_MS + Math.floor(Math.random() * JITTER_MS); }

function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (q && text[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (ch === ',' && !q) { row.push(cur); cur = ''; }
    else if ((ch === '\n' || ch === '\r') && !q) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      if (row.some(v => String(v).trim() !== '')) rows.push(row);
      row = []; cur = '';
    } else cur += ch;
  }
  row.push(cur);
  if (row.some(v => String(v).trim() !== '')) rows.push(row);
  return rows;
}
function csvEscape(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(headers, records) {
  return [headers.map(csvEscape).join(','), ...records.map(row => headers.map(h => csvEscape(row[h] ?? '')).join(','))].join('\n');
}
function addColumn(headers, col) {
  if (!headers.includes(col)) headers.push(col);
}
function decodeHtml(s) {
  return String(s || '')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
function textFromHtml(html) {
  return decodeHtml(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}
function cleanTitle(title) {
  return decodeHtml(title)
    .replace(/\s*[-|]\s*Green Acres Nursery.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function getMeta(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return '';
}
function getHandle(url) {
  try {
    const u = new URL(url);
    return u.pathname.match(/\/products\/([^/?#]+)/)?.[1] || '';
  } catch { return ''; }
}
function productJsUrl(url) {
  try {
    const u = new URL(url);
    const handle = getHandle(url);
    if (!handle) return '';
    return `${u.origin}/products/${handle}.js`;
  } catch { return ''; }
}
function absoluteUrl(url, base='https://idiggreenacres.com') {
  if (!url) return '';
  if (/^\/\//.test(url)) return `https:${url}`;
  if (/^https?:\/\//i.test(url)) return url;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}
function normalizePriceCents(value) {
  if (value == null || value === '') return '';
  let n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (n > 1000 && Number.isInteger(n)) n = n / 100;
  return `$${n.toFixed(2)}`;
}
function priceRange(product, html) {
  const prices = [];
  if (product?.price) prices.push(Number(product.price));
  for (const v of product?.variants || []) {
    if (v?.price) prices.push(Number(v.price));
  }
  const clean = prices.filter(n => Number.isFinite(n) && n > 0);
  if (clean.length) {
    const min = Math.min(...clean);
    const max = Math.max(...clean);
    return min === max ? normalizePriceCents(min) : `${normalizePriceCents(min)}-${normalizePriceCents(max)}`;
  }
  const jsonLdPrice = html.match(/"price"\s*:\s*"?(\d+(?:\.\d+)?)"?/i)?.[1];
  if (jsonLdPrice) return normalizePriceCents(jsonLdPrice);
  const visual = html.match(/\$\s*(\d+(?:\.\d{2})?)/)?.[1];
  return visual ? `$${visual}` : '';
}
function unitName(unit) {
  const u = String(unit || '').toLowerCase().trim();
  if (u === '"' || u.startsWith('in')) return 'in';
  if (u === "'" || u.startsWith('ft')) return 'ft';
  return '';
}
function normalizeFeet(value, unit) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return '';
  const feet = unitName(unit) === 'in' ? n / 12 : n;
  return String(Math.round(feet * 10) / 10);
}
function maxRange(a, aUnit, b, bUnit) {
  const resolvedUnit = unitName(bUnit) || unitName(aUnit) || 'ft';
  return normalizeFeet(b || a, resolvedUnit);
}
function parseMatureSizeFromSource(source) {
  const text = decodeHtml(source)
    .replace(/[–—]/g, '-')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\bfeet\b|\bfoot\b/gi, 'ft')
    .replace(/\binches\b|\binch\b/gi, 'in')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;

  const num = String.raw`(\d+(?:\.\d+)?)`;
  const optUnit = String.raw`\s*(ft|in|['"])?`;
  const join = String.raw`\s*(?:-|to)\s*`;
  const pattern = new RegExp(
    String.raw`(?:landscape\s+size|mature\s+size|size)\s*:?\s*` +
    num + optUnit + String.raw`(?:` + join + num + optUnit + String.raw`)?\s*` +
    String.raw`(?:tall|high|h)\b[\s,;xX-]*` +
    num + optUnit + String.raw`(?:` + join + num + optUnit + String.raw`)?\s*` +
    String.raw`(?:wide|w|spread|width)\b`,
    'i'
  );
  const match = text.match(pattern);
  if (!match) return null;

  const height = maxRange(match[1], match[2], match[3], match[4]);
  const width = maxRange(match[5], match[6], match[7], match[8]);
  if (!height || !width) return null;
  return {
    height,
    width,
    fullSize: `${height}' H x ${width}' W`,
    source: match[0].trim(),
  };
}
function parseSize(text, tags = []) {
  const result = { height: '', width: '', fullSize: '', source: '' };
  const parsed = parseMatureSizeFromSource(text);
  if (parsed) return parsed;

  const allTags = tags.join(' ');
  const tagHeight = allTags.match(/Height[_\s-]*(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*ft/i);
  const tagWidth = allTags.match(/Width[_\s-]*(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*ft/i);
  if (tagHeight) result.height = maxRange(tagHeight[1], 'ft', tagHeight[2], 'ft');
  if (tagWidth) result.width = maxRange(tagWidth[1], 'ft', tagWidth[2], 'ft');
  if (result.height && result.width) {
    result.fullSize = `${result.height}' H x ${result.width}' W`;
    result.source = `${tagHeight?.[0] || ''}; ${tagWidth?.[0] || ''}`;
  }
  return result;
}
function extractBotanical(product, text, title) {
  const vendor = decodeHtml(product?.vendor || '');
  if (vendor && /[a-z]+\s+[a-z]+/i.test(vendor) && !/green acres/i.test(vendor)) return vendor;
  const candidates = [
    text.match(/Botanical Name\s*:?\s*([^|.;]{3,100})/i)?.[1],
    text.match(/Scientific Name\s*:?\s*([^|.;]{3,100})/i)?.[1],
    title.match(/\(([^)]{5,100})\)/)?.[1],
  ].filter(Boolean);
  return candidates.length ? decodeHtml(candidates[0]) : '';
}
function tagValue(tags, prefix) {
  const found = tags.find(t => t.toLowerCase().startsWith(prefix.toLowerCase()));
  return found ? found.slice(prefix.length).replace(/^[_:\s-]+/, '').trim() : '';
}
function tagValues(tags, prefix) {
  return tags
    .filter(t => t.toLowerCase().startsWith(prefix.toLowerCase()))
    .map(t => t.slice(prefix.length).replace(/^[_:\s-]+/, '').trim())
    .filter(Boolean);
}
function yesNoFromTags(tags, value) {
  return tags.some(t => t.toLowerCase().includes(value.toLowerCase())) ? 'TRUE' : '';
}
async function fetchText(url, accept='text/html,application/xhtml+xml') {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'GardenPlanner local personal catalog updater',
        'accept': accept,
      },
    });
    if (response.ok) return await response.text();
    if ([429, 500, 502, 503, 504].includes(response.status) && attempt < MAX_RETRIES) {
      const wait = 30000 + Math.floor(Math.random() * 60000);
      console.warn(`  HTTP ${response.status}. Waiting ${Math.round(wait / 1000)}s before retry.`);
      await sleep(wait);
      continue;
    }
    throw new Error(`HTTP ${response.status}`);
  }
}
async function saveCsv(headers, records) {
  try {
    await fs.writeFile(CSV_PATH, writeCsv(headers, records), 'utf8');
  } catch (error) {
    if (error.code === 'EBUSY') {
      console.error(`\nCSV is locked. Close Excel/preview panes and rerun. Path: ${CSV_PATH}\n`);
    }
    throw error;
  }
}
function appendNote(row, note) {
  const existing = row.Green_Acres_Notes || '';
  if (!existing.includes(note)) row.Green_Acres_Notes = `${existing}${existing ? ' | ' : ''}${note}`;
}

async function main() {
  const content = await fs.readFile(CSV_PATH, 'utf8');
  const rows = parseCsv(content);
  const headers = [...rows[0]];

  const columns = [
    'Green_Acres_Product_Name',
    'Green_Acres_Botanical_Name',
    'Green_Acres_Price_Text',
    'Green_Acres_Image_URL',
    'Green_Acres_Source_Categories',
    'Green_Acres_Variants',
    'Green_Acres_Product_Handle',
    'Green_Acres_Product_ID',
    'Green_Acres_Tags',
    'Green_Acres_Landscape_Size_Text',
    'Green_Acres_Light_Requirement',
    'Green_Acres_Water_Needs',
    'Green_Acres_USDA_Zone',
    'Green_Acres_Growth_Habit',
    'Green_Acres_Growth_Rate',
    'Green_Acres_Attributes',
    'Green_Acres_Landscape_Uses',
    'Green_Acres_Foliage_Color',
    'Green_Acres_Flower_Color',
    'Green_Acres_Available_In',
    'Green_Acres_Page_Last_Crawled',
    'Green_Acres_Page_Size_Text',
    'Green_Acres_Size_Parse_Source',
    'Green_Acres_Size_Unit_Fixed',
    'Green_Acres_Product_JSON_Source',
    'Green_Acres_Product_Description_HTML_Source',
    'Green_Acres_Notes',
    'Mature_Height_ft_est',
    'Mature_Width_ft_est',
    'Full_Mature_Size_est',
    'Minimum_Spacing_ft_est',
    'Estimate_Confidence',
    'Waterwise_1_low_10_high',
    'Maintenance_Ease_1_hard_10_easy',
    'Evergreen_Est',
    'Plant_Form_Est',
  ];
  for (const col of columns) addColumn(headers, col);

  const records = rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
  const candidates = records.filter(row => {
    if (!row.Green_Acres_URL) return false;
    if (options.search) {
      const haystack = [
        row.Common_Name,
        row.Botanical_Name,
        row.Green_Acres_Product_Name,
        row.Green_Acres_Botanical_Name,
        row.Green_Acres_Product_Handle,
        row.Green_Acres_URL,
      ].join(' ').toLowerCase();
      if (!haystack.includes(options.search)) return false;
    }
    return true;
  });
  const todo = options.limit ? candidates.slice(0, options.limit) : candidates;
  console.log(`Recrawling ${todo.length} products. Total candidates: ${candidates.length}.`);

  let done = 0, sizeFound = 0;
  for (const row of todo) {
    console.log(`Fetching ${row.Common_Name}: ${row.Green_Acres_URL}`);
    try {
      const html = await fetchText(row.Green_Acres_URL);
      const jsUrl = productJsUrl(row.Green_Acres_URL);
      let product = null;
      if (jsUrl) {
        try { product = JSON.parse(await fetchText(jsUrl, 'application/json,text/plain,*/*')); }
        catch (error) { console.warn(`  product JSON unavailable: ${error.message}`); }
      }

      const tags = Array.isArray(product?.tags) ? product.tags.map(String) : [];
      const pageText = textFromHtml(html);
      const productDescriptionHtml = decodeHtml(product?.description || product?.content || '');
      const productDescription = productDescriptionHtml;
      const productText = textFromHtml(productDescription);
      const combinedText = `${pageText} ${productText} ${tags.join(' ')}`;

      const title = cleanTitle(product?.title || getMeta(html, 'og:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || row.Common_Name || '');
      const botanical = extractBotanical(product, combinedText, title);
      const price = priceRange(product, html);
      const image = absoluteUrl(product?.featured_image || product?.images?.[0] || getMeta(html, 'og:image'));
      const size = parseSize(combinedText, tags);

      if (product) row.Green_Acres_Product_JSON_Source = JSON.stringify(product);
      if (productDescriptionHtml) row.Green_Acres_Product_Description_HTML_Source = productDescriptionHtml;

      const variants = (product?.variants || [])
        .map(v => `${v.title || v.option1 || ''}${v.price ? ` ${normalizePriceCents(v.price)}` : ''}`.trim())
        .filter(Boolean)
        .join('; ');

      row.Green_Acres_Product_ID = product?.id || row.Green_Acres_Product_ID || '';
      row.Green_Acres_Product_Handle = product?.handle || getHandle(row.Green_Acres_URL) || row.Green_Acres_Product_Handle || '';
      if (title) {
        row.Green_Acres_Product_Name = title;
        row.Common_Name = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
      }
      if (botanical) {
        row.Green_Acres_Botanical_Name = botanical;
        row.Botanical_Name = botanical;
      }
      if (price) row.Green_Acres_Price_Text = price;
      if (image && !String(image).includes('no-image')) row.Green_Acres_Image_URL = image;
      if (product?.type) row.Green_Acres_Source_Categories = product.type;
      if (variants) row.Green_Acres_Variants = variants;
      if (tags.length) row.Green_Acres_Tags = tags.join('; ');

      row.Green_Acres_Light_Requirement = tagValue(tags, 'Light Requirement') || row.Green_Acres_Light_Requirement || '';
      row.Green_Acres_Water_Needs = tagValue(tags, 'Water Requirement') || tagValue(tags, 'Water Needs') || row.Green_Acres_Water_Needs || '';
      row.Green_Acres_Growth_Habit = tagValue(tags, 'Growth Habit') || row.Green_Acres_Growth_Habit || '';
      row.Green_Acres_Growth_Rate = tagValue(tags, 'Growth Rate') || row.Green_Acres_Growth_Rate || '';
      row.Green_Acres_Foliage_Color = tagValue(tags, 'Foliage Color') || row.Green_Acres_Foliage_Color || '';
      row.Green_Acres_Flower_Color = tagValue(tags, 'Flower Color') || row.Green_Acres_Flower_Color || '';
      row.Green_Acres_Attributes = tagValues(tags, 'Attributes').join('; ') || row.Green_Acres_Attributes || '';
      row.Green_Acres_Landscape_Uses = tagValues(tags, 'Landscape Use').join('; ') || row.Green_Acres_Landscape_Uses || '';
      row.Green_Acres_Available_In = tagValues(tags, 'Available in Store').join('; ') || row.Green_Acres_Available_In || '';
      row.Green_Acres_USDA_Zone = tagValues(tags, 'USDA Zone').join('; ') || row.Green_Acres_USDA_Zone || '';

      if (/evergreen/i.test(row.Green_Acres_Attributes || tags.join(' '))) row.Evergreen_Est = 'TRUE';
      if (row.Green_Acres_Water_Needs) {
        const w = row.Green_Acres_Water_Needs.toLowerCase();
        if (w.includes('low')) row.Waterwise_1_low_10_high = '8';
        if (w.includes('moderate')) row.Waterwise_1_low_10_high = '6';
        if (w.includes('high')) row.Waterwise_1_low_10_high = '3';
      }
      if (/easy care/i.test(row.Green_Acres_Attributes || tags.join(' '))) row.Maintenance_Ease_1_hard_10_easy = '8';
      if (row.Green_Acres_Growth_Habit) row.Plant_Form_Est = row.Green_Acres_Growth_Habit.toLowerCase();

      if (size.height && size.width) {
        row.Mature_Height_ft_est = size.height;
        row.Mature_Width_ft_est = size.width;
        row.Full_Mature_Size_est = size.fullSize;
        row.Minimum_Spacing_ft_est = String(Math.round(Number(size.width) * 0.75 * 10) / 10);
        row.Estimate_Confidence = 'Green Acres page parsed';
        row.Green_Acres_Page_Size_Text = size.source;
        row.Green_Acres_Landscape_Size_Text = size.source;
        row.Green_Acres_Size_Parse_Source = size.source;
        row.Green_Acres_Size_Unit_Fixed = size.source.includes('\"') || /\bin\b/i.test(size.source) ? 'TRUE' : '';
        sizeFound++;
      } else if (!options.keepGuesses) {
        // Keep current guesstimates in mature fields so the app still works,
        // but mark confidence honestly.
        if (/guesstimate|estimate/i.test(row.Estimate_Confidence || '')) {
          row.Estimate_Confidence = row.Estimate_Confidence;
        } else {
          row.Estimate_Confidence = row.Estimate_Confidence || 'Unverified local estimate';
        }
      }

      row.Green_Acres_Page_Last_Crawled = new Date().toISOString();
      appendNote(row, 'Green Acres product recrawled.');
      done++;
      await saveCsv(headers, records);
    } catch (error) {
      console.warn(`  failed: ${error.message}`);
      appendNote(row, `Recrawl failed ${new Date().toISOString()}: ${error.message}`);
      await saveCsv(headers, records);
    }
    await sleep(nextDelay());
  }

  console.log(`Done. Recrawled ${done} products. Parsed size for ${sizeFound}.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
