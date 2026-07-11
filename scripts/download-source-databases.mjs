#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, 'data', 'source-databases');
const RAW_DIR = path.join(SOURCE_DIR, 'raw');
const PROCESSED_DIR = path.join(SOURCE_DIR, 'processed');
const args = new Set(process.argv.slice(2));
const argList = process.argv.slice(2);

fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(PROCESSED_DIR, { recursive: true });

const all = args.has('--all') || argList.length === 0;
const want = (flag) => all || args.has(flag);

function getArg(name) {
  const prefix = `${name}=`;
  const found = argList.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
}

function log(msg) {
  console.log(`[source-download] ${msg}`);
}

async function downloadFile(url, outPath, headers = {}) {
  log(`Downloading ${url}`);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Download failed ${res.status} ${res.statusText}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  log(`Saved ${path.relative(ROOT, outPath)} (${buf.length.toLocaleString()} bytes)`);
  return outPath;
}

function unzipIfPossible(zipPath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const result = spawnSync('unzip', ['-o', zipPath, '-d', outDir], { stdio: 'inherit' });
  if (result.status !== 0) {
    log(`Could not unzip ${zipPath}. Keep the zip and unzip manually.`);
    return false;
  }
  return true;
}

async function downloadKaggleDataset(slug, outBaseName) {
  const username = process.env.KAGGLE_USERNAME;
  const key = process.env.KAGGLE_KEY;
  if (!username || !key) {
    log(`Skipping Kaggle dataset ${slug}: set KAGGLE_USERNAME and KAGGLE_KEY first.`);
    return null;
  }
  const auth = Buffer.from(`${username}:${key}`).toString('base64');
  const zipPath = path.join(RAW_DIR, `${outBaseName}.zip`);
  await downloadFile(`https://www.kaggle.com/api/v1/datasets/download/${slug}`, zipPath, { Authorization: `Basic ${auth}` });
  unzipIfPossible(zipPath, path.join(RAW_DIR, outBaseName));
  return zipPath;
}

async function downloadUsdaOfficialIfProvided() {
  const url = getArg('--usda-url') || process.env.USDA_PLANTS_DOWNLOAD_URL;
  if (!url) {
    log('No official USDA direct file URL provided. The USDA download page is documented in data/source-databases/README.md; download manually or pass --usda-url=https://...');
    return null;
  }
  const name = path.basename(new URL(url).pathname) || 'usda-plants-download.dat';
  const out = path.join(RAW_DIR, `usda-official-${name}`);
  await downloadFile(url, out);
  if (/\.zip$/i.test(out)) unzipIfPossible(out, path.join(RAW_DIR, 'usda-official'));
  return out;
}

async function downloadOpenFarm() {
  const candidates = [
    'https://github.com/openfarmcc/openfarm/archive/refs/heads/master.zip',
    'https://github.com/openfarmcc/openfarm/archive/refs/heads/main.zip',
  ];
  for (const url of candidates) {
    try {
      const out = path.join(RAW_DIR, `openfarm-${url.endsWith('main.zip') ? 'main' : 'master'}.zip`);
      await downloadFile(url, out);
      unzipIfPossible(out, path.join(RAW_DIR, 'openfarm'));
      return out;
    } catch (err) {
      log(`OpenFarm candidate failed: ${err.message}`);
    }
  }
  throw new Error('OpenFarm GitHub archive download failed for both master and main.');
}

async function downloadPermapeople() {
  const keyId = process.env.PERMAPEOPLE_KEY_ID;
  const keySecret = process.env.PERMAPEOPLE_KEY_SECRET;
  if (!keyId || !keySecret) {
    log('Skipping Permapeople: set PERMAPEOPLE_KEY_ID and PERMAPEOPLE_KEY_SECRET first.');
    return null;
  }
  const perPage = Number(getArg('--per-page') || 100);
  const maxPages = Number(getArg('--max-pages') || 0);
  let url = `https://permapeople.org/api/plants?per_page=${perPage}`;
  const headers = { 'x-permapeople-key-id': keyId, 'x-permapeople-key-secret': keySecret };
  const plants = [];
  let page = 0;
  while (url) {
    page += 1;
    log(`Permapeople page ${page}: ${url}`);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Permapeople ${res.status} ${res.statusText}`);
    const body = await res.json();
    const batch = body.plants || body.data || [];
    plants.push(...batch);
    if (maxPages && page >= maxPages) break;
    const p = body.pagination || {};
    url = p.next || p.next_url || p.nextUrl || '';
    if (!url && p.next_cursor) url = `https://permapeople.org/api/plants?per_page=${perPage}&cursor=${encodeURIComponent(p.next_cursor)}`;
    if (!url && p.next_page) url = `https://permapeople.org/api/plants?per_page=${perPage}&page=${encodeURIComponent(p.next_page)}`;
    if (url && url.startsWith('/')) url = `https://permapeople.org${url}`;
  }
  const out = path.join(SOURCE_DIR, 'permapeople-plants.json');
  fs.writeFileSync(out, JSON.stringify({ downloadedAt: new Date().toISOString(), plants }, null, 2) + '\n');
  log(`Saved ${path.relative(ROOT, out)} with ${plants.length.toLocaleString()} plants.`);
  return out;
}

