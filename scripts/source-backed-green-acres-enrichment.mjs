#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const SOURCE_DIR = path.join(ROOT, 'data', 'source-databases');
const normalizedPath = path.join(PUBLIC_DIR, 'green_acres_normalized.json');
const scorePath = path.join(PUBLIC_DIR, 'green_acres_design_scores.json');
const reportPath = path.join(PUBLIC_DIR, 'green_acres_source_backed_enrichment_report.csv');
const summaryPath = path.join(PUBLIC_DIR, 'green_acres_source_backed_summary.json');
const sourcesPath = path.join(PUBLIC_DIR, 'green_acres_source_registry.json');
const processedSubsetPath = path.join(SOURCE_DIR, 'processed', 'green-acres-source-subset.json');

const args = new Set(process.argv.slice(2));
const shouldFetchPermapeople = args.has('--fetch-permapeople');
const shouldFetchTrefle = args.has('--fetch-trefle');
const dryRun = args.has('--dry-run');

const SOURCE_REGISTRY = {
  greenAcres: {
    name: 'Green Acres Nursery product catalog',
    url: 'https://idiggreenacres.com/',
    use: 'Primary source for product name, availability, price, image, Green Acres tags, size, light, water, bloom, attributes, colors, and landscape use when present.',
    trust: 'primary buying source for this app',
  },
  usdaPlantsChecklist: {
    name: 'USDA PLANTS Complete Checklist',
    url: 'https://plants.sc.egov.usda.gov/downloads',
    use: 'Source for standardized symbol, accepted scientific/common names, synonym symbols, and family. Does not provide garden height, width, water, or light in the checklist file.',
    trust: 'government taxonomy/checklist source',
  },
  permapeople: {
    name: 'Permapeople plant database API/cache',
    url: 'https://permapeople.org/knowledgebase/api-docs/',
    use: 'Optional source for plant profiles and attributes such as light requirement, water requirement, USDA hardiness zone, family, layer, and companions when an exact/high-confidence match is found.',
    trust: 'community-maintained plant database; requires API credentials for live fetch',
  },
  trefle: {
    name: 'Trefle plants API/cache',
    url: 'https://trefle.io/',
    use: 'Optional botanical source for scientific name, common name, family, genus, and taxonomy when an exact/high-confidence match is found.',
    trust: 'global plant API; requires API token for live fetch',
  },
  companionDataset: {
    name: 'Companion plants dataset from Wikipedia/list datasets',
    url: 'https://www.kaggle.com/datasets/aramacus/companion-plants',
    use: 'Optional source for companion/antagonist relationships only. It is not used to fill height, width, water, or light.',
    trust: 'secondary relationship dataset derived from Wikipedia-style companion planting tables',
  },
};

