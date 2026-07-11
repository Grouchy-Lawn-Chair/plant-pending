#!/usr/bin/env node
/**
 * Assign plan icon colors to Green Acres matched plants.
 *
 * Run after updating Green Acres matches or image URLs:
 *   node scripts/assign-plan-colors.mjs
 *
 * This does not change plant icons, only Plan_Symbol_Color.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const CSV_PATH = path.resolve('public', 'plants_with_green_acres.csv');

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

function isTrue(value) {
  return ['true', 'yes', '1', 'x'].includes(String(value || '').trim().toLowerCase());
}

function colorForPlant(row) {
  const name = `${row.Common_Name || ''} ${row.Botanical_Name || ''} ${row.Green_Acres_Product_Name || ''}`.toLowerCase();
  const category = String(row.Category || '').toUpperCase();
  const flowers = isTrue(row.Flowers);

  if (/(california poppy|eschscholzia|orange|kumquat|marigold)/.test(name)) return '#F2A23A';
  if (/(sunflower|coreopsis|moonbeam|carolina jessamine|palo verde|yellow|gold|golden|freesia)/.test(name)) return '#DDBA45';
  if (/(red hot poker|heatwave|blaze|dynamite|red buckwheat|red |fuchsia|little john|bottlebrush)/.test(name)) return '#D95F5F';
  if (/(rose|pink|gaura|santa barbara daisy|muhly|redbud|purple smoke|royal purple|lenten rose)/.test(name)) return '#D98AB1';
  if (/(lavender|sage|salvia|amistad|plumbago|blue|penstemon|russian sage|iris)/.test(name)) return '#8A8FC7';
  if (/(white|snow|silver dust|dusty miller)/.test(name)) return '#BFC7B2';

  if (/(blue spruce|blue fescue|blue oat|platinum|silver|glauca|yucca|agave|echeveria|sedum)/.test(name)) return '#8FAFAE';
  if (/(nandina|firepower|gulf stream|heavenly bamboo)/.test(name)) return '#B96F59';
  if (/(manzanita|grevillea|olive|sweet bay|osmanthus|euonymus|juniper|star jasmine)/.test(name)) return '#6F9B69';
  if (/(sedge|carex|lomandra|grass|flax|phormium|muhlenbergia|calamagrostis|fescue)/.test(name)) return '#9CA866';
  if (/(dymondia|silver carpet|lantana|verbena|groundcover)/.test(name)) return '#8FBF83';
  if (/palm/.test(name)) return '#7FA66A';
  if (/fern/.test(name)) return '#6FA878';
  if (/(maple|oak|pistache|crape myrtle|redbud|pear|willow|guava)/.test(name)) return '#77A66B';

  if (flowers) return '#C992B8';
  if (category.includes('GRASS')) return '#9CA866';
  if (category.includes('TREE')) return '#6F9B69';
  if (category.includes('GROUNDCOVER')) return '#8FBF83';
  if (category.includes('VINE')) return '#6FA878';
  return '#6F9B69';
}

async function main() {
  const text = await fs.readFile(CSV_PATH, 'utf8');
  const rows = parseCsv(text);
  const headers = [...rows[0]];

  for (const column of ['Plan_Symbol_Color', 'Plan_Symbol_Accent_Color']) {
    if (!headers.includes(column)) headers.push(column);
  }

  const records = rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
  let changed = 0;

  for (const row of records) {
    if (!isTrue(row.Green_Acres_Match)) continue;
    const color = colorForPlant(row);
    if (row.Plan_Symbol_Color !== color) changed++;
    row.Plan_Symbol_Color = color;
    row.Plan_Symbol_Accent_Color = '';
  }

  await fs.writeFile(CSV_PATH, writeCsv(headers, records), 'utf8');
  console.log(`Done. Updated ${changed} Green Acres plan symbol colors.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
