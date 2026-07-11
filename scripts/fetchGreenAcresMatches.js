#!/usr/bin/env node
/**
 * Green Acres catalog matcher
 *
 * Reads the richest local plant CSV, searches the Green Acres website catalog,
 * and writes public/plants_with_green_acres.csv. This is a planning aid only.
 * Live-goods availability changes, so always call the store to confirm stock.
 *
 * Usage:
 *   npm run fetch-green-acres
 *   npm run fetch-green-acres -- --limit 25
 *   npm run fetch-green-acres -- --dry-run --plant-id 10
 *   npm run fetch-green-acres -- --force
 */

import fs from 'fs';

const CONFIG = {
  inputCandidates: [
    './public/plants_with_images.csv',
    './public/plants.csv',
  ],
  outputCsvPath: './public/plants_with_green_acres.csv',
  baseUrl: 'https://idiggreenacres.com',
  rateLimitDelay: 700,
  maxRetries: 3,
  userAgent: 'GardenPlanner/1.0 catalog matcher',
};

const args = process.argv.slice(2);
const options = {
  limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : null,
  plantId: args.includes('--plant-id') ? String(parseInt(args[args.indexOf('--plant-id') + 1], 10)) : null,
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  help: args.includes('--help') || args.includes('-h'),
};

if (options.help) {
  console.log(`
Green Acres catalog matcher

Options:
  --limit N       Only check first N plants needing a match
  --plant-id N    Only check one plant ID
  --dry-run       Show what would be checked without writing a CSV
  --force         Re-check plants that already have a match status
  --help          Show this message
`);
  process.exit(0);
}

function parseCSVRows(text) {
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
      row.push(current.trim());
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(current.trim());
      current = '';
      if (row.some(value => String(value).trim() !== '')) rows.push(row);
      row = [];
    } else {
      current += char;
    }
  }

  row.push(current.trim());
  if (row.some(value => String(value).trim() !== '')) rows.push(row);
  return rows;
}

function createCSVLine(values) {
  return values.map(value => {
    // Keep generated CSV one physical line per plant. Some upstream image
    // credits contain line breaks, which break simpler CSV readers/scripts.
    const str = String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }).join(',');
}

function pickInputCsv() {
  for (const candidate of CONFIG.inputCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Could not find public/plants_with_images.csv or public/plants.csv');
}

function loadCSV() {
  const inputPath = pickInputCsv();
  const content = fs.readFileSync(inputPath, 'utf-8');
  const parsedRows = parseCSVRows(content);
  const headers = parsedRows[0] || [];
  const rows = parsedRows.slice(1).map(values => {
    const row = {};
    headers.forEach((h, i) => row[h] = values[i] ?? '');
    return row;
  }).filter(row => /^\d+$/.test(String(row.Plant_ID || '').trim()));
  return { inputPath, headers, rows };
}

const GREEN_ACRES_COLUMNS = [
  'Green_Acres_Match',
  'Green_Acres_Product_Name',
  'Green_Acres_Botanical_Name',
  'Green_Acres_URL',
  'Green_Acres_Price_Text',
  'Green_Acres_Match_Confidence',
  'Green_Acres_Last_Checked',
  'Green_Acres_Notes',
];

function ensureColumns(headers) {
  const output = [...headers];
  for (const column of GREEN_ACRES_COLUMNS) {
    if (!output.includes(column)) output.push(column);
  }
  return output;
}

function saveCSV(headers, rows) {
  const outputHeaders = ensureColumns(headers);
  const lines = [createCSVLine(outputHeaders)];
  for (const row of rows) {
    lines.push(createCSVLine(outputHeaders.map(h => row[h] ?? '')));
  }
  fs.writeFileSync(CONFIG.outputCsvPath, lines.join('\n') + '\n', 'utf-8');
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, fetchOptions = {}, retries = CONFIG.maxRetries) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'User-Agent': CONFIG.userAgent,
          'Accept': 'application/json,text/html;q=0.9,*/*;q=0.8',
          ...(fetchOptions.headers || {}),
        },
      });
      if (!response.ok) {
        if (response.status === 429) {
          await delay(2500 * (i + 1));
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      await delay(CONFIG.rateLimitDelay * (i + 1));
    }
  }
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[™®]/g, '')
    .replace(/['’`]/g, '')
    .replace(/\b(var|ssp|subsp|cv)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(value) {
  return normalizeName(value).split(' ').filter(Boolean);
}

function nameScore(queryName, productTitle) {
  const q = normalizeName(queryName);
  const t = normalizeName(productTitle);
  if (!q || !t) return 0;
  if (q === t) return 100;
  if (t.includes(q) || q.includes(t)) return 90;

  const qWords = words(q);
  const tWords = new Set(words(t));
  if (qWords.length === 0) return 0;
  const overlap = qWords.filter(w => tWords.has(w)).length;
  return Math.round((overlap / qWords.length) * 80);
}

function productFromPredictive(raw) {
  const title = raw.title || raw.text || raw.name || '';
  const url = raw.url || raw.handle ? `${CONFIG.baseUrl}${raw.url || `/products/${raw.handle}`}` : '';
  const priceText = raw.price || raw.price_min || raw.compare_at_price ? String(raw.price || raw.price_min || raw.compare_at_price) : '';
  return { title, url, priceText };
}

async function searchPredictive(query) {
  const url = `${CONFIG.baseUrl}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=8`;
  const res = await fetchWithRetry(url);
  const data = await res.json();
  const products = data?.resources?.results?.products || [];
  return products.map(productFromPredictive).filter(p => p.title);
}

async function searchHtml(query) {
  const url = `${CONFIG.baseUrl}/search?q=${encodeURIComponent(query)}&type=product`;
  const res = await fetchWithRetry(url, { headers: { Accept: 'text/html' } });
  const html = await res.text();
  const results = [];
  const linkRegex = /<a[^>]+href="([^"]*\/products\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) && results.length < 10) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const fullUrl = href.startsWith('http') ? href : `${CONFIG.baseUrl}${href}`;
    results.push({ title: text, url: fullUrl, priceText: '' });
  }
  return results;
}