function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function loadProcessedSubsetIndex() {
  const subset = readJson(processedSubsetPath, []);
  const byPlantId = new Map();
  for (const item of Array.isArray(subset) ? subset : []) {
    if (item?.greenAcresPlant?.plantId != null) byPlantId.set(String(item.greenAcresPlant.plantId), item);
  }
  return { fileName: fs.existsSync(processedSubsetPath) ? path.relative(ROOT, processedSubsetPath) : null, count: byPlantId.size, byPlantId };
}

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function writeCsv(file, rows, columns) {
  const lines = [columns.map(csvEscape).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvEscape(row[c])).join(','));
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows.shift().map((h) => h.trim().replace(/^\uFEFF/, ''));
  return rows
    .filter((r) => r.some((v) => String(v || '').trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function stripCultivar(s) {
  return String(s || '')
    .replace(/[‘’]/g, "'")
    .replace(/\s*['"][^'"]+['"]\s*/g, ' ')
    .replace(/\b(monrovia|assorted|mix|dwarf|compact|variegated|tm|™|®)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(s) {
  return stripCultivar(s)
    .toLowerCase()
    .replace(/&[#a-z0-9]+;/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|plant|plants|flower|flowers)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function genusSpecies(s) {
  const words = normalizeName(s).split(' ').filter(Boolean);
  if (words.length < 2) return '';
  return `${words[0]} ${words[1]}`;
}

function hasMissingArray(v) {
  return !Array.isArray(v) || v.length === 0;
}

function hasMissingObject(v) {
  return !v || typeof v !== 'object' || (v.minFt == null && v.maxFt == null && !v.raw);
}

function initProvenance(plant) {
  const p = plant.sourceProvenance || {};
  const setGreen = (key, ok) => {
    if (ok && !p[key]) p[key] = { source: 'greenAcres', confidence: 1, note: 'Present in Green Acres normalized product data.' };
  };
  setGreen('productName', !!plant.productName);
  setGreen('commonName', !!plant.commonName);
  setGreen('botanicalName', !!plant.botanicalName);
  setGreen('height', !hasMissingObject(plant.height));
  setGreen('width', !hasMissingObject(plant.width));
  setGreen('lightRequirements', !hasMissingArray(plant.lightRequirements));
  setGreen('waterNeeds', !hasMissingArray(plant.waterNeeds));
  setGreen('attributes', !hasMissingArray(plant.attributes));
  setGreen('landscapeUses', !hasMissingArray(plant.landscapeUses));
  setGreen('bloomSeasons', !hasMissingArray(plant.bloomSeasons));
  setGreen('flowerColors', !hasMissingArray(plant.flowerColors));
  setGreen('foliageColors', !hasMissingArray(plant.foliageColors));
  setGreen('usdaZones', !hasMissingArray(plant.usdaZones));
  plant.sourceProvenance = p;
}

function findSourceFiles() {
  const files = fs.existsSync(SOURCE_DIR) ? fs.readdirSync(SOURCE_DIR) : [];
  const pick = (patterns) => files.find((f) => patterns.some((re) => re.test(f)));
  return {
    usda: pick([/usda.*plants.*checklist.*\.(csv|txt|bin)$/i, /complete.*plants.*\.(csv|txt|bin)$/i, /plantlst\.(csv|txt|bin)$/i]),
    usdaCharacteristics: pick([/usda.*character.*\.(csv|txt|bin)$/i, /plant.*character.*\.(csv|txt|bin)$/i, /characteristics.*\.(csv|txt|bin)$/i]),
    permapeople: pick([/permapeople.*plants.*\.json$/i]),
    trefle: pick([/trefle.*\.json$/i]),
    companion: pick([/companion.*\.(csv|json)$/i]),
  };
}


function getFirst(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') return row[name];
  }
  const normalized = Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizeName(k), v]));
  for (const name of names) {
    const key = normalizeName(name);
    if (normalized[key] !== undefined && normalized[key] !== null && String(normalized[key]).trim() !== '') return normalized[key];
  }
  return '';
}

function parseFeet(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const nums = [...s.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0])).filter(Number.isFinite);
  if (!nums.length) return null;
  let feet = Math.max(...nums);
  if (/\b(in|inch|inches)\b/i.test(s)) feet = feet / 12;
  if (/\b(cm)\b/i.test(s)) feet = feet / 30.48;
  if (/\b(m|meter|metre|meters|metres)\b/i.test(s) && !/cm/i.test(s)) feet = feet * 3.28084;
  return Math.round(feet * 10) / 10;
}

function mapUsdaShade(value) {
  const s = String(value || '').toLowerCase();
  if (!s) return [];
  if (/intolerant|full sun|low/.test(s)) return ['Full Sun'];
  if (/intermediate|partial|medium/.test(s)) return ['Full Sun', 'Part Sun'];
  if (/tolerant|shade|high/.test(s)) return ['Part Sun', 'Shade'];
  return [];
}

function mapUsdaMoisture(value, droughtValue = '') {
  const s = `${value || ''} ${droughtValue || ''}`.toLowerCase();
  if (!s.trim()) return [];
  if (/drought.*high|low\s+moisture|dry|xeric/.test(s)) return ['Low'];
  if (/drought.*low|high\s+moisture|wet|aquatic|hydric/.test(s)) return ['Moderate'];
  if (/medium|moderate|mesic/.test(s)) return ['Moderate'];
  return [];
}

