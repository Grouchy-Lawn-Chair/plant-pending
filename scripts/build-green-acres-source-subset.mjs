#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const SOURCE_DIR = path.join(ROOT, 'data', 'source-databases');
const PROCESSED_DIR = path.join(SOURCE_DIR, 'processed');
const normalizedPath = path.join(PUBLIC_DIR, 'green_acres_normalized.json');
const args = new Set(process.argv.slice(2));
const minConfidence = Number([...args].find((a) => a.startsWith('--min-confidence='))?.split('=')[1] || 0.86);

function readJson(file, fallback = null) { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function csvEscape(value) { const s = value == null ? '' : String(value); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function writeCsv(file, rows, columns) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, [columns.map(csvEscape).join(','), ...rows.map((row) => columns.map((c) => csvEscape(row[c])).join(','))].join('\n') + '\n'); }

function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]; const next = text[i + 1];
    if (inQuotes) { if (ch === '"' && next === '"') { field += '"'; i += 1; } else if (ch === '"') inQuotes = false; else field += ch; }
    else if (ch === '"') inQuotes = true; else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; } else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows.shift().map((h) => h.trim().replace(/^\uFEFF/, ''));
  return rows.filter((r) => r.some((v) => String(v || '').trim())).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
function readCsvFile(file) { return fs.existsSync(file) ? parseCsv(fs.readFileSync(file, 'utf8')) : []; }

