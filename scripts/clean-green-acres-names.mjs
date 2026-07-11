#!/usr/bin/env node
/**
 * Clean obvious mashed Green Acres product names.
 *
 * Usage:
 *   npm run clean-green-acres-names
 */

import fs from 'node:fs/promises';

const CSV_PATH = './public/green_acres_catalog.csv';

const DIRECT_FIXES = new Map([
  ['euonymusgreenspire', {
    Common_Name: 'Euonymus Green Spire',
    Botanical_Name: "Euonymus japonicus 'Green Spire'",
    Green_Acres_Product_Name: "Euonymus 'Green Spire'",
    Green_Acres_Botanical_Name: "Euonymus japonicus 'Green Spire'",
    Mature_Height_ft_est: '5',
    Mature_Width_ft_est: '2',
    Full_Mature_Size_est: "5' H x 2' W",
    Minimum_Spacing_ft_est: '1.5',
    Plant_Form_Est: 'narrow evergreen shrub',
    Evergreen_Est: 'TRUE',
    Pool_Suitable_Est: 'Yes',
    Slope_Suitable_Est: 'No',
    Privacy_Suitable_Est: 'Yes',
    Plan_Symbol_File: '5.svg',
    Plan_Symbol_Color: '#5F8F55',
    Estimate_Confidence: 'High-confidence estimate',
  }],
  ['festucaelijahblue', { Common_Name: 'Festuca Elijah Blue', Botanical_Name: "Festuca glauca 'Elijah Blue'", Green_Acres_Product_Name: "Festuca 'Elijah Blue'" }],
  ['blackmondograss', { Common_Name: 'Black Mondo Grass', Botanical_Name: 'Ophiopogon planiscapus', Green_Acres_Product_Name: 'Black Mondo Grass' }],
  ['dwarfmondograss', { Common_Name: 'Dwarf Mondo Grass', Botanical_Name: 'Ophiopogon japonicus', Green_Acres_Product_Name: 'Dwarf Mondo Grass' }],
  ['buxusgreenbeauty', { Common_Name: 'Buxus Green Beauty', Botanical_Name: "Buxus microphylla japonica 'Green Beauty'", Green_Acres_Product_Name: "Buxus 'Green Beauty'" }],
  ['buxuswintergem', { Common_Name: 'Buxus Winter Gem', Botanical_Name: "Buxus microphylla japonica 'Winter Gem'", Green_Acres_Product_Name: "Buxus 'Winter Gem'" }],
  ['bottlebrushlittlejohn', { Common_Name: 'Bottlebrush Little John', Botanical_Name: "Callistemon viminalis 'Little John'", Green_Acres_Product_Name: "Bottlebrush 'Little John'" }],
  ['yarrowmoonshine', { Common_Name: 'Yarrow Moonshine', Botanical_Name: "Achillea 'Moonshine'", Green_Acres_Product_Name: "Yarrow 'Moonshine'" }],
  ['lavendergrosso', { Common_Name: 'Lavender Grosso', Botanical_Name: "Lavandula x intermedia 'Grosso'", Green_Acres_Product_Name: "Lavender 'Grosso'" }],
  ['lavenderhidcote', { Common_Name: 'Lavender Hidcote', Botanical_Name: "Lavandula angustifolia 'Hidcote'", Green_Acres_Product_Name: "Lavender 'Hidcote'" }],
  ['lavendermunstead', { Common_Name: 'Lavender Munstead', Botanical_Name: "Lavandula angustifolia 'Munstead'", Green_Acres_Product_Name: "Lavender 'Munstead'" }],
  ['lavenderprovence', { Common_Name: 'Lavender Provence', Botanical_Name: "Lavandula x intermedia 'Provence'", Green_Acres_Product_Name: "Lavender 'Provence'" }],
  ['lavenderstoechas', { Common_Name: 'Spanish Lavender', Botanical_Name: 'Lavandula stoechas', Green_Acres_Product_Name: 'Spanish Lavender' }],
]);

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
function key(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function titleCaseFromHandle(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, ch => ch.toUpperCase());
}
function appendNote(row, note) {
  const existing = row.Knowledge_Notes || '';
  if (!existing.includes(note)) row.Knowledge_Notes = `${existing}${existing ? ' | ' : ''}${note}`;
}

async function main() {
  const content = await fs.readFile(CSV_PATH, 'utf8');
  const rows = parseCsv(content);
  const headers = [...rows[0]];
  const records = rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));

  let fixed = 0;
  for (const row of records) {
    const lookup = key(row.Common_Name || row.Green_Acres_Product_Name || row.Green_Acres_Product_Handle);
    if (DIRECT_FIXES.has(lookup)) {
      const patch = DIRECT_FIXES.get(lookup);
      for (const [col, val] of Object.entries(patch)) {
        if (headers.includes(col)) row[col] = val;
      }
      appendNote(row, 'Cleaned mashed Green Acres product name.');
      fixed++;
      continue;
    }

    // Conservative generic cleanup for names with no spaces but a usable handle.
    const common = String(row.Common_Name || '');
    if (/^[A-Za-z]{12,}$/.test(common) && row.Green_Acres_Product_Handle) {
      const cleaned = titleCaseFromHandle(row.Green_Acres_Product_Handle);
      if (cleaned && cleaned.toLowerCase() !== common.toLowerCase()) {
        row.Common_Name = cleaned;
        if (!row.Green_Acres_Product_Name || key(row.Green_Acres_Product_Name) === key(common)) {
          row.Green_Acres_Product_Name = cleaned;
        }
        appendNote(row, 'Cleaned name from product handle.');
        fixed++;
      }
    }
  }

  await fs.writeFile(CSV_PATH, writeCsv(headers, records), 'utf8');
  console.log(`Cleaned ${fixed} catalog names.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