function mergeRecordFields(oldRecord, newRecord) {
  if (!oldRecord) return newRecord;
  const merged = { ...oldRecord, ...Object.fromEntries(Object.entries(newRecord).filter(([, v]) => v !== '' && v !== null && v !== undefined)) };
  merged.raw = { ...(oldRecord.raw || {}), ...(newRecord.raw || {}) };
  return merged;
}

function addToUsdaIndex(index, record) {
  const keys = [
    ['scientific', index.byScientific, normalizeName(record.scientific)],
    ['scientificGs', index.byScientific, genusSpecies(record.scientific)],
    ['common', index.byCommon, normalizeName(record.common)],
    ['symbol', index.bySymbol, normalizeName(record.symbol)],
  ];
  for (const [, map, key] of keys) {
    if (!key) continue;
    map.set(key, mergeRecordFields(map.get(key), record));
  }
}

function loadUsdaIndex(fileName, characteristicsFileName = '') {
  const index = { fileName: fileName || null, characteristicsFileName: characteristicsFileName || null, count: 0, characteristicsCount: 0, byCommon: new Map(), byScientific: new Map(), bySymbol: new Map() };
  const loadRows = (name, kind) => {
    if (!name) return [];
    const fullPath = path.join(SOURCE_DIR, name);
    if (!fs.existsSync(fullPath)) return [];
    const rows = parseCsv(fs.readFileSync(fullPath, 'utf8'));
    if (kind === 'characteristics') index.characteristicsCount += rows.length;
    else index.count += rows.length;
    return rows;
  };

  for (const row of loadRows(fileName, 'checklist')) {
    const scientific = getFirst(row, ['Scientific Name with Authors', 'Scientific Name', 'Accepted Scientific Name', 'scientific_name', 'scientific']);
    const common = getFirst(row, ['National Common Name', 'Common Name', 'common_name', 'common']);
    const family = getFirst(row, ['Family', 'family']);
    const symbol = getFirst(row, ['Symbol', 'Accepted Symbol', 'USDA Symbol', 'symbol']);
    addToUsdaIndex(index, { scientific, common, family, symbol, raw: row });
  }

  for (const row of loadRows(characteristicsFileName, 'characteristics')) {
    const scientific = getFirst(row, ['Scientific Name with Authors', 'Scientific Name', 'Accepted Scientific Name', 'scientific_name', 'scientific']);
    const common = getFirst(row, ['National Common Name', 'Common Name', 'common_name', 'common']);
    const family = getFirst(row, ['Family', 'family']);
    const symbol = getFirst(row, ['Symbol', 'Accepted Symbol', 'USDA Symbol', 'symbol']);
    const maxHeightFt = parseFeet(getFirst(row, ['Height at Maturity, Maximum (feet)', 'Height, Mature (feet)', 'Maximum Height', 'Max Height', 'Mature Height', 'height_mature_ft', 'height']));
    const growthHabit = getFirst(row, ['Growth Habit', 'Growth Form', 'growth_habit']);
    const shadeTolerance = getFirst(row, ['Shade Tolerance', 'shade_tolerance']);
    const moistureUse = getFirst(row, ['Moisture Use', 'moisture_use']);
    const droughtTolerance = getFirst(row, ['Drought Tolerance', 'drought_tolerance']);
    const lifespan = getFirst(row, ['Lifespan', 'Life Span', 'lifespan']);
    const activeGrowth = getFirst(row, ['Active Growth Period', 'active_growth_period']);
    addToUsdaIndex(index, { scientific, common, family, symbol, maxHeightFt, growthHabit, shadeTolerance, moistureUse, droughtTolerance, lifespan, activeGrowth, raw: row });
  }
  return index.count || index.characteristicsCount ? index : null;
}

function loadJsonArray(fileName) {
  if (!fileName) return null;
  const fullPath = path.join(SOURCE_DIR, fileName);
  const data = readJson(fullPath, null);
  if (!data) return null;
  if (Array.isArray(data)) return { fileName, records: data };
  if (Array.isArray(data.plants)) return { fileName, records: data.plants };
  if (Array.isArray(data.data)) return { fileName, records: data.data };
  return { fileName, records: Object.values(data).filter((v) => v && typeof v === 'object') };
}

