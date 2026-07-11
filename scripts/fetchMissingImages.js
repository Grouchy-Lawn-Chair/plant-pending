#!/usr/bin/env node
/**
 * Fetch Missing Plant Images
 *
 * This is a safer second-pass image fetcher for Garden Planner.
 *
 * It reads the most enriched plant CSV it can find:
 *   1. public/plants_with_green_acres.csv
 *   2. public/plants_with_images.csv
 *   3. public/plants.csv
 *
 * Then it tries to fill ONLY plants that do not already have:
 *   Thumbnail_Local_Path or Thumbnail_URL
 *
 * Sources:
 *   - iNaturalist taxon photos first
 *   - Wikimedia Commons fallback
 *   - Openverse fallback for openly licensed images
 *
 * It does NOT use Google Images. Google image scraping is brittle and usually
 * does not give clean license/credit metadata. This script stores source,
 * license, credit, and page URL when available.
 *
 * Usage:
 *   npm run fetch-missing-images
 *   npm run fetch-missing-images -- --limit 25
 *   npm run fetch-missing-images -- --dry-run --limit 25
 *   npm run fetch-missing-images -- --plant-id 123
 *   npm run fetch-missing-images -- --force --plant-id 123
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  inputCandidates: [
    './public/plants_with_green_acres.csv',
    './public/plants_with_images.csv',
    './public/plants.csv',
  ],
  imagesDir: './public/images',
  userAgent: 'GardenPlanner/1.0 personal plant image helper',
  rateLimitDelay: 700,
  maxRetries: 3,
};

const IMAGE_COLUMNS = [
  'Thumbnail_URL',
  'Thumbnail_Local_Path',
  'Thumbnail_Source',
  'Thumbnail_License',
  'Thumbnail_Credit',
  'Thumbnail_Page_URL',
  'Image_Match_Confidence',
];

const args = process.argv.slice(2);
const options = {
  limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : null,
  dryRun: args.includes('--dry-run'),
  plantId: args.includes('--plant-id') ? String(args[args.indexOf('--plant-id') + 1]) : null,
  force: args.includes('--force'),
  input: args.includes('--input') ? args[args.indexOf('--input') + 1] : null,
  output: args.includes('--output') ? args[args.indexOf('--output') + 1] : null,
  allowUnknownLicense: args.includes('--allow-unknown-license'),
  help: args.includes('--help') || args.includes('-h'),
};

if (options.help) {
  console.log(`
Fetch Missing Plant Images

Usage:
  npm run fetch-missing-images
  npm run fetch-missing-images -- --limit 25
  npm run fetch-missing-images -- --dry-run --limit 25
  npm run fetch-missing-images -- --plant-id 123
  npm run fetch-missing-images -- --force --plant-id 123

Options:
  --limit N                 Process only first N missing-image plants
  --dry-run                 Show what would be searched, do not download
  --plant-id N              Process one Plant_ID
  --force                   Re-fetch even if image fields already exist
  --input PATH              Use a specific input CSV
  --output PATH             Write to a specific output CSV
  --allow-unknown-license   Allow download when source has no license field
  --help, -h                Show help
`);
  process.exit(0);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pickInputCsv() {
  if (options.input) {
    if (!fs.existsSync(options.input)) {
      throw new Error(`Input CSV not found: ${options.input}`);
    }
    return options.input;
  }

  for (const candidate of CONFIG.inputCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error('No plant CSV found. Expected public/plants_with_green_acres.csv, public/plants_with_images.csv, or public/plants.csv');
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
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(current);
      current = '';
      if (row.some(value => String(value).trim() !== '')) rows.push(row);
      row = [];
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some(value => String(value).trim() !== '')) rows.push(row);

  return rows;
}

function createCSVLine(values) {
  return values.map(value => {
    const str = String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (str.includes(',') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(',');
}

function loadCSV(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const parsed = parseCSVRows(content);
  const headers = parsed[0] || [];
  const rows = parsed.slice(1).map(values => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  }).filter(row => String(row.Plant_ID || '').trim() !== '');

  return { headers, rows };
}

function ensureColumns(headers, columns) {
  const next = [...headers];
  for (const col of columns) {
    if (!next.includes(col)) next.push(col);
  }
  return next;
}

function saveCSV(csvPath, headers, rows) {
  const outputHeaders = ensureColumns(headers, IMAGE_COLUMNS);
  const lines = [createCSVLine(outputHeaders)];

  for (const row of rows) {
    lines.push(createCSVLine(outputHeaders.map(header => row[header] ?? '')));
  }

  fs.writeFileSync(csvPath, lines.join('\n') + '\n', 'utf-8');
}

function makeBackup(csvPath) {
  if (!fs.existsSync(csvPath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${csvPath}.backup-${stamp}`;
  fs.copyFileSync(csvPath, backupPath);
  return backupPath;
}

async function fetchWithRetry(url, options = {}, retries = CONFIG.maxRetries) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': CONFIG.userAgent,
          'Accept': 'application/json',
          ...(options.headers || {}),
        },
      });

      if (response.status === 429) {
        await delay(2000 * attempt);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (err) {
      lastError = err;
      await delay(CONFIG.rateLimitDelay * attempt);
    }
  }

  throw lastError;
}

function htmlToText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[×x]\s+/g, 'x ')
    .replace(/['"‘’“”]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCultivar(value) {
  return String(value || '')
    .replace(/[‘'][^’']+[’']/g, '')
    .replace(/"[^"]+"/g, '')
    .replace(/\bcv\.\s+\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function baseScientificName(value) {
  const stripped = stripCultivar(value);
  const parts = stripped.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`.replace(/[×x]$/, '').trim();
  }

  return stripped.trim();
}

function genusName(value) {
  const stripped = stripCultivar(value);
  return stripped.split(/\s+/).filter(Boolean)[0] || '';
}

function isSameBaseScientific(a, b) {
  return normalizeText(baseScientificName(a)) === normalizeText(baseScientificName(b));
}

function buildSearchTerms(row) {
  const botanical = String(row.Botanical_Name || '').trim();
  const common = String(row.Common_Name || '').trim();
  const base = baseScientificName(botanical);
  const genus = genusName(botanical);

  const terms = [];

  if (botanical) terms.push({ source: 'botanical', term: botanical, confidenceHint: 'high' });
  if (base && normalizeText(base) !== normalizeText(botanical)) terms.push({ source: 'base botanical', term: base, confidenceHint: 'high' });
  if (common) terms.push({ source: 'common', term: common, confidenceHint: 'medium' });

  // For cultivars, a genus + common-name search can sometimes find a useful Commons image.
  if (genus && common && !normalizeText(common).includes(normalizeText(genus))) {
    terms.push({ source: 'genus common', term: `${genus} ${common}`, confidenceHint: 'medium' });
  }

  const seen = new Set();
  return terms.filter(item => {
    const key = normalizeText(item.term);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getPhotoUrlFromINatPhoto(photo) {
  if (!photo) return '';
  const url = photo.medium_url || photo.url || photo.square_url || photo.original_url || '';
  return url.replace('/square.', '/medium.').replace('square', 'medium');
}

async function searchINaturalist(row) {
  const botanical = String(row.Botanical_Name || '').trim();
  const common = String(row.Common_Name || '').trim();
  const terms = buildSearchTerms(row);

  for (const search of terms) {
    const taxaUrl = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(search.term)}&is_active=true&per_page=10`;
    const res = await fetchWithRetry(taxaUrl);
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];

    for (const taxon of results) {
      if (taxon.iconic_taxon_name && taxon.iconic_taxon_name !== 'Plantae') continue;

      const taxonName = taxon.name || '';
      const preferredCommon = taxon.preferred_common_name || '';
      const exactScientific = botanical && isSameBaseScientific(botanical, taxonName);
      const commonMatch = common && preferredCommon && normalizeText(preferredCommon).includes(normalizeText(common).split(' ')[0]);

      // Avoid guessing on common-name-only results unless iNaturalist gives us a plant taxon with a photo.
      if (!exactScientific && search.source !== 'common' && search.source !== 'genus common') continue;
      if (!exactScientific && !commonMatch) continue;

      let photo = taxon.default_photo;
      let photoUrl = getPhotoUrlFromINatPhoto(photo);
      let sourceUrl = `https://www.inaturalist.org/taxa/${taxon.id}`;

      // If the taxon does not have a default photo, try a research-grade observation photo.
      if (!photoUrl) {
        const obsUrl = `https://api.inaturalist.org/v1/observations?taxon_id=${taxon.id}&has_photos=true&quality_grade=research&per_page=5&order=desc&order_by=votes`;
        const obsRes = await fetchWithRetry(obsUrl);
        const obsData = await obsRes.json();
        const obs = Array.isArray(obsData.results) ? obsData.results.find(item => item.photos?.length) : null;
        if (obs) {
          photo = obs.photos[0];
          photoUrl = getPhotoUrlFromINatPhoto(photo);
          sourceUrl = `https://www.inaturalist.org/observations/${obs.id}`;
        }
      }

      if (!photoUrl) continue;

      const license = photo.license_code || photo.license || '';
      if (!license && !options.allowUnknownLicense) {
        continue;
      }

      return {
        url: photoUrl,
        source: 'iNaturalist',
        sourceUrl,
        license: license || 'unknown',
        credit: photo.attribution || taxon.wikipedia_summary || preferredCommon || 'iNaturalist contributor',
        confidence: exactScientific ? 'high' : 'medium',
        matchedName: taxonName,
      };
    }

    await delay(CONFIG.rateLimitDelay);
  }

  return null;
}

function wikimediaTitleLooksRelevant(title, row, term) {
  const titleText = normalizeText(title.replace(/^File:/i, ''));
  const botanical = normalizeText(baseScientificName(row.Botanical_Name || ''));
  const genus = normalizeText(genusName(row.Botanical_Name || ''));
  const common = normalizeText(row.Common_Name || '');
  const termText = normalizeText(term);

  if (botanical && titleText.includes(botanical)) return true;
  if (genus && titleText.includes(genus)) return true;

  // Allow common-name matches only when at least a meaningful word appears.
  const commonWords = common.split(' ').filter(w => w.length >= 5);
  if (commonWords.some(w => titleText.includes(w))) return true;

  const termWords = termText.split(' ').filter(w => w.length >= 5);
  return termWords.some(w => titleText.includes(w));
}

async function searchWikimedia(row) {
  const terms = buildSearchTerms(row);

  for (const search of terms) {
    const query = `${search.term} plant`;
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=10&format=json&origin=*`;
    const res = await fetchWithRetry(searchUrl);
    const data = await res.json();
    const results = data.query?.search || [];

    for (const result of results) {
      const title = result.title || '';
      if (!title || !wikimediaTitleLooksRelevant(title, row, search.term)) continue;

      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata|user&iiurlwidth=500&format=json&origin=*`;
      const infoRes = await fetchWithRetry(infoUrl);
      const infoData = await infoRes.json();
      const pages = infoData.query?.pages || {};
      const page = Object.values(pages)[0];
      const imageInfo = page?.imageinfo?.[0];

      if (!imageInfo?.thumburl && !imageInfo?.url) continue;

      const extMeta = imageInfo.extmetadata || {};
      const license = htmlToText(extMeta.LicenseShortName?.value || extMeta.UsageTerms?.value || '');
      if (!license && !options.allowUnknownLicense) continue;

      return {
        url: imageInfo.thumburl || imageInfo.url,
        source: 'Wikimedia Commons',
        sourceUrl: imageInfo.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
        license: license || 'unknown',
        credit: htmlToText(extMeta.Artist?.value || imageInfo.user || 'Wikimedia Commons contributor'),
        confidence: search.source.includes('botanical') ? 'medium' : 'low',
        matchedName: title,
      };
    }

    await delay(CONFIG.rateLimitDelay);
  }

  return null;
}


function openverseResultLooksRelevant(result, row, term) {
  const bits = [
    result.title || '',
    result.description || '',
    result.tags ? result.tags.map(tag => tag.name || tag).join(' ') : '',
  ].join(' ');

  const text = normalizeText(bits);
  const botanical = normalizeText(baseScientificName(row.Botanical_Name || ''));
  const genus = normalizeText(genusName(row.Botanical_Name || ''));
  const common = normalizeText(row.Common_Name || '');
  const termText = normalizeText(term);

  if (botanical && text.includes(botanical)) return true;

  // Genus-only matches are useful for rare cultivars, but require at least one
  // other meaningful common/search word so we do not grab a random related plant.
  const meaningfulWords = [
    ...common.split(' '),
    ...termText.split(' '),
  ].filter(word => word.length >= 5 && word !== genus && word !== 'plant');

  if (genus && text.includes(genus) && meaningfulWords.some(word => text.includes(word))) return true;
  if (meaningfulWords.some(word => text.includes(word))) return true;

  return false;
}

async function searchOpenverse(row) {
  const terms = buildSearchTerms(row);

  for (const search of terms) {
    const query = `${search.term} plant`;
    const openverseUrl = `https://api.openverse.org/v1/images?q=${encodeURIComponent(query)}&page_size=10&mature=false`;
    const res = await fetchWithRetry(openverseUrl);
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];

    for (const result of results) {
      if (!openverseResultLooksRelevant(result, row, search.term)) continue;

      const imageUrl = result.thumbnail || result.url || '';
      if (!imageUrl) continue;

      const license = [result.license, result.license_version].filter(Boolean).join(' ').trim();
      if (!license && !options.allowUnknownLicense) continue;

      const creator = result.creator || result.provider || 'Openverse contributor';
      const title = result.title || search.term;

      return {
        url: imageUrl,
        source: 'Openverse',
        sourceUrl: result.foreign_landing_url || result.url || `https://openverse.org/search/image?q=${encodeURIComponent(query)}`,
        license: license || 'unknown',
        credit: `${creator}${result.provider ? ` via ${result.provider}` : ''}`,
        confidence: search.source.includes('botanical') ? 'medium' : 'low',
        matchedName: title,
      };
    }

    await delay(CONFIG.rateLimitDelay);
  }

  return null;
}

async function downloadImage(url, outputPath) {
  const response = await fetchWithRetry(url, {
    headers: {
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}

function safeFilename(value) {
  return String(value || 'plant')
    .replace(/[‘’'"]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'plant';
}

function extensionFromUrl(url) {
  const clean = String(url).split('?')[0].split('#')[0];
  const ext = clean.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  return 'jpg';
}

function hasImage(row) {
  return Boolean(String(row.Thumbnail_Local_Path || '').trim() || String(row.Thumbnail_URL || '').trim());
}

async function main() {
  console.log('Fetch Missing Plant Images\n');

  const inputCsv = pickInputCsv();
  const outputCsv = options.output || inputCsv;

  console.log(`Input:  ${inputCsv}`);
  console.log(`Output: ${outputCsv}`);

  if (!fs.existsSync(CONFIG.imagesDir)) {
    fs.mkdirSync(CONFIG.imagesDir, { recursive: true });
  }

  const { headers, rows } = loadCSV(inputCsv);
  console.log(`Loaded ${rows.length} plant rows\n`);

  let plantsToProcess = rows.filter(row => options.force || !hasImage(row));

  if (options.plantId) {
    plantsToProcess = rows.filter(row => String(row.Plant_ID || '').trim() === options.plantId);
  }

  if (options.limit && !options.plantId) {
    plantsToProcess = plantsToProcess.slice(0, options.limit);
  }

  console.log(`Processing ${plantsToProcess.length} plants${options.force ? '' : ' missing images'}...\n`);

  if (options.dryRun) {
    console.log('DRY RUN, no files will be changed\n');
    for (const row of plantsToProcess) {
      console.log(`[${row.Plant_ID}] ${row.Botanical_Name || ''} (${row.Common_Name || ''})`);
      for (const term of buildSearchTerms(row)) {
        console.log(`  Would search ${term.source}: ${term.term}`);
      }
      console.log('');
    }
    return;
  }

  let matched = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of plantsToProcess) {
    const plantId = String(row.Plant_ID || '').trim();
    const botanical = String(row.Botanical_Name || '').trim();
    const common = String(row.Common_Name || '').trim();

    console.log(`[${plantId}] ${botanical}${common ? ` (${common})` : ''}`);

    try {
      let imageData = await searchINaturalist(row);

      if (!imageData) {
        console.log('  iNaturalist: no safe match, trying Wikimedia Commons...');
        imageData = await searchWikimedia(row);
      }

      if (!imageData) {
        console.log('  Wikimedia Commons: no safe match, trying Openverse...');
        imageData = await searchOpenverse(row);
      }

      if (!imageData) {
        console.log('  No safe image match found\n');
        failed++;
        await delay(CONFIG.rateLimitDelay);
        continue;
      }

      const ext = extensionFromUrl(imageData.url);
      const filename = `${safeFilename(botanical || common)}_${plantId}.${ext}`;
      const localPath = path.join(CONFIG.imagesDir, filename);
      const browserPath = `/images/${filename}`;

      if (fs.existsSync(localPath) && !options.force) {
        console.log(`  Keeping existing file: ${browserPath}`);
      } else {
        await downloadImage(imageData.url, localPath);
        console.log(`  Saved: ${browserPath}`);
      }

      row.Thumbnail_URL = imageData.url;
      row.Thumbnail_Local_Path = browserPath;
      row.Thumbnail_Source = imageData.source;
      row.Thumbnail_License = imageData.license;
      row.Thumbnail_Credit = imageData.credit;
      row.Thumbnail_Page_URL = imageData.sourceUrl;
      row.Image_Match_Confidence = imageData.confidence;

      console.log(`  Source: ${imageData.source}`);
      console.log(`  Match:  ${imageData.matchedName || 'unknown'} (${imageData.confidence})\n`);

      matched++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err || 'Unknown error');
      console.log(`  Failed: ${message}\n`);
      failed++;
    }

    await delay(CONFIG.rateLimitDelay);
  }

  if (matched > 0) {
    let backup = null;
    if (outputCsv === inputCsv) {
      backup = makeBackup(inputCsv);
    }
    saveCSV(outputCsv, headers, rows);

    if (backup) {
      console.log(`Backup written: ${backup}`);
    }
    console.log(`Updated CSV written: ${outputCsv}\n`);
  } else {
    console.log('No CSV changes needed.\n');
  }

  console.log('Summary:');
  console.log(`  Matched: ${matched}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${plantsToProcess.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
