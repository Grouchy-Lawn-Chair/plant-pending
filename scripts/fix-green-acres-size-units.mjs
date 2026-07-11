#!/usr/bin/env node
/**
 * Fix and backfill mature height/width values in green_acres_catalog.csv.
 *
 * Sources are used in this order:
 * 1. Saved Green Acres mature-size snippets, for example 4\"-6\" tall, 10\" wide.
 * 2. Green Acres product tags, for example Height_2-3ft and Width_1ft.
 * 3. Local green_acres_enrichment_report.csv fallback estimates.
 *
 * Plain container sizes like Size 4\" or Size_6-pack are not mature plant sizes.
 */

import fs from 'node:fs/promises';

const CSV_PATH = './public/green_acres_catalog.csv';
const REPORT_PATH = './public/green_acres_enrichment_report.csv';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (q && text[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (ch === ',' && !q) {
      row.push(cur); cur = '';
    } else if ((ch === '\n' || ch === '\r') && !q) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      if (row.some(v => String(v).trim() !== '')) rows.push(row);
      row = []; cur = '';
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
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(headers, records) {
  return [headers.map(csvEscape).join(','), ...records.map(row => headers.map(h => csvEscape(row[h] ?? '')).join(','))].join('\n');
}
function addColumn(headers, col) {
  if (!headers.includes(col)) headers.push(col);
}
function cleanText(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&prime;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\bfeet\b|\bfoot\b/gi, 'ft')
    .replace(/\binches\b|\binch\b/gi, 'in')
    .replace(/\s+/g, ' ')
    .trim();
}
function unitName(unit) {
  const u = String(unit || '').toLowerCase().trim();
  if (u === '"' || u.startsWith('in')) return 'in';
  if (u === "'" || u.startsWith('ft')) return 'ft';
  return '';
}
function toFeet(n, unit) {
  const value = Number.parseFloat(n);
  if (!Number.isFinite(value)) return '';
  const feet = unitName(unit) === 'in' ? value / 12 : value;
  return Math.round(feet * 10) / 10;
}
function formatFeet(n) {
  if (n === '') return '';
  return Number.isInteger(Number(n)) ? String(Number(n)) : String(Number(n));
}
function pickRange(low, lowUnit, high, highUnit) {
  const resolvedHighUnit = unitName(highUnit) || unitName(lowUnit);
  const resolvedLowUnit = unitName(lowUnit) || unitName(highUnit) || resolvedHighUnit || 'ft';
  return high ? toFeet(high, resolvedHighUnit || resolvedLowUnit) : toFeet(low, resolvedLowUnit || 'ft');
}
function parseMatureSize(source) {
  const text = cleanText(source);
  if (!text) return null;
  const units = String.raw`(?:ft|in|['"])`;
  const number = String.raw`(\d+(?:\.\d+)?)`;
  const optionalUnit = String.raw`\s*(${units})?`;
  const rangeJoin = String.raw`\s*(?:-|to)\s*`;
  const pattern = new RegExp(
    String.raw`(?:landscape\s+size|mature\s+size|size)\s*:?\s*` +
    number + optionalUnit + String.raw`(?:` + rangeJoin + number + optionalUnit + String.raw`)?\s*` +
    String.raw`(?:tall|high|h)\b[\s,;xX-]*` +
    number + optionalUnit + String.raw`(?:` + rangeJoin + number + optionalUnit + String.raw`)?\s*` +
    String.raw`(?:wide|w|spread)\b`,
    'i'
  );
  const m = text.match(pattern);
  if (!m) return null;
  const height = pickRange(m[1], m[2], m[3], m[4]);
  const width = pickRange(m[5], m[6], m[7], m[8]);
  if (height === '' || width === '') return null;
  return {
    height: formatFeet(height),
    width: formatFeet(width),
    fullSize: `${formatFeet(height)}' H x ${formatFeet(width)}' W`,
    source: m[0].trim(),
  };
}
function parseSizeTagValue(raw) {
  const text = cleanText(raw);
  if (!text) return '';
  const units = String.raw`(?:ft|in|['"])`;
  const m = text.match(new RegExp(String.raw`^(\d+(?:\.\d+)?)(?:\s*(?:-|to)\s*(\d+(?:\.\d+)?))?\s*(${units})?$`, 'i'));
  if (!m) return '';
  const unit = unitName(m[3]) || 'ft';
  const value = m[2] || m[1];
  return formatFeet(toFeet(value, unit));
}
function parseSizeFromTags(tags) {
  const parts = String(tags || '').split(';').map(v => v.trim()).filter(Boolean);
  let height = '';
  let width = '';
  const used = [];
  for (const part of parts) {
    const h = part.match(/^Height_(.+)$/i);
    const w = part.match(/^Width_(.+)$/i);
    if (h && !height) {
      height = parseSizeTagValue(h[1]);
      if (height) used.push(part);
    }
    if (w && !width) {
      width = parseSizeTagValue(w[1]);
      if (width) used.push(part);
    }
  }
  if (!height && !width) return null;
  return { height, width, source: used.join('; ') };
}
function isContainerOnly(source) {
  const text = cleanText(source);
  if (!text) return false;
  if (/\b(?:tall|high|wide|spread)\b/i.test(text)) return false;
  return /^size\s*:?\s*/i.test(text) || /^container\s*size/i.test(text);
}
async function loadEnrichmentReport() {
  try {
    const raw = await fs.readFile(REPORT_PATH, 'utf8');
    const rows = parseCsv(raw);
    const headers = rows[0] || [];
    const records = rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
    const byKey = new Map();
    for (const row of records) {
      const key = `${String(row.Common_Name || '').toLowerCase().trim()}|${String(row.Green_Acres_URL || '').toLowerCase().trim()}`;
      if (key !== '|') byKey.set(key, row);
    }
    return byKey;
  } catch {
    return new Map();
  }
}
function reportLookup(report, row) {
  const key = `${String(row.Common_Name || '').toLowerCase().trim()}|${String(row.Green_Acres_URL || '').toLowerCase().trim()}`;
  return report.get(key) || null;
}
function setSpacingFromWidth(row) {
  const width = Number(row.Mature_Width_ft_est);
  if (Number.isFinite(width) && width > 0 && !row.Minimum_Spacing_ft_est) {
    row.Minimum_Spacing_ft_est = String(Math.round(width * 0.75 * 10) / 10);
  }
}
function setFullSize(row) {
  if (row.Mature_Height_ft_est && row.Mature_Width_ft_est) {
    row.Full_Mature_Size_est = `${row.Mature_Height_ft_est}' H x ${row.Mature_Width_ft_est}' W`;
  }
}

const raw = await fs.readFile(CSV_PATH, 'utf8');
const rows = parseCsv(raw);
const headers = [...rows[0]];
for (const col of ['Green_Acres_Size_Parse_Source', 'Green_Acres_Size_Unit_Fixed', 'Green_Acres_Notes', 'Minimum_Spacing_ft_est', 'Full_Mature_Size_est']) addColumn(headers, col);

const records = rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
const enrichmentReport = await loadEnrichmentReport();
let sourceFixed = 0;
let tagFixed = 0;
let reportFixed = 0;
let cleared = 0;

for (const row of records) {
  const sources = [row.Green_Acres_Page_Size_Text, row.Green_Acres_Landscape_Size_Text].filter(Boolean);
  const parsed = sources.map(parseMatureSize).find(Boolean);
  if (parsed) {
    const before = `${row.Mature_Height_ft_est}|${row.Mature_Width_ft_est}`;
    row.Mature_Height_ft_est = parsed.height;
    row.Mature_Width_ft_est = parsed.width;
    row.Full_Mature_Size_est = parsed.fullSize;
    row.Minimum_Spacing_ft_est = String(Math.round(Number(parsed.width) * 0.75 * 10) / 10);
    row.Green_Acres_Size_Parse_Source = parsed.source;
    row.Green_Acres_Size_Unit_Fixed = /[" ]in\b/i.test(parsed.source) || parsed.source.includes('"') ? 'TRUE' : row.Green_Acres_Size_Unit_Fixed || '';
    row.Estimate_Confidence = 'Green Acres page parsed';
    if (`${row.Mature_Height_ft_est}|${row.Mature_Width_ft_est}` !== before) sourceFixed++;
    continue;
  }

  const tagSize = parseSizeFromTags(row.Green_Acres_Tags);
  if (tagSize && (!row.Mature_Height_ft_est || !row.Mature_Width_ft_est)) {
    const before = `${row.Mature_Height_ft_est}|${row.Mature_Width_ft_est}`;
    if (!row.Mature_Height_ft_est && tagSize.height) row.Mature_Height_ft_est = tagSize.height;
    if (!row.Mature_Width_ft_est && tagSize.width) row.Mature_Width_ft_est = tagSize.width;
    setFullSize(row);
    setSpacingFromWidth(row);
    row.Green_Acres_Size_Parse_Source = tagSize.source || row.Green_Acres_Size_Parse_Source || '';
    row.Estimate_Confidence = 'Green Acres tag parsed';
    if (`${row.Mature_Height_ft_est}|${row.Mature_Width_ft_est}` !== before) tagFixed++;
    continue;
  }

  const reportRow = reportLookup(enrichmentReport, row);
  if (reportRow && (!row.Mature_Height_ft_est || !row.Mature_Width_ft_est)) {
    const before = `${row.Mature_Height_ft_est}|${row.Mature_Width_ft_est}`;
    if (!row.Mature_Height_ft_est && reportRow.Mature_Height_ft_est) row.Mature_Height_ft_est = reportRow.Mature_Height_ft_est;
    if (!row.Mature_Width_ft_est && reportRow.Mature_Width_ft_est) row.Mature_Width_ft_est = reportRow.Mature_Width_ft_est;
    setFullSize(row);
    setSpacingFromWidth(row);
    row.Green_Acres_Size_Parse_Source = 'green_acres_enrichment_report fallback estimate';
    row.Estimate_Confidence = reportRow.Estimate_Confidence || 'Knowledge fallback estimate';
    if (`${row.Mature_Height_ft_est}|${row.Mature_Width_ft_est}` !== before) reportFixed++;
    continue;
  }

  if (sources.some(isContainerOnly) && /Green Acres page parsed/i.test(row.Estimate_Confidence || '')) {
    row.Mature_Height_ft_est = '';
    row.Mature_Width_ft_est = '';
    row.Full_Mature_Size_est = '';
    row.Minimum_Spacing_ft_est = '';
    row.Green_Acres_Size_Parse_Source = sources.find(isContainerOnly) || '';
    row.Estimate_Confidence = 'Green Acres container size only, mature size missing';
    cleared++;
  }
}

await fs.writeFile(CSV_PATH, writeCsv(headers, records), 'utf8');
console.log(`Fixed ${sourceFixed} mature-size rows from saved Green Acres source text.`);
console.log(`Filled ${tagFixed} rows from Green Acres Height_/Width_ tags.`);
console.log(`Filled ${reportFixed} rows from green_acres_enrichment_report fallback estimates.`);
console.log(`Cleared ${cleared} rows that only had container sizes, not mature plant sizes.`);
