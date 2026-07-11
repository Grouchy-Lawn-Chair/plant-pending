#!/usr/bin/env node
/**
 * Enrich Green Acres catalog product details.
 *
 * This script is intentionally conservative. It reads public/plants_with_green_acres.csv,
 * fetches missing Green Acres product pages, and writes details back into the CSV.
 *
 * It fills what it can find from the product page HTML:
 * - Green_Acres_Product_Name
 * - Green_Acres_Price_Text
 * - Green_Acres_Image_URL if missing
 * - Green_Acres_Notes with a fetched timestamp
 *
 * Mature height/width extraction is best-effort because product pages do not all use
 * the same wording. The parser looks for common patterns such as:
 * "Mature Size: 3 ft. tall x 4 ft. wide"
 * "Height: 3-5 ft." and "Width: 4-6 ft."
 *
 * Run:
 *   node scripts/enrich-green-acres-catalog-details.mjs --limit 25
 *   node scripts/enrich-green-acres-catalog-details.mjs
 */

import fs from 'node:fs/promises';

const DEFAULT_CSV_PATHS = ['./public/green_acres_catalog.csv', './public/plants_with_green_acres.csv'];
const BASE_DELAY_MS = 2200;
const JITTER_MS = 1600;
const MAX_RETRIES = 2;

const args = process.argv.slice(2);
const options = {
  limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : null,
  force: args.includes('--force'),
  missingSizeOnly: args.includes('--missing-size'),
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function nextDelay() {
  return BASE_DELAY_MS + Math.floor(Math.random() * JITTER_MS);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (q && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
    } else if (ch === ',' && !q) {
      row.push(cur);
      cur = '';
    } else if ((ch === '\n' || ch === '\r') && !q) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      if (row.some(v => String(v).trim() !== '')) rows.push(row);
      row = [];
      cur = '';
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  if (row.some(v => String(v).trim() !== '')) rows.push(row);
  return rows;
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(headers, records) {
  return [
    headers.map(csvEscape).join(','),
    ...records.map(row => headers.map(h => csvEscape(row[h] ?? '')).join(',')),
  ].join('\n');
}

function textFromHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
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
    if (match?.[1]) return match[1].replace(/&amp;/g, '&').trim();
  }
  return '';
}

function cleanTitle(title) {
  return String(title || '')
    .replace(/\s*[-|]\s*Green Acres Nursery.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPrice(html) {
  const candidates = [
    html.match(/"price"\s*:\s*"?(\d+(?:\.\d+)?)"?/i)?.[1],
    html.match(/\$\s*(\d+(?:\.\d{2})?)/)?.[1],
  ].filter(Boolean);
  if (!candidates.length) return '';
  let price = candidates[0];
  if (/^\d+$/.test(price) && price.length > 2) {
    price = `${price.slice(0, -2)}.${price.slice(-2)}`;
  }
  return `$${price}`;
}

function normalizeFeet(value, unit) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return '';
  const u = String(unit || '').toLowerCase();
  if (u.startsWith('in')) return String(Math.round((n / 12) * 10) / 10);
  return String(n);
}

function extractSizeFields(text) {
  const result = {
    height: '',
    width: '',
    fullSize: '',
  };

  const height = text.match(/(?:height|tall)\s*:?\s*(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(ft|feet|in|inch|inches)?/i);
  const width = text.match(/(?:width|wide|spread)\s*:?\s*(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(ft|feet|in|inch|inches)?/i);
  const mature = text.match(/mature\s+(?:size|height|plant size)\s*:?\s*([^.;]{0,120})/i);

  if (height) {
    result.height = normalizeFeet(height[2] || height[1], height[3] || 'ft');
  }
  if (width) {
    result.width = normalizeFeet(width[2] || width[1], width[3] || 'ft');
  }
  if (mature) {
    result.fullSize = mature[1].trim();
  }

  return result;
}

async function fetchWithRetry(url) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'GardenPlanner personal local catalog updater',
        'accept': 'text/html,application/xhtml+xml',
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

async function main() {
  let csvPath = DEFAULT_CSV_PATHS[0];
  let content = '';
  for (const candidate of DEFAULT_CSV_PATHS) {
    try {
      content = await fs.readFile(candidate, 'utf8');
      csvPath = candidate;
      break;
    } catch {
      // Try the next known catalog filename.
    }
  }
  if (!content) throw new Error(`Could not find ${DEFAULT_CSV_PATHS.join(' or ')}`);
  const rows = parseCsv(content);
  const headers = [...rows[0]];

  for (const column of [
    'Green_Acres_Product_Name',
    'Green_Acres_Price_Text',
    'Mature_Height_ft_est',
    'Mature_Width_ft_est',
    'Full_Mature_Size_est',
    'Green_Acres_Notes',
  ]) {
    if (!headers.includes(column)) headers.push(column);
  }

  const records = rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
  const targets = records.filter(row => {
    if (!row.Green_Acres_URL) return false;
    if (options.force) return true;
    if (options.missingSizeOnly) return !row.Mature_Height_ft_est || !row.Mature_Width_ft_est;
    return !row.Green_Acres_Price_Text || !row.Mature_Height_ft_est || !row.Mature_Width_ft_est;
  });

  const todo = options.limit ? targets.slice(0, options.limit) : targets;
  console.log(`Using ${csvPath}`);
  console.log(`Enriching ${todo.length} products. Total missing/detail candidates: ${targets.length}.`);

  let done = 0;
  for (const row of todo) {
    console.log(`Fetching ${row.Common_Name}: ${row.Green_Acres_URL}`);
    try {
      const html = await fetchWithRetry(row.Green_Acres_URL);
      const text = textFromHtml(html);

      const title = cleanTitle(getMeta(html, 'og:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '');
      const price = extractPrice(html);
      const size = extractSizeFields(text);

      if (title) {
        row.Green_Acres_Product_Name = title;
        row.Common_Name = title;
      }
      if (price) row.Green_Acres_Price_Text = price;
      if (size.height) row.Mature_Height_ft_est = size.height;
      if (size.width) row.Mature_Width_ft_est = size.width;
      if (size.fullSize) row.Full_Mature_Size_est = size.fullSize;

      row.Green_Acres_Notes = `Product page enriched ${new Date().toISOString()}`;
      done++;

      await fs.writeFile(csvPath, writeCsv(headers, records), 'utf8');
    } catch (error) {
      console.warn(`  failed: ${error.message}`);
    }

    await sleep(nextDelay());
  }

  console.log(`Done. Enriched ${done} products.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