function buildFlexibleIndex(source) {
  if (!source) return null;
  const byCommon = new Map();
  const byScientific = new Map();
  for (const record of source.records) {
    const scientific = record.scientific_name || record.scientificName || record.scientific || record.binomial || '';
    const common = record.name || record.common_name || record.commonName || record.common || '';
    const scKey = normalizeName(scientific);
    const gsKey = genusSpecies(scientific);
    const coKey = normalizeName(common);
    if (scKey) byScientific.set(scKey, record);
    if (gsKey && !byScientific.has(gsKey)) byScientific.set(gsKey, record);
    if (coKey && !byCommon.has(coKey)) byCommon.set(coKey, record);
  }
  return { ...source, byCommon, byScientific };
}

function getPermapeopleData(record, key) {
  if (!record) return '';
  const data = Array.isArray(record.data) ? record.data : [];
  const found = data.find((item) => normalizeName(item.key) === normalizeName(key));
  return found?.value || '';
}

function splitValues(value) {
  if (!value) return [];
  return String(value)
    .split(/[,;/|]+|\band\b/gi)
    .map((v) => v.trim())
    .filter(Boolean);
}

function mapLight(value) {
  const out = [];
  const s = String(value || '').toLowerCase();
  if (/full\s*sun/.test(s)) out.push('Full Sun');
  if (/part|partial|shade/.test(s)) out.push('Part Sun');
  if (/full\s*shade|deep\s*shade/.test(s)) out.push('Shade');
  return [...new Set(out)];
}

function mapWater(value) {
  const s = String(value || '').toLowerCase();
  if (!s) return [];
  if (/dry|low|drought/.test(s)) return ['Low'];
  if (/wet|moist|high/.test(s)) return ['Moderate'];
  if (/medium|average|moderate/.test(s)) return ['Moderate'];
  return [];
}

function mapZones(value) {
  const s = String(value || '');
  const m = s.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a <= b) return Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
  }
  return splitValues(s).map((v) => v.replace(/[^0-9ab]/gi, '')).filter(Boolean);
}

async function fetchPermapeopleForPlant(plant) {
  const keyId = process.env.PERMAPEOPLE_KEY_ID;
  const keySecret = process.env.PERMAPEOPLE_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const query = plant.botanicalName || plant.productName || plant.commonName;
  if (!query) return null;
  const url = `https://permapeople.org/api/search?q=${encodeURIComponent(stripCultivar(query))}&per_page=5`;
  const res = await fetch(url, { headers: { 'x-permapeople-key-id': keyId, 'x-permapeople-key-secret': keySecret } });
  if (!res.ok) throw new Error(`Permapeople ${res.status} ${res.statusText}`);
  const body = await res.json();
  const records = body.plants || [];
  return chooseBestMatch(plant, records);
}

async function fetchTrefleForPlant(plant) {
  const token = process.env.TREFLE_TOKEN;
  if (!token) return null;
  const query = plant.botanicalName || plant.productName || plant.commonName;
  if (!query) return null;
  const url = `https://trefle.io/api/v1/species/search?token=${encodeURIComponent(token)}&q=${encodeURIComponent(stripCultivar(query))}&limit=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Trefle ${res.status} ${res.statusText}`);
  const body = await res.json();
  const records = body.data || [];
  return chooseBestMatch(plant, records);
}

function chooseBestMatch(plant, records) {
  const plantKeys = [plant.botanicalName, plant.productName, plant.commonName].map(normalizeName).filter(Boolean);
  let best = null;
  for (const record of records || []) {
    const recordKeys = [record.scientific_name, record.scientificName, record.scientific, record.name, record.common_name, record.commonName].map(normalizeName).filter(Boolean);
    let score = 0;
    for (const a of plantKeys) {
      for (const b of recordKeys) {
        if (!a || !b) continue;
        if (a === b) score = Math.max(score, 1);
        else if (genusSpecies(a) && genusSpecies(a) === genusSpecies(b)) score = Math.max(score, 0.92);
        else if (a.includes(b) || b.includes(a)) score = Math.max(score, 0.86);
      }
    }
    if (!best || score > best.score) best = { record, score };
  }
  return best && best.score >= 0.86 ? best : null;
}