function stripCultivar(s) {
  return String(s || '')
    .replace(/[‘’]/g, "'")
    .replace(/&[#a-z0-9]+;/gi, ' ')
    .replace(/\s*['"][^'"]+['"]\s*/g, ' ')
    .replace(/\b(monrovia|matsuda|grown by|assorted|mix|series|dwarf|compact|variegated|tm|™|®|ppaf|pp\s*#?\d+|patent|plant|plants)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function normalizeName(s) { return stripCultivar(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|flower|flowers|shrub|tree|vine|grass)\b/g, ' ').replace(/\s+/g, ' ').trim(); }
function genusSpecies(s) { const words = normalizeName(s).split(' ').filter(Boolean); return words.length >= 2 ? `${words[0]} ${words[1]}` : ''; }
function getFirst(row, names) {
  for (const name of names) if (row[name] !== undefined && String(row[name] || '').trim()) return row[name];
  const normalized = Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizeName(k), v]));
  for (const name of names) { const key = normalizeName(name); if (normalized[key] !== undefined && String(normalized[key] || '').trim()) return normalized[key]; }
  return '';
}
function sourceFile(patterns) { const files = fs.existsSync(SOURCE_DIR) ? fs.readdirSync(SOURCE_DIR) : []; return files.find((f) => patterns.some((re) => re.test(f))) || ''; }
function compactPlantSource(plant) { return { plantId: plant.plantId, productName: plant.productName || '', commonName: plant.commonName || '', botanicalName: plant.botanicalName || '', stablePlantKey: plant.stablePlantKey || '', handle: plant.handle || '', category: plant.category || '' }; }

function addIndexed(index, key, payload) {
  if (!key) return;
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(payload);
}
function buildUsdaIndex(file, sourceName) {
  const rows = readCsvFile(path.join(SOURCE_DIR, file));
  const index = new Map();
  for (const row of rows) {
    const scientific = getFirst(row, ['Scientific Name with Author', 'Scientific Name with Authors', 'Scientific Name', 'Accepted Scientific Name']);
    const common = getFirst(row, ['Common Name', 'National Common Name', 'State Common Name', 'Preferred State Common Name']);
    const family = getFirst(row, ['Family']);
    const symbol = getFirst(row, ['Symbol', 'Accepted Symbol']);
    const synonymSymbol = getFirst(row, ['Synonym Symbol']);
    const record = { sourceName, symbol, synonymSymbol, scientific, common, family, raw: row };
    addIndexed(index, normalizeName(scientific), { confidence: 1, reason: `${sourceName} scientific exact`, record });
    addIndexed(index, genusSpecies(scientific), { confidence: 0.94, reason: `${sourceName} genus/species`, record });
    addIndexed(index, normalizeName(common), { confidence: 0.88, reason: `${sourceName} common exact`, record });
  }
  return { file, sourceName, count: rows.length, index };
}
function lookupUsda(plant, src) {
  if (!src) return null;
  const keys = [
    { key: normalizeName(plant.botanicalName), weight: 1 },
    { key: genusSpecies(plant.botanicalName), weight: 0.97 },
    { key: normalizeName(plant.commonName), weight: 0.95 },
    { key: normalizeName(plant.productName), weight: 0.92 },
  ].filter((x) => x.key);
  let best = null;
  for (const k of keys) {
    for (const hit of src.index.get(k.key) || []) {
      const scored = { ...hit, confidence: Math.min(1, hit.confidence * k.weight) };
      if (!best || scored.confidence > best.confidence) best = scored;
    }
  }
  return best && best.confidence >= minConfidence ? best : null;
}

function loadPermapeople(file) { const data = readJson(path.join(SOURCE_DIR, file), null); if (!data) return []; return Array.isArray(data) ? data : (data.plants || data.data || []); }
function getPP(record, key) { const data = Array.isArray(record.data) ? record.data : []; return data.find((item) => normalizeName(item.key) === normalizeName(key))?.value || ''; }
function compactPermapeople(record) {
  const keep = new Set(['USDA Hardiness zone', 'Light requirement', 'Water requirement', 'Soil type', 'Soil pH', 'Height', 'Width', 'Life cycle', 'Layer', 'Growth', 'Utility', 'Edible', 'Edible parts', 'Family', 'Alternate name', 'Wikipedia', 'Plants For A Future', 'Propagation method', 'Spacing between plants', 'Drought tolerant', 'Attracts', 'Native to'].map(normalizeName));
  return { id: record.id, name: record.name || '', slug: record.slug || '', scientific_name: record.scientific_name || '', link: record.link || '', data: (Array.isArray(record.data) ? record.data : []).filter((item) => keep.has(normalizeName(item.key))).map((item) => ({ key: item.key, value: item.value })) };
}
function buildPermapeopleIndex(file) {
  const records = file ? loadPermapeople(file) : [];
  const index = new Map();
  for (const record of records) {
    addIndexed(index, normalizeName(record.scientific_name), { confidence: 1, reason: 'Permapeople scientific exact', record });
    addIndexed(index, genusSpecies(record.scientific_name), { confidence: 0.94, reason: 'Permapeople genus/species', record });
    addIndexed(index, normalizeName(record.name), { confidence: 0.9, reason: 'Permapeople name exact', record });
    String(getPP(record, 'Alternate name')).split(/[,;/|]+/).forEach((v) => addIndexed(index, normalizeName(v), { confidence: 0.86, reason: 'Permapeople alternate name', record }));
  }
  return { file, count: records.length, index };
}
function lookupPermapeople(plant, src) {
  if (!src) return null;
  const keys = [
    { key: normalizeName(plant.botanicalName), weight: 1 },
    { key: genusSpecies(plant.botanicalName), weight: 0.97 },
    { key: normalizeName(plant.commonName), weight: 0.95 },
    { key: normalizeName(plant.productName), weight: 0.92 },
  ].filter((x) => x.key);
  let best = null;
  for (const k of keys) for (const hit of src.index.get(k.key) || []) {
    const scored = { ...hit, confidence: Math.min(1, hit.confidence * k.weight) };
    if (!best || scored.confidence > best.confidence) best = scored;
  }
  return best && best.confidence >= minConfidence ? best : null;
}

function loadCompanionCsv(file) {
  const rows = readCsvFile(path.join(SOURCE_DIR, file));
  const byName = new Map();
  const add = (name, rel) => { const key = normalizeName(name); if (!key) return; if (!byName.has(key)) byName.set(key, []); byName.get(key).push(rel); };
  for (const row of rows) {
    const source = getFirst(row, ['Source Node', 'Source', 'Plant A', 'source']);
    const target = getFirst(row, ['Destination Node', 'Target', 'Plant B', 'target']);
    const link = getFirst(row, ['Link', 'Relationship', 'relationship', 'type']);
    const sourceType = getFirst(row, ['Source Type', 'sourceType']);
    add(source, { source, link, target, sourceType });
  }
  return { file, count: rows.length, byName };
}
function companionMatches(plant, companion) {
  if (!companion) return [];
  const out = [];
  for (const key of [plant.commonName, plant.productName].map(normalizeName).filter(Boolean)) out.push(...(companion.byName.get(key) || []));
  const seen = new Set();
  return out.filter((rel) => { const key = JSON.stringify(rel); if (seen.has(key)) return false; seen.add(key); return true; });
}
function loadPermapeopleCompanionSample(file) { const data = file ? readJson(path.join(SOURCE_DIR, file), null) : null; return data?.results || []; }

function main() {
  if (!fs.existsSync(normalizedPath)) throw new Error(`Missing ${normalizedPath}`);
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  const plants = readJson(normalizedPath, []);
  const usdaNationalFile = sourceFile([/usda.*plants.*checklist.*\.(csv|txt)$/i, /complete.*plants.*\.(csv|txt)$/i]);
  const usdaCaliforniaFile = sourceFile([/usda.*california.*\.(csv|txt)$/i, /california.*checklist.*\.(csv|txt)$/i]);
  const permapeopleFile = sourceFile([/permapeople.*plants.*\.json$/i]);
  const permapeopleCompanionFile = sourceFile([/permapeople.*companions.*\.json$/i]);
  const companionFile = sourceFile([/companion[_-]?plants.*\.(csv|json)$/i, /companion.*\.(csv|json)$/i]);

  const usdaNational = usdaNationalFile ? buildUsdaIndex(usdaNationalFile, 'usdaPlantsChecklist') : null;
  const usdaCalifornia = usdaCaliforniaFile ? buildUsdaIndex(usdaCaliforniaFile, 'usdaCaliforniaChecklist') : null;
  const permapeople = permapeopleFile ? buildPermapeopleIndex(permapeopleFile) : null;
  const companion = companionFile ? loadCompanionCsv(companionFile) : null;
  const ppCompanionSample = loadPermapeopleCompanionSample(permapeopleCompanionFile);

  const subset = [], reportRows = [];
  const counts = { usdaNational: 0, usdaCalifornia: 0, permapeople: 0, companionGraph: 0, permapeopleCompanionSample: ppCompanionSample.length };
  for (const plant of plants) {
    const usdaMatch = lookupUsda(plant, usdaNational);
    const caMatch = lookupUsda(plant, usdaCalifornia);
    const ppMatch = lookupPermapeople(plant, permapeople);
    const compMatches = companionMatches(plant, companion);
    if (usdaMatch) counts.usdaNational += 1;
    if (caMatch) counts.usdaCalifornia += 1;
    if (ppMatch) counts.permapeople += 1;
    if (compMatches.length) counts.companionGraph += 1;
    const greenAcresPlant = compactPlantSource(plant);
    subset.push({ greenAcresPlant, matches: {
      usdaNational: usdaMatch ? { confidence: usdaMatch.confidence, reason: usdaMatch.reason, record: usdaMatch.record } : null,
      usdaCalifornia: caMatch ? { confidence: caMatch.confidence, reason: caMatch.reason, record: caMatch.record } : null,
      permapeople: ppMatch ? { confidence: ppMatch.confidence, reason: ppMatch.reason, record: compactPermapeople(ppMatch.record) } : null,
      companionGraph: compMatches,
    }});
    reportRows.push({ plantId: plant.plantId, productName: plant.productName, botanicalName: plant.botanicalName, usdaNationalMatch: usdaMatch?.record?.scientific || '', usdaNationalConfidence: usdaMatch?.confidence || '', usdaCaliforniaMatch: caMatch?.record?.scientific || '', usdaCaliforniaConfidence: caMatch?.confidence || '', permapeopleMatch: ppMatch?.record?.name || '', permapeopleScientific: ppMatch?.record?.scientific_name || '', permapeopleConfidence: ppMatch?.confidence || '', companionRows: compMatches.length });
  }

  const ppMatches = subset.filter((x) => x.matches.permapeople).map((x) => ({ greenAcresPlant: x.greenAcresPlant, ...x.matches.permapeople }));
  const companionRows = subset.flatMap((x) => x.matches.companionGraph.map((rel) => ({ plantId: x.greenAcresPlant.plantId, productName: x.greenAcresPlant.productName, ...rel })));
  const summary = { createdAt: new Date().toISOString(), plantCount: plants.length, minConfidence, sourceFiles: { usdaNational: usdaNationalFile || null, usdaCalifornia: usdaCaliforniaFile || null, permapeople: permapeopleFile || null, permapeopleCompanionSample: permapeopleCompanionFile || null, companion: companionFile || null }, sourceRecordCounts: { usdaNational: usdaNational?.count || 0, usdaCalifornia: usdaCalifornia?.count || 0, permapeople: permapeople?.count || 0, companion: companion?.count || 0, permapeopleCompanionSample: ppCompanionSample.length }, matchCounts: counts, outputs: ['data/source-databases/processed/green-acres-source-subset.json', 'data/source-databases/processed/green-acres-permapeople-matches.json', 'data/source-databases/processed/green-acres-companion-graph.csv', 'data/source-databases/processed/green-acres-source-subset-report.csv', 'public/green_acres_source_subset_summary.json'], note: 'This subset contains only records matched to Green Acres plants. Raw downloads can stay local and can be excluded from project zips.' };
  writeJson(path.join(PROCESSED_DIR, 'green-acres-source-subset.json'), subset);
  writeJson(path.join(PROCESSED_DIR, 'green-acres-permapeople-matches.json'), ppMatches);
  writeCsv(path.join(PROCESSED_DIR, 'green-acres-companion-graph.csv'), companionRows, ['plantId', 'productName', 'source', 'link', 'target', 'sourceType']);
  writeCsv(path.join(PROCESSED_DIR, 'green-acres-source-subset-report.csv'), reportRows, ['plantId', 'productName', 'botanicalName', 'usdaNationalMatch', 'usdaNationalConfidence', 'usdaCaliforniaMatch', 'usdaCaliforniaConfidence', 'permapeopleMatch', 'permapeopleScientific', 'permapeopleConfidence', 'companionRows']);
  writeJson(path.join(PUBLIC_DIR, 'green_acres_source_subset_summary.json'), summary);
  console.log('Green Acres source subset complete.');
  console.log(JSON.stringify(summary, null, 2));
}
main();
