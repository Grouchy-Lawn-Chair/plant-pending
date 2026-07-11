#!/usr/bin/env node
/**
 * Enrich plants_with_green_acres.csv with Green_Acres_Image_URL values.
 *
 * Run from the project folder:
 *   node scripts/enrich-green-acres-images.mjs
 *
 * This fetches each existing Green_Acres_URL, looks for common Shopify image
 * locations (og:image, twitter:image, product JSON-LD), and writes the
 * hotlinked image URL back to public/plants_with_green_acres.csv.
 *
 * It does not download or bundle Green Acres images.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const CSV_PATH = path.resolve('public', 'plants_with_green_acres.csv');
const DELAY_MS = 450;

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
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
      cur = '';
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  if (row.some(v => v.trim() !== '')) rows.push(row);
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

function getMetaImage(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return normalizeImageUrl(match[1]);
  }
  return null;
}

function normalizeImageUrl(url) {
  if (!url) return null;
  let clean = url.replace(/&amp;/g, '&').trim();
  if (clean.startsWith('//')) clean = `https:${clean}`;
  return clean;
}

function findProductImage(html) {
  return (
    getMetaImage(html, 'og:image:secure_url') ||
    getMetaImage(html, 'og:image') ||
    getMetaImage(html, 'twitter:image') ||
    normalizeImageUrl(html.match(/"featured_image"\s*:\s*"([^"]+)"/)?.[1]?.replace(/\\\//g, '/')) ||
    normalizeImageUrl(html.match(/"image"\s*:\s*\[\s*"([^"]+)"/)?.[1]?.replace(/\\\//g, '/')) ||
    normalizeImageUrl(html.match(/"image"\s*:\s*"([^"]+)"/)?.[1]?.replace(/\\\//g, '/')) ||
    null
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const text = await fs.readFile(CSV_PATH, 'utf8');
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV has no data rows.');

  const headers = [...rows[0]];
  if (!headers.includes('Green_Acres_Image_URL')) {
    const insertAt = headers.includes('Green_Acres_Price_Text')
      ? headers.indexOf('Green_Acres_Price_Text') + 1
      : headers.length;
    headers.splice(insertAt, 0, 'Green_Acres_Image_URL');
  }

  const records = rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
  let updated = 0;
  let failed = 0;

  for (const record of records) {
    const productUrl = record.Green_Acres_URL;
    if (!productUrl || record.Green_Acres_Image_URL) continue;

    try {
      console.log(`Fetching ${record.Common_Name || record.Botanical_Name}: ${productUrl}`);
      const response = await fetch(productUrl, {
        headers: {
          'user-agent': 'Mozilla/5.0 GardenPlanner personal catalog snapshot',
          'accept': 'text/html,application/xhtml+xml',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const image = findProductImage(html);
      if (image) {
        record.Green_Acres_Image_URL = image;
        updated++;
        console.log(`  image: ${image}`);
      } else {
        failed++;
        console.log('  no image found');
      }
    } catch (err) {
      failed++;
      console.warn(`  failed: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  await fs.writeFile(CSV_PATH, writeCsv(headers, records), 'utf8');
  console.log(`Done. Added ${updated} image URLs. Failed/no image: ${failed}.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