function findBestIndexedMatch(plant, index) {
  if (!index) return null;
  const scientificKeys = [plant.botanicalName, genusSpecies(plant.botanicalName)].map(normalizeName).filter(Boolean);
  for (const key of scientificKeys) {
    const record = index.byScientific.get(key);
    if (record) return { record, score: key === normalizeName(plant.botanicalName) ? 1 : 0.92 };
  }
  const commonKeys = [plant.productName, plant.commonName].map(normalizeName).filter(Boolean);
  for (const key of commonKeys) {
    const record = index.byCommon.get(key);
    if (record) return { record, score: 0.9 };
  }
  return null;
}

function setField(plant, field, value, source, confidence, note, changes) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value) && !value.length) return false;
  const before = JSON.stringify(plant[field] ?? null);
  plant[field] = value;
  plant.sourceProvenance[field] = { source, confidence, note };
  changes.push({ plantId: plant.plantId, productName: plant.productName, field, source, confidence, oldValue: before, newValue: JSON.stringify(value), note });
  return true;
}

function enrichFromUsda(plant, match, changes) {
  if (!match) return;
  const { record, score } = match;
  const symbolNote = record.symbol ? ` symbol ${record.symbol}` : '';
  if (!plant.botanicalName && record.scientific) {
    setField(plant, 'botanicalName', record.scientific, 'usdaPlantsChecklist', score, `Matched USDA PLANTS record${symbolNote}.`, changes);
  }
  if (!plant.family && record.family) {
    setField(plant, 'family', record.family, 'usdaPlantsChecklist', score, `Matched USDA PLANTS record${symbolNote}.`, changes);
  }
  if (!plant.commonName && record.common) {
    setField(plant, 'commonName', record.common, 'usdaPlantsChecklist', score, `Matched USDA PLANTS record${symbolNote}.`, changes);
  }
  if (record.symbol && !plant.usdaPlantSymbol) {
    setField(plant, 'usdaPlantSymbol', record.symbol, 'usdaPlantsChecklist', score, 'USDA PLANTS symbol from checklist/characteristics data.', changes);
  }
  if (hasMissingObject(plant.height) && record.maxHeightFt) {
    setField(plant, 'height', { minFt: null, maxFt: record.maxHeightFt, raw: `${record.maxHeightFt} ft` }, 'usdaPlantCharacteristics', score, `USDA PLANTS characteristics mature height${symbolNote}.`, changes);
  }
  const light = mapUsdaShade(record.shadeTolerance);
  if (hasMissingArray(plant.lightRequirements) && light.length) {
    setField(plant, 'lightRequirements', light, 'usdaPlantCharacteristics', score, `USDA PLANTS characteristics shade tolerance: ${record.shadeTolerance}.`, changes);
  }
  const water = mapUsdaMoisture(record.moistureUse, record.droughtTolerance);
  if (hasMissingArray(plant.waterNeeds) && water.length) {
    setField(plant, 'waterNeeds', water, 'usdaPlantCharacteristics', score, `USDA PLANTS characteristics moisture/drought fields: ${[record.moistureUse, record.droughtTolerance].filter(Boolean).join('; ')}.`, changes);
  }
  const attrs = splitValues([record.growthHabit, record.lifespan, record.activeGrowth].filter(Boolean).join('; '));
  if (hasMissingArray(plant.attributes) && attrs.length) {
    setField(plant, 'attributes', attrs, 'usdaPlantCharacteristics', score, 'USDA PLANTS characteristics growth/lifespan fields.', changes);
  }
}

