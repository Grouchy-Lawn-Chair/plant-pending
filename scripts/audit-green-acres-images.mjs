#!/usr/bin/env node
/**
 * Audit and optionally fix local Green Acres image links.
 *
 * Usage:
 *   npm run audit-green-acres-images
 *   npm run audit-green-acres-images -- --apply
 *
 * Writes:
 *   public/green_acres_image_audit.csv
 *
 * What it checks:
 * - local image path exists
 * - GreenAcres-Images files that are not used
 * - best local filename match for each catalog row
 *
 * With --apply:
 * - updates Green_Acres_Local_Image_Path, Thumbnail_Local_Path, Green_Acres_Image_URL, Thumbnail_URL
 *   when the match is strong enough
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const CSV_PATH = './public/green_acres_catalog.csv';
const IMAGE_ROOT = './public/GreenAcres-Images';
const AUDIT_PATH = './public/green_acres_image_audit.csv';
const APPLY = process.argv.includes('--apply');

const STOP = new Set([
  'plant','plants','green','acres','nursery','supply','monrovia','pw','proven','winners',
  'assorted','display','table','tables','field','landscape','closeup','detail','bloom','blooms',
  'flower','flowers','fruit','tree','shrub','perennial','annual','vine','grass','groundcover',
  '512x','704x704','01','02','03','04','1','2','3','4','5','6','7','8','9','10',
  'jpg','jpeg','png','webp','grp','stk','oohlala','eg','ga','v1','v2'
]);

const SYNONYMS = new Map([
  ['euonymous', 'euonymus'],
  ['euonymousmicrophylla', 'euonymusmicrophylla'],
  ['microphylla', 'boxleaf'],
  ['boxleaf', 'microphylla'],
  ['greenspire', 'green spire'],
  ['green spire', 'greenspire'],
  ['emeraldngold', 'emerald gold'],
  ['emerald gold', 'emeraldngold'],
  ['ca', 'california'],
]);

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
  return [
    headers.map(csvEscape).join(','),
    ...records.map(row => headers.map(h => csvEscape(row[h] ?? '')).join(',')),
  ].join('\n');
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/™|®|&/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value) {
  const out = new Set();
  const raw = normalize(value);
  const compact = raw.replace(/\s+/g, '');
  if (compact) out.add(compact);
  for (const part of raw.split(' ')) {
    if (part.length < 3 || STOP.has(part)) continue;
    out.add(part);
    if (SYNONYMS.has(part)) {
      for (const s of normalize(SYNONYMS.get(part)).split(' ')) {
        if (s.length >= 3) out.add(s);
      }
      out.add(String(SYNONYMS.get(part)).replace(/\s+/g, ''));
    }
  }
  // add common two-word compact forms
  const parts = raw.split(' ').filter(p => p.length >= 3 && !STOP.has(p));
  for (let i = 0; i < parts.length - 1; i++) out.add(parts[i] + parts[i + 1]);
  return out;
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) files.push(full);
  }
  return files;
}

function scoreMatch(row, image) {
  const rowText = [
    row.Common_Name,
    row.Botanical_Name,
    row.Green_Acres_Product_Name,
    row.Green_Acres_Botanical_Name,
    row.Green_Acres_Product_Handle,
  ].filter(Boolean).join(' ');

  const rowTokens = tokenSet(rowText);
  const imgBase = path.basename(image).replace(/\.[^.]+$/, '');
  const imgTokens = tokenSet(imgBase);
  const rel = image.replace(/\\/g, '/');
  const category = normalize(row.Category);

  let score = 0;
  let hits = [];

  for (const t of rowTokens) {
    if (imgTokens.has(t)) {
      const points = t.length >= 8 ? 8 : t.length >= 5 ? 5 : 3;
      score += points;
      hits.push(t);
    }
  }

  // Compact string contains checks catch GreenSpire vs Green Spire.
  const rowCompact = normalize(rowText).replace(/\s+/g, '');
  const imgCompact = normalize(imgBase).replace(/\s+/g, '');
  for (const t of rowTokens) {
    if (t.length >= 6 && imgCompact.includes(t)) {
      score += 4;
      hits.push(`contains:${t}`);
    }
  }
  if (rowCompact && imgCompact.includes(rowCompact.slice(0, Math.min(rowCompact.length, 20)))) {
    score += 12;
    hits.push('compact-prefix');
  }

  if (category && rel.toLowerCase().includes(`/${category}`)) score += 2;

  // Avoid junk assets.
  if (/sm_facebook|sm_instagram|sm_pinterest|sm_youtube|flower_color/i.test(imgBase)) score -= 50;

  return { score, hits: [...new Set(hits)] };
}

async function main() {
  const content = await fs.readFile(CSV_PATH, 'utf8');
  const rows = parseCsv(content);
  const headers = [...rows[0]];
  const records = rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));

  for (const col of ['Green_Acres_Local_Image_Path','Thumbnail_Local_Path','Green_Acres_Image_URL','Thumbnail_URL','Image_Match_Confidence','Green_Acres_Image_Match_Score']) {
    if (!headers.includes(col)) headers.push(col);
  }

  const files = await walk(IMAGE_ROOT);
  const relFiles = files.map(f => '/' + path.relative('./public', f).replace(/\\/g, '/'));
  const used = new Set();
  const auditRows = [];
  let missingPath = 0;
  let changed = 0;

  for (const row of records) {
    const current = row.Green_Acres_Local_Image_Path || row.Thumbnail_Local_Path || row.Green_Acres_Image_URL || row.Thumbnail_URL || '';
    if (current) used.add(current);

    const currentExists = current ? await fs.access(path.join('./public', current.replace(/^\//, ''))).then(() => true).catch(() => false) : false;
    if (current && !currentExists) missingPath++;

    let best = { file: '', score: -999, hits: [] };
    for (const rel of relFiles) {
      const scored = scoreMatch(row, rel);
      if (scored.score > best.score) best = { file: rel, score: scored.score, hits: scored.hits };
    }

    const shouldApply = best.score >= 12 && (!current || !currentExists || best.score >= Number(row.Green_Acres_Image_Match_Score || 0) + 8 || /manual-fix/.test(String(row.Green_Acres_Image_Match_Score)));
    if (APPLY && shouldApply) {
      row.Green_Acres_Local_Image_Path = best.file;
      row.Thumbnail_Local_Path = best.file;
      row.Green_Acres_Image_URL = best.file;
      row.Thumbnail_URL = best.file;
      row.Image_Match_Confidence = best.score >= 20 ? 'high' : 'medium';
      row.Green_Acres_Image_Match_Score = String(best.score);
      changed++;
    }

    auditRows.push({
      Plant_ID: row.Plant_ID,
      Category: row.Category,
      Common_Name: row.Common_Name,
      Botanical_Name: row.Botanical_Name,
      Current_Image: current,
      Current_Exists: currentExists ? 'TRUE' : 'FALSE',
      Best_Image: best.file,
      Best_Score: best.score,
      Best_Hits: best.hits.join('; '),
      Would_Apply: shouldApply ? 'TRUE' : 'FALSE',
    });
  }

  const usedAfter = new Set(records.map(r => r.Green_Acres_Local_Image_Path || r.Thumbnail_Local_Path || r.Green_Acres_Image_URL || r.Thumbnail_URL).filter(Boolean));
  const unusedFiles = relFiles.filter(f => !usedAfter.has(f));

  const auditHeaders = ['Plant_ID','Category','Common_Name','Botanical_Name','Current_Image','Current_Exists','Best_Image','Best_Score','Best_Hits','Would_Apply'];
  await fs.writeFile(AUDIT_PATH, writeCsv(auditHeaders, auditRows), 'utf8');

  if (APPLY) {
    await fs.writeFile(CSV_PATH, writeCsv(headers, records), 'utf8');
  }

  console.log(`Catalog rows: ${records.length}`);
  console.log(`Image files: ${relFiles.length}`);
  console.log(`Rows with missing/broken current image path: ${missingPath}`);
  console.log(`Potential image updates: ${auditRows.filter(r => r.Would_Apply === 'TRUE').length}`);
  console.log(`Applied image updates: ${changed}`);
  console.log(`Unused image files after current catalog links: ${unusedFiles.length}`);
  console.log(`Wrote ${AUDIT_PATH}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
