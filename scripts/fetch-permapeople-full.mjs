#!/usr/bin/env node
/*
  Full Permapeople downloader for Garden Planner source data.

  Put this file here:
    scripts/fetch-permapeople-full.mjs

  Then run from the project folder:
    node scripts/fetch-permapeople-full.mjs --plants
    node scripts/fetch-permapeople-full.mjs --companions

  Required env vars:
    PERMAPEOPLE_KEY_ID
    PERMAPEOPLE_KEY_SECRET
*/

import fs from 'node:fs/promises';
import path from 'node:path';

const API_BASE = 'https://permapeople.org/api';
const OUT_DIR = path.join('data', 'source-databases');
const RAW_DIR = path.join(OUT_DIR, 'raw', 'permapeople-pages');
const PLANTS_OUT = path.join(OUT_DIR, 'permapeople-plants.json');
const COMPANIONS_OUT = path.join(OUT_DIR, 'permapeople-companions.json');

const args = new Set(process.argv.slice(2));
const has = (name) => args.has(name);
const getArg = (name, fallback = null) => {
  const prefix = `${name}=`;
  const found = [...args].find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const keyId = process.env.PERMAPEOPLE_KEY_ID;
const keySecret = process.env.PERMAPEOPLE_KEY_SECRET;

if (!keyId || !keySecret) {
  console.error('[permapeople] Missing PERMAPEOPLE_KEY_ID or PERMAPEOPLE_KEY_SECRET.');
  console.error('[permapeople] In PowerShell:');
  console.error('  $env:PERMAPEOPLE_KEY_ID="your_key_id"');
  console.error('  $env:PERMAPEOPLE_KEY_SECRET="your_key_secret"');
  process.exit(1);
}

const perPage = Number(getArg('--per-page', '100'));
const maxPages = getArg('--max-pages', null) ? Number(getArg('--max-pages')) : null;
const delayMs = Number(getArg('--delay-ms', '250'));
const modePlants = has('--plants') || (!has('--companions') && !has('--both'));
const modeCompanions = has('--companions') || has('--both');

const headers = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'x-permapeople-key-id': keyId,
  'x-permapeople-key-secret': keySecret,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asUrl(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return `${API_BASE.replace(/\/api$/, '')}${value}`;
  return `${API_BASE}/${value.replace(/^\/+/, '')}`;
}

function pickArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.plants)) return payload.plants;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function pickNextUrl(payload, currentPage) {
  const candidates = [
    payload?.pagination?.next,
    payload?.pagination?.next_url,
    payload?.pagination?.links?.next,
    payload?.meta?.next,
    payload?.meta?.next_url,
    payload?.links?.next,
    payload?.next,
    payload?.next_url,
  ];

  for (const candidate of candidates) {
    const url = asUrl(candidate);
    if (url) return url;
  }

  const totalPages = Number(
    payload?.pagination?.total_pages ??
    payload?.meta?.total_pages ??
    payload?.total_pages ??
    payload?.pages
  );
  if (Number.isFinite(totalPages) && currentPage < totalPages) {
    return `${API_BASE}/plants?per_page=${perPage}&page=${currentPage + 1}`;
  }

  const current = Number(
    payload?.pagination?.current_page ??
    payload?.meta?.current_page ??
    payload?.page ??
    currentPage
  );
  const hasMore = Boolean(
    payload?.pagination?.has_next ||
    payload?.meta?.has_next ||
    payload?.has_next ||
    payload?.has_more
  );
  if (hasMore) {
    return `${API_BASE}/plants?per_page=${perPage}&page=${current + 1}`;
  }

  return null;
}