function enrichFromPermapeople(plant, match, changes) {
  if (!match) return;
  const record = match.record;
  const score = match.score;
  if (!plant.botanicalName && record.scientific_name) setField(plant, 'botanicalName', record.scientific_name, 'permapeople', score, 'Matched Permapeople plant profile.', changes);
  const family = getPermapeopleData(record, 'Family');
  if (!plant.family && family) setField(plant, 'family', family, 'permapeople', score, 'Matched Permapeople Family attribute.', changes);
  const light = mapLight(getPermapeopleData(record, 'Light requirement'));
  if (hasMissingArray(plant.lightRequirements) && light.length) setField(plant, 'lightRequirements', light, 'permapeople', score, 'Matched Permapeople Light requirement attribute.', changes);
  const water = mapWater(getPermapeopleData(record, 'Water requirement'));
  if (hasMissingArray(plant.waterNeeds) && water.length) setField(plant, 'waterNeeds', water, 'permapeople', score, 'Matched Permapeople Water requirement attribute.', changes);
  const zones = mapZones(getPermapeopleData(record, 'USDA Hardiness zone'));
  if (hasMissingArray(plant.usdaZones) && zones.length) setField(plant, 'usdaZones', zones, 'permapeople', score, 'Matched Permapeople USDA Hardiness zone attribute.', changes);
  const growth = getPermapeopleData(record, 'Growth');
  if (hasMissingArray(plant.growthRates) && growth) setField(plant, 'growthRates', splitValues(growth), 'permapeople', score, 'Matched Permapeople Growth attribute.', changes);
}

function enrichFromTrefle(plant, match, changes) {
  if (!match) return;
  const record = match.record;
  const score = match.score;
  if (!plant.botanicalName && record.scientific_name) setField(plant, 'botanicalName', record.scientific_name, 'trefle', score, 'Matched Trefle species record.', changes);
  if (!plant.family && record.family) setField(plant, 'family', record.family, 'trefle', score, 'Matched Trefle family field.', changes);
  if (!plant.genus && record.genus) setField(plant, 'genus', record.genus, 'trefle', score, 'Matched Trefle genus field.', changes);
}

function loadCompanionIndex(fileName) {
  if (!fileName) return null;
  const fullPath = path.join(SOURCE_DIR, fileName);
  let records;
  if (/\.json$/i.test(fileName)) {
    const data = readJson(fullPath, []);
    records = Array.isArray(data) ? data : Object.values(data);
  } else {
    records = parseCsv(fs.readFileSync(fullPath, 'utf8'));
  }
  const byName = new Map();
  const ensure = (name) => {
    const key = normalizeName(name);
    if (!key) return null;
    if (!byName.has(key)) byName.set(key, { companions: new Set(), antagonists: new Set(), helps: new Set(), helpedBy: new Set(), rawCount: 0 });
    return byName.get(key);
  };
  for (const r of records) {
    const source = r.source || r.Source || r['Source Node'] || r['Plant A'] || r.plant_1 || r.plant1 || r.Plant1 || r.from || r.plant || r.name || r.crop || r['Plant'] || r['Crop'] || '';
    const target = r.target || r.Target || r['Destination Node'] || r['Plant B'] || r.plant_2 || r.plant2 || r.Plant2 || r.to || r.companion || r.Companion || '';
    const rel = String(r.link || r.Link || r.relationship || r.Relationship || r.type || r.Type || r.label || '').toLowerCase();
    const sourceEntry = ensure(source);
    if (!sourceEntry) continue;
    sourceEntry.rawCount += 1;
    if (target) {
      if (/avoid|bad|antagonist|inhibit|negative/.test(rel)) sourceEntry.antagonists.add(target);
      else if (/helped_by|helped by/.test(rel)) sourceEntry.helpedBy.add(target);
      else if (/help|companion|good|positive|attract/.test(rel)) sourceEntry.companions.add(target);
      else sourceEntry.companions.add(target);
    } else {
      splitValues(r.companions || r.Companions || r['Good Companions'] || r.attracts || '').forEach((v) => sourceEntry.companions.add(v));
      splitValues(r.antagonists || r.Antagonists || r['Bad Companions'] || '').forEach((v) => sourceEntry.antagonists.add(v));
    }
  }
  return { fileName, count: records.length, byName };
}

function enrichFromCompanion(plant, companionIndex, changes) {
  if (!companionIndex) return;
  const keys = [plant.commonName, plant.productName].map(normalizeName).filter(Boolean);
  const record = keys.map((k) => companionIndex.byName.get(k)).find(Boolean);
  if (!record) return;
  const payload = {
    companions: [...record.companions].sort(),
    antagonists: [...record.antagonists].sort(),
    helps: [...record.helps].sort(),
    helpedBy: [...record.helpedBy].sort(),
  };
  if (payload.companions.length || payload.antagonists.length || payload.helps.length || payload.helpedBy.length) {
    setField(plant, 'companionPlanting', payload, 'companionDataset', 0.9, 'Matched downloaded companion planting graph dataset by common/product name.', changes);
  }
}