function bestMatch(products, botanicalName, commonName) {
  let best = null;
  for (const product of products) {
    const botScore = nameScore(botanicalName, product.title);
    const commonScore = nameScore(commonName, product.title);
    const score = Math.max(botScore, commonScore);
    const confidence = score >= 90 ? 'high' : score >= 65 ? 'possible' : 'low';
    if (!best || score > best.score) {
      best = { ...product, score, confidence, botanicalScore: botScore, commonScore };
    }
  }
  if (!best || best.score < 65) return null;
  return best;
}

async function searchGreenAcres(row) {
  const botanicalName = row.Botanical_Name || '';
  const commonName = row.Common_Name || '';
  const queries = [botanicalName, commonName].filter(Boolean);

  const allProducts = [];
  for (const query of queries) {
    try {
      const predictive = await searchPredictive(query);
      allProducts.push(...predictive);
    } catch (err) {
      // Predictive search can be blocked or absent on some Shopify themes, use HTML fallback.
    }

    if (allProducts.length === 0) {
      try {
        const htmlResults = await searchHtml(query);
        allProducts.push(...htmlResults);
      } catch (err) {
        // Ignore and try the next query.
      }
    }

    const match = bestMatch(allProducts, botanicalName, commonName);
    if (match) return match;
    await delay(CONFIG.rateLimitDelay);
  }

  return null;
}

async function main() {
  console.log('Green Acres Catalog Matcher\n');
  const { inputPath, headers, rows } = loadCSV();
  console.log(`Loaded ${rows.length} plants from ${inputPath}\n`);

  let rowsToProcess = rows.filter(row => {
    if (options.force) return true;
    return !row.Green_Acres_Match && !row.Green_Acres_Match_Confidence;
  });

  if (options.plantId) {
    rowsToProcess = rowsToProcess.filter(row => String(row.Plant_ID) === options.plantId);
  } else if (options.limit) {
    rowsToProcess = rowsToProcess.slice(0, options.limit);
  }

  console.log(`Processing ${rowsToProcess.length} plants...`);
  if (options.dryRun) console.log('DRY RUN, no CSV will be written');
  console.log('');

  let matched = 0;
  let possible = 0;
  let noMatch = 0;
  let failed = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const row of rowsToProcess) {
    const plantId = row.Plant_ID;
    const botanicalName = row.Botanical_Name || '';
    const commonName = row.Common_Name || '';
    console.log(`[${plantId}] ${botanicalName}${commonName ? ` (${commonName})` : ''}`);

    if (options.dryRun) {
      console.log('  Would search Green Acres catalog...\n');
      continue;
    }

    try {
      const match = await searchGreenAcres(row);
      const rowIndex = rows.findIndex(r => String(r.Plant_ID) === String(plantId));
      if (rowIndex < 0) continue;

      if (match) {
        rows[rowIndex].Green_Acres_Match = 'TRUE';
        rows[rowIndex].Green_Acres_Product_Name = match.title;
        rows[rowIndex].Green_Acres_Botanical_Name = '';
        rows[rowIndex].Green_Acres_URL = match.url;
        rows[rowIndex].Green_Acres_Price_Text = match.priceText || '';
        rows[rowIndex].Green_Acres_Match_Confidence = match.confidence;
        rows[rowIndex].Green_Acres_Last_Checked = today;
        rows[rowIndex].Green_Acres_Notes = 'Catalog/planning match only. Call your local Green Acres store to confirm current live-goods inventory.';
        if (match.confidence === 'high') matched++; else possible++;
        console.log(`  Match: ${match.title} (${match.confidence})`);
        if (match.url) console.log(`  URL: ${match.url}`);
      } else {
        rows[rowIndex].Green_Acres_Match = 'FALSE';
        rows[rowIndex].Green_Acres_Product_Name = '';
        rows[rowIndex].Green_Acres_Botanical_Name = '';
        rows[rowIndex].Green_Acres_URL = '';
        rows[rowIndex].Green_Acres_Price_Text = '';
        rows[rowIndex].Green_Acres_Match_Confidence = 'none';
        rows[rowIndex].Green_Acres_Last_Checked = today;
        rows[rowIndex].Green_Acres_Notes = 'No catalog match found. This does not prove the plant is unavailable. Call store to confirm.';
        noMatch++;
        console.log('  No catalog match found');
      }
    } catch (err) {
      failed++;
      console.log(`  Failed: ${err.message}`);
    }

    console.log('');
    await delay(CONFIG.rateLimitDelay);
  }

  if (!options.dryRun) {
    saveCSV(headers, rows);
    console.log(`CSV written to ${CONFIG.outputCsvPath}\n`);
  }

  console.log('Summary:');
  console.log(`  High-confidence matches: ${matched}`);
  console.log(`  Possible matches:        ${possible}`);
  console.log(`  No match found:          ${noMatch}`);
  console.log(`  Failed:                  ${failed}`);
  console.log(`  Total checked:           ${rowsToProcess.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