async function downloadPermapeopleCompanionsFromLocalPlants() {
  const keyId = process.env.PERMAPEOPLE_KEY_ID;
  const keySecret = process.env.PERMAPEOPLE_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const plantsFile = path.join(SOURCE_DIR, 'permapeople-plants.json');
  if (!fs.existsSync(plantsFile)) {
    log('Skipping Permapeople companions: run --permapeople first.');
    return null;
  }
  const body = JSON.parse(fs.readFileSync(plantsFile, 'utf8'));
  const plants = body.plants || [];
  const maxPlants = Number(getArg('--max-companion-plants') || 0);
  const headers = { 'x-permapeople-key-id': keyId, 'x-permapeople-key-secret': keySecret };
  const companions = [];
  let count = 0;
  for (const plant of plants) {
    const id = plant.id || plant.slug;
    if (!id) continue;
    if (maxPlants && count >= maxPlants) break;
    count += 1;
    let url = `https://permapeople.org/api/plants/${encodeURIComponent(id)}/companions?per_page=100`;
    while (url) {
      const res = await fetch(url, { headers });
      if (!res.ok) break;
      const cbody = await res.json();
      const batch = cbody.plants || cbody.data || [];
      companions.push({ plantId: id, plantName: plant.name, companions: batch });
      const p = cbody.pagination || {};
      url = p.next || p.next_url || p.nextUrl || '';
      if (url && url.startsWith('/')) url = `https://permapeople.org${url}`;
    }
  }
  const out = path.join(SOURCE_DIR, 'permapeople-companions.json');
  fs.writeFileSync(out, JSON.stringify({ downloadedAt: new Date().toISOString(), companions }, null, 2) + '\n');
  log(`Saved ${path.relative(ROOT, out)} companion batches: ${companions.length.toLocaleString()}.`);
  return out;
}

function copyBestCsvsFromRaw() {
  const copied = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return [full];
    });
  };
  const files = walk(RAW_DIR);
  const rules = [
    { out: 'companion-plants.csv', tests: [/companion/i, /\.csv$/i] },
    { out: 'usda-plants-checklist.csv', tests: [/plant.*list|plants.*checklist|plantlst|usda/i, /\.csv$|\.txt$/i] },
    { out: 'usda-plant-characteristics.csv', tests: [/character/i, /\.csv$|\.txt$/i] },
  ];
  for (const rule of rules) {
    const hit = files.find((file) => rule.tests.every((re) => re.test(file)));
    if (hit) {
      const dest = path.join(SOURCE_DIR, rule.out);
      fs.copyFileSync(hit, dest);
      copied.push({ from: path.relative(ROOT, hit), to: path.relative(ROOT, dest) });
    }
  }
  if (copied.length) log(`Copied candidate source files:\n${copied.map((c) => `  ${c.from} -> ${c.to}`).join('\n')}`);
  else log('No obvious CSV/TXT source files found to copy from raw downloads. Check data/source-databases/raw manually.');
}

async function main() {
  log('Starting source database download setup.');
  if (want('--usda-official')) await downloadUsdaOfficialIfProvided();
  if (want('--kaggle-companion')) await downloadKaggleDataset('aramacus/companion-plants', 'kaggle-companion-plants');
  if (want('--kaggle-usda-checklist')) await downloadKaggleDataset('usdeptofag/usda-plants-checklist', 'kaggle-usda-plants-checklist');
  if (want('--openfarm')) await downloadOpenFarm();
  if (want('--permapeople')) await downloadPermapeople();
  if (want('--permapeople-companions')) await downloadPermapeopleCompanionsFromLocalPlants();
  copyBestCsvsFromRaw();
  log('Done. Next run: npm run source-backed-enrich-green-acres');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