function enrichFromCompanionRows(plant, rows, changes) {
  if (!Array.isArray(rows) || !rows.length) return;
  const payload = { companions: [], antagonists: [], helps: [], helpedBy: [] };
  for (const row of rows) {
    const rel = String(row.link || row.Link || '').toLowerCase();
    const target = row.target || row['Destination Node'] || '';
    if (!target) continue;
    if (/avoid|bad|antagonist|inhibit|negative/.test(rel)) payload.antagonists.push(target);
    else if (/helped_by|helped by/.test(rel)) payload.helpedBy.push(target);
    else if (/help|companion|good|positive|attract/.test(rel)) payload.companions.push(target);
    else payload.companions.push(target);
  }
  payload.companions = [...new Set(payload.companions)].sort();
  payload.antagonists = [...new Set(payload.antagonists)].sort();
  payload.helps = [...new Set(payload.helps)].sort();
  payload.helpedBy = [...new Set(payload.helpedBy)].sort();
  if (payload.companions.length || payload.antagonists.length || payload.helps.length || payload.helpedBy.length) {
    setField(plant, 'companionPlanting', payload, 'companionDataset', 0.9, 'Matched processed Green Acres-only companion graph subset.', changes);
  }
}

function remainingMissing(plant) {
  const missing = [];
  // Botanical name is optional for the planner; Green Acres product name is the display/source-of-truth name.
  if (hasMissingObject(plant.height)) missing.push('height');
  if (hasMissingObject(plant.width)) missing.push('width');
  if (hasMissingArray(plant.lightRequirements)) missing.push('lightRequirements');
  if (hasMissingArray(plant.waterNeeds)) missing.push('waterNeeds');
  if (hasMissingArray(plant.attributes)) missing.push('attributes');
  return missing;
}

function cleanBadV85Inferences(plant) {
  // v84f does not include these, but keep the script defensive if someone runs it on v85 by accident.
  const p = plant.sourceProvenance || {};
  for (const [field, prov] of Object.entries(p)) {
    if (prov?.source === 'inferred' || prov?.source === 'fallback') {
      delete p[field];
    }
  }
  plant.sourceProvenance = p;
}