async function fetchJson(url, label) {
  const response = await fetch(url, { headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${label} failed ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} returned non-JSON: ${text.slice(0, 500)}`);
  }
}

async function ensureDirs() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(RAW_DIR, { recursive: true });
}

async function downloadPlants() {
  await ensureDirs();
  let page = 1;
  let nextUrl = `${API_BASE}/plants?per_page=${perPage}`;
  const allPlants = [];
  const seenIds = new Set();
  const pageSummaries = [];

  while (nextUrl) {
    if (maxPages && page > maxPages) break;

    console.log(`[permapeople] plants page ${page}: ${nextUrl}`);
    const payload = await fetchJson(nextUrl, `plants page ${page}`);
    await fs.writeFile(path.join(RAW_DIR, `plants-page-${String(page).padStart(4, '0')}.json`), JSON.stringify(payload, null, 2));

    const plants = pickArray(payload);
    console.log(`[permapeople] page ${page} returned ${plants.length} plants`);

    let added = 0;
    for (const plant of plants) {
      const id = plant?.id ?? plant?.slug ?? plant?.name ?? JSON.stringify(plant).slice(0, 100);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allPlants.push(plant);
        added += 1;
      }
    }

    pageSummaries.push({ page, count: plants.length, added, nextUrl: pickNextUrl(payload, page) });

    const discoveredNextUrl = pickNextUrl(payload, page);

    // Some APIs omit next links. If a full page came back, try page=N fallback.
    if (!discoveredNextUrl && plants.length >= perPage) {
      nextUrl = `${API_BASE}/plants?per_page=${perPage}&page=${page + 1}`;
    } else {
      nextUrl = discoveredNextUrl;
    }

    // Stop if fallback page would loop or API keeps returning duplicates only.
    if (page > 1 && plants.length > 0 && added === 0 && !discoveredNextUrl) {
      console.log('[permapeople] fallback page produced only duplicate records; stopping.');
      break;
    }

    page += 1;
    await sleep(delayMs);
  }

  const output = {
    downloadedAt: new Date().toISOString(),
    source: 'permapeople',
    apiBase: API_BASE,
    perPage,
    maxPages,
    count: allPlants.length,
    pages: pageSummaries,
    plants: allPlants,
  };

  await fs.writeFile(PLANTS_OUT, JSON.stringify(output, null, 2));
  console.log(`[permapeople] saved ${PLANTS_OUT} with ${allPlants.length} plants.`);
}

function plantLookupKey(plant) {
  return plant?.id ?? plant?.slug ?? plant?.name ?? plant?.common_name ?? plant?.scientific_name ?? null;
}

async function readPlantsFile() {
  const raw = await fs.readFile(PLANTS_OUT, 'utf8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.plants)) return parsed.plants;
  return [];
}

async function downloadCompanions() {
  await ensureDirs();

  let plants = [];
  try {
    plants = await readPlantsFile();
  } catch {
    console.error(`[permapeople] ${PLANTS_OUT} not found yet. Run --plants first.`);
    process.exit(1);
  }

  const maxCompanionPlants = getArg('--max-companion-plants', null) ? Number(getArg('--max-companion-plants')) : null;
  const limitedPlants = maxCompanionPlants ? plants.slice(0, maxCompanionPlants) : plants;
  const companionResults = [];

  for (let index = 0; index < limitedPlants.length; index += 1) {
    const plant = limitedPlants[index];
    const key = plantLookupKey(plant);
    if (!key) continue;

    const candidates = [
      `${API_BASE}/companions/${encodeURIComponent(key)}`,
      `${API_BASE}/plants/${encodeURIComponent(key)}/companions`,
    ];

    let result = null;
    let error = null;

    for (const url of candidates) {
      try {
        console.log(`[permapeople] companions ${index + 1}/${limitedPlants.length}: ${key} -> ${url}`);
        result = await fetchJson(url, `companions for ${key}`);
        break;
      } catch (err) {
        error = String(err?.message || err);
      }
    }

    companionResults.push({
      plantKey: key,
      plantName: plant?.name ?? plant?.common_name ?? plant?.scientific_name ?? null,
      result,
      error: result ? null : error,
    });

    await sleep(delayMs);
  }

  const output = {
    downloadedAt: new Date().toISOString(),
    source: 'permapeople',
    apiBase: API_BASE,
    plantCount: plants.length,
    queriedPlantCount: limitedPlants.length,
    results: companionResults,
  };

  await fs.writeFile(COMPANIONS_OUT, JSON.stringify(output, null, 2));
  const ok = companionResults.filter((row) => row.result).length;
  console.log(`[permapeople] saved ${COMPANIONS_OUT} with ${companionResults.length} companion lookups, ${ok} successful.`);
}

if (modePlants) {
  await downloadPlants();
}

if (modeCompanions) {
  await downloadCompanions();
}
