#!/usr/bin/env node
/**
 * Plant Image Fetcher
 * Fetches plant images from iNaturalist (primary) and Wikimedia (fallback)
 * Downloads images and updates CSV with local paths and metadata
 *
 * Usage: node scripts/fetchPlantImages.js [--limit N] [--dry-run] [--plant-id N]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optional iNaturalist API token. The public endpoints used by this script usually work without a token.
// If you ever need one, set it before running the script, for example:
// INATURALIST_API_TOKEN=your_token npm run fetch-images -- --limit 10
const INATURALIST_API_TOKEN = process.env.INATURALIST_API_TOKEN || '';

// Configuration
const CONFIG = {
  csvPath: './public/plants.csv',
  outputCsvPath: './public/plants_with_images.csv',
  imagesDir: './public/images',
  userAgent: 'GardenPlanner/1.0 (https://github.com/garden-planner)',
  rateLimitDelay: 500, // ms between requests
  maxRetries: 3,
};

// Parse command line args
const args = process.argv.slice(2);
const options = {
  limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null,
  dryRun: args.includes('--dry-run'),
  plantId: args.includes('--plant-id') ? parseInt(args[args.indexOf('--plant-id') + 1]) : null,
  force: args.includes('--force'),
  help: args.includes('--help') || args.includes('-h'),
};

if (options.help) {
  console.log(`
Plant Image Fetcher
Fetches plant images from iNaturalist and Wikimedia

Usage: node scripts/fetchPlantImages.js [options]

Options:
  --limit N       Only fetch images for first N plants (without images)
  --dry-run       Don't download images, just show what would be fetched
  --plant-id N    Only fetch image for specific plant ID
  --force         Re-download and replace existing local images
  --help, -h      Show this help message
`);
  process.exit(0);
}

// Parse full CSV text, including quoted commas and quoted line breaks.
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

// Create CSV line from values, properly quoting fields. Keep each plant on one physical line.
function createCSVLine(values) {
  return values.map((val) => {
    const str = String(val ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }).join(',');
}

// Load and parse CSV
function loadCSV() {
  const content = fs.readFileSync(CONFIG.csvPath, 'utf-8');
  const parsedRows = parseCSVRows(content);
  const headers = parsedRows[0] || [];
  const rows = parsedRows.slice(1).map(values => {
    const row = {};
    headers.forEach((h, i) => row[h] = values[i] ?? '');
    return row;
  }).filter(row => /^\d+$/.test(String(row.Plant_ID || '').trim()));
  return { headers, rows };
}

const IMAGE_COLUMNS = [
  'Thumbnail_URL',
  'Thumbnail_Local_Path',
  'Thumbnail_Source',
  'Thumbnail_License',
  'Thumbnail_Credit',
  'Thumbnail_Page_URL',
  'Image_Match_Confidence',
];

function ensureImageColumns(headers) {
  const updated = [...headers];
  for (const column of IMAGE_COLUMNS) {
    if (!updated.includes(column)) {
      updated.push(column);
    }
  }
  return updated;
}

// Save CSV. This writes the enriched CSV to plants_with_images.csv and leaves plants.csv unchanged.
function saveCSV(headers, rows) {
  const outputHeaders = ensureImageColumns(headers);
  const lines = [outputHeaders.join(',')];
  for (const row of rows) {
    const values = outputHeaders.map(h => row[h] ?? '');
    lines.push(createCSVLine(values));
  }
  fs.writeFileSync(CONFIG.outputCsvPath, lines.join('\n') + '\n', 'utf-8');
}

// Delay helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with retry
async function fetchWithRetry(url, options = {}, retries = CONFIG.maxRetries) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited, wait longer
          await delay(2000 * (i + 1));
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

// Search iNaturalist for plant images
async function searchINaturalist(botanicalName) {
  try {
    // Search for taxa matching the botanical name
    const searchUrl = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(botanicalName)}&is_active=true&rank=species&per_page=5`;
    const headers = { 'Accept': 'application/json' };
    if (INATURALIST_API_TOKEN) {
      headers.Authorization = `Bearer ${INATURALIST_API_TOKEN}`;
    }
    const searchRes = await fetchWithRetry(searchUrl, { headers });
    const searchData = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) {
      return null;
    }

    // Get the best match
    const taxon = searchData.results[0];
    const taxonId = taxon.id;

    // Get observations with photos for this taxon
    const obsUrl = `https://api.inaturalist.org/v1/observations?taxon_id=${taxonId}&has_photos=true&quality_grade=research&per_page=10&order=desc&order_by=created_at`;
    const obsRes = await fetchWithRetry(obsUrl, { headers });
    const obsData = await obsRes.json();

    if (!obsData.results || obsData.results.length === 0) {
      return null;
    }

    // Find first observation with good photo
    for (const obs of obsData.results) {
      if (obs.photos && obs.photos.length > 0) {
        const photo = obs.photos[0];
        // iNaturalist photos: get medium size for thumbnails
        const photoUrl = photo.url?.replace('square', 'medium') || photo.url;
        return {
          url: photoUrl,
          source: 'iNaturalist',
          sourceUrl: `https://www.inaturalist.org/observations/${obs.id}`,
          license: photo.license_code || 'CC BY-NC',
          credit: obs.user?.login || 'Unknown',
        };
      }
    }

    return null;
  } catch (err) {
    console.error(`  iNaturalist error: ${err.message}`);
    return null;
  }
}

// Search Wikimedia Commons for plant images
async function searchWikimedia(botanicalName) {
  try {
    // Search Wikimedia Commons
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(botanicalName)}&srnamespace=6&srlimit=10&format=json&origin=*`;
    const searchRes = await fetchWithRetry(searchUrl, {
      headers: { 'User-Agent': CONFIG.userAgent },
    });
    const searchData = await searchRes.json();

    if (!searchData.query?.search?.length) {
      return null;
    }

    // Find a good image file
    for (const result of searchData.query.search) {
      const title = result.title;

      // Get image info
      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata|user&iiurlwidth=400&format=json&origin=*`;
      const infoRes = await fetchWithRetry(infoUrl, {
        headers: { 'User-Agent': CONFIG.userAgent },
      });
      const infoData = await infoRes.json();

      const pages = infoData.query?.pages;
      if (!pages) continue;

      const page = Object.values(pages)[0];
      const imageInfo = page?.imageinfo?.[0];

      if (imageInfo?.thumburl) {
        const extMeta = imageInfo.extmetadata || {};
        return {
          url: imageInfo.thumburl,
          source: 'Wikimedia Commons',
          sourceUrl: imageInfo.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
          license: extMeta.LicenseShortName?.value || 'Public Domain',
          credit: extMeta.Artist?.value?.replace(/<[^>]*>/g, '') || imageInfo.user || 'Unknown',
        };
      }
    }

    return null;
  } catch (err) {
    console.error(`  Wikimedia error: ${err.message}`);
    return null;
  }
}

// Download image
async function downloadImage(url, outputPath) {
  const response = await fetchWithRetry(url, {
    headers: { 'User-Agent': CONFIG.userAgent },
  });

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  return outputPath;
}

// Generate safe filename
function safeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
}

// Main
async function main() {
  console.log('Plant Image Fetcher\n');

  // Ensure images directory exists
  if (!fs.existsSync(CONFIG.imagesDir)) {
    fs.mkdirSync(CONFIG.imagesDir, { recursive: true });
  }

  // Load CSV
  const { headers, rows } = loadCSV();
  console.log(`Loaded ${rows.length} plants from CSV\n`);

  // Filter plants without images
  let plantsToProcess = rows.filter(row =>
    options.force || (!row.Thumbnail_Local_Path && !row.Thumbnail_URL)
  );

  // Apply filters
  if (options.plantId) {
    plantsToProcess = plantsToProcess.filter(p => p.Plant_ID === String(options.plantId));
  } else if (options.limit) {
    plantsToProcess = plantsToProcess.slice(0, options.limit);
  }

  console.log(`Processing ${plantsToProcess.length} plants without images...\n`);

  if (options.dryRun) {
    console.log('DRY RUN - no images will be downloaded\n');
  }

  let successCount = 0;
  let failCount = 0;

  for (const row of plantsToProcess) {
    const plantId = row.Plant_ID;
    const botanicalName = row.Botanical_Name;
    const commonName = row.Common_Name;

    console.log(`[${plantId}] ${botanicalName}${commonName ? ` (${commonName})` : ''}`);

    if (options.dryRun) {
      console.log('  Would search for images...\n');
      continue;
    }

    // Try iNaturalist first
    let imageData = await searchINaturalist(botanicalName);

    // Fallback to Wikimedia
    if (!imageData) {
      console.log('  iNaturalist: no results, trying Wikimedia...');
      imageData = await searchWikimedia(botanicalName);
    }

    if (!imageData) {
      console.log('  No image found\n');
      failCount++;
      await delay(CONFIG.rateLimitDelay);
      continue;
    }

    console.log(`  Found: ${imageData.source}`);
    console.log(`  URL: ${imageData.url}`);

    // Download image
    const ext = imageData.url.split('.').pop()?.split('?')[0] || 'jpg';
    const filename = `${safeFilename(botanicalName)}_${plantId}.${ext}`;
    const localPath = path.join(CONFIG.imagesDir, filename);
    const browserPath = `/images/${filename}`;

    try {
      if (fs.existsSync(localPath) && !options.force) {
        console.log(`  Existing file found, keeping: ${localPath}`);
      } else {
        await downloadImage(imageData.url, localPath);
        console.log(`  Saved: ${localPath}`);
      }

      // Update row with image data
      const rowIndex = rows.findIndex(r => r.Plant_ID === plantId);
      if (rowIndex >= 0) {
        rows[rowIndex].Thumbnail_Local_Path = browserPath;
        rows[rowIndex].Thumbnail_URL = imageData.url;
        rows[rowIndex].Thumbnail_Source = imageData.source;
        rows[rowIndex].Thumbnail_License = imageData.license;
        rows[rowIndex].Thumbnail_Credit = imageData.credit;
        rows[rowIndex].Thumbnail_Page_URL = imageData.sourceUrl;
        rows[rowIndex].Image_Match_Confidence = 'medium';
      }

      successCount++;
    } catch (err) {
      console.error(`  Download failed: ${err.message}`);
      failCount++;
    }

    console.log('');
    await delay(CONFIG.rateLimitDelay);
  }

  // Save updated CSV
  if (!options.dryRun && successCount > 0) {
    console.log('Saving enriched CSV...');
    saveCSV(headers, rows);
    console.log(`CSV written to ${CONFIG.outputCsvPath}. Original plants.csv was not changed.\n`);
  }

  // Summary
  console.log('Summary:');
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed:  ${failCount}`);
  console.log(`  Total:   ${plantsToProcess.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