async function main() {
  if (!fs.existsSync(normalizedPath)) throw new Error(`Missing ${normalizedPath}`);
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  const plants = readJson(normalizedPath, []);
  const sourceFiles = findSourceFiles();
  const usdaIndex = loadUsdaIndex(sourceFiles.usda, sourceFiles.usdaCharacteristics);
  const permapeopleIndex = buildFlexibleIndex(loadJsonArray(sourceFiles.permapeople));
  const trefleIndex = buildFlexibleIndex(loadJsonArray(sourceFiles.trefle));
  const companionIndex = loadCompanionIndex(sourceFiles.companion);
  const processedSubsetIndex = loadProcessedSubsetIndex();
  const changes = [];
  const stillMissingRows = [];
  const sourceHitCounts = { usdaPlantsChecklist: 0, permapeople: 0, trefle: 0, companionDataset: 0 };

  for (const plant of plants) {
    cleanBadV85Inferences(plant);
    initProvenance(plant);

    const processedSubset = processedSubsetIndex.byPlantId.get(String(plant.plantId));

    const beforeChanges = changes.length;
    const usdaMatch = findBestIndexedMatch(plant, usdaIndex) || (processedSubset?.matches?.usdaNational ? { record: processedSubset.matches.usdaNational.record, score: processedSubset.matches.usdaNational.confidence } : null);
    enrichFromUsda(plant, usdaMatch, changes);
    if (changes.length > beforeChanges) sourceHitCounts.usdaPlantsChecklist += 1;

    const beforePerm = changes.length;
    let permMatch = findBestIndexedMatch(plant, permapeopleIndex) || (processedSubset?.matches?.permapeople ? { record: processedSubset.matches.permapeople.record, score: processedSubset.matches.permapeople.confidence } : null);
    if (!permMatch && shouldFetchPermapeople) {
      const live = await fetchPermapeopleForPlant(plant);
      if (live) permMatch = live;
    }
    enrichFromPermapeople(plant, permMatch, changes);
    if (changes.length > beforePerm) sourceHitCounts.permapeople += 1;

    const beforeTrefle = changes.length;
    let trefleMatch = findBestIndexedMatch(plant, trefleIndex);
    if (!trefleMatch && shouldFetchTrefle) {
      const live = await fetchTrefleForPlant(plant);
      if (live) trefleMatch = live;
    }
    enrichFromTrefle(plant, trefleMatch, changes);
    if (changes.length > beforeTrefle) sourceHitCounts.trefle += 1;

    const beforeComp = changes.length;
    enrichFromCompanion(plant, companionIndex, changes);
    if (changes.length === beforeComp && processedSubset?.matches?.companionGraph?.length) {
      enrichFromCompanionRows(plant, processedSubset.matches.companionGraph, changes);
    }
    if (changes.length > beforeComp) sourceHitCounts.companionDataset += 1;

    const missing = remainingMissing(plant);
    if (missing.length) {
      stillMissingRows.push({
        plantId: plant.plantId,
        productName: plant.productName,
        botanicalName: plant.botanicalName || '',
        handle: plant.handle || '',
        missingFields: missing.join('; '),
        note: 'Still missing because no high-confidence source-backed value was found.',
      });
    }
  }

  const summary = {
    createdAt: new Date().toISOString(),
    baseline: 'v84f app behavior; source-backed data enrichment only',
    dryRun,
    plantCount: plants.length,
    sourceFiles: {
      usda: sourceFiles.usda || null,
      usdaCharacteristics: sourceFiles.usdaCharacteristics || null,
      permapeople: sourceFiles.permapeople || null,
      trefle: sourceFiles.trefle || null,
      companion: sourceFiles.companion || null,
      processedSubset: processedSubsetIndex.fileName,
    },
    sourceRecordCounts: {
      usda: usdaIndex?.count || 0,
      usdaCharacteristics: usdaIndex?.characteristicsCount || 0,
      permapeople: permapeopleIndex?.records?.length || 0,
      trefle: trefleIndex?.records?.length || 0,
      companion: companionIndex?.count || 0,
      processedSubset: processedSubsetIndex.count,
    },
    liveFetch: {
      permapeopleRequested: shouldFetchPermapeople,
      permapeopleHasCredentials: Boolean(process.env.PERMAPEOPLE_KEY_ID && process.env.PERMAPEOPLE_KEY_SECRET),
      trefleRequested: shouldFetchTrefle,
      trefleHasToken: Boolean(process.env.TREFLE_TOKEN),
    },
    changedFieldCount: changes.length,
    sourceHitCounts,
    stillMissingCount: stillMissingRows.length,
    stillMissingByField: stillMissingRows.reduce((acc, row) => {
      for (const field of row.missingFields.split('; ')) acc[field] = (acc[field] || 0) + 1;
      return acc;
    }, {}),
    noGuessingPolicy: 'Fields are only filled when a source-backed record is matched with high confidence. USDA checklist is used for taxonomy; USDA characteristics data, when provided, may be used for backed height, growth habit, shade tolerance, and moisture/drought fields.',
  };

  writeCsv(reportPath, changes, ['plantId', 'productName', 'field', 'source', 'confidence', 'oldValue', 'newValue', 'note']);
  writeCsv(path.join(PUBLIC_DIR, 'green_acres_source_backed_still_missing_report.csv'), stillMissingRows, ['plantId', 'productName', 'botanicalName', 'handle', 'missingFields', 'note']);
  writeJson(summaryPath, summary);
  writeJson(sourcesPath, SOURCE_REGISTRY);

  if (!dryRun) {
    writeJson(normalizedPath, plants);
    // Leave scores in place, but add a marker that scores should be regenerated after enrichment.
    if (fs.existsSync(scorePath)) {
      const scores = readJson(scorePath, []);
      if (Array.isArray(scores)) writeJson(scorePath, scores);
    }
  }

  console.log('Source-backed enrichment complete.');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
