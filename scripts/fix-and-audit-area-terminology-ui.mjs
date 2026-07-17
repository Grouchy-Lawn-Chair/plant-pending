import fs from 'node:fs';
import path from 'node:path';

const root = 'src';
const extensions = new Set(['.ts', '.tsx']);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return extensions.has(path.extname(entry.name)) ? [full] : [];
  });
}

const replacements = [
  ['Zones on', 'Areas on'],
  ['Zones off', 'Areas off'],
  ['Zone name', 'Area name'],
  ['Zone color', 'Area color'],
  ['Zone transparency', 'Area transparency'],
  ['Zone opacity', 'Area opacity'],
  ['Zone visibility', 'Area visibility'],
  ['Zone notes', 'Area notes'],
  ['Zone settings', 'Area settings'],
  ['ZONE SETTINGS', 'AREA SETTINGS'],
  ['Select zone', 'Select area'],
  ['Duplicate zone', 'Duplicate area'],
  ['Delete zone', 'Delete area'],
  ['Show this zone', 'Show this area'],
  ['Hide this zone', 'Hide this area'],
  ['No zones yet', 'No areas yet'],
  ['Draw zone', 'Draw area'],
  ['Cancel zone', 'Cancel area'],
  ['Show or hide zone shapes', 'Show or hide area shapes'],
  ['zone shapes', 'area shapes'],
  ['Zone sheets', 'Area sheets'],
  ['zone sheets', 'area sheets'],
];

let total = 0;
const changed = [];
for (const file of walk(root)) {
  const original = fs.readFileSync(file, 'utf8');
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  let source = original.replace(/\r\n/g, '\n');
  let count = 0;
  for (const [before, after] of replacements) {
    const occurrences = source.split(before).length - 1;
    if (!occurrences) continue;
    source = source.split(before).join(after);
    count += occurrences;
  }
  if (count) {
    fs.writeFileSync(file, newline === '\r\n' ? source.replace(/\n/g, '\r\n') : source);
    total += count;
    changed.push(`${file} (${count})`);
  }
}

console.log(total ? `Fixed ${total} missed area labels:` : 'No known missed area labels found.');
changed.forEach(file => console.log(`- ${file}`));

const candidates = [];
const visiblePattern = /(>|'|"|`)[^\n]*(\bZone\b|\bZones\b|\bzone\b|\bzones\b)[^\n]*/;
const likelyInternal = /(GardenZone|ZoneType|ZoneSurfaceType|selectedZone|zoneId|zoneType|zones\.|zones\[|on[A-Z][A-Za-z]*Zone|set[A-Z][A-Za-z]*Zone|zone\.|zone:|zone\?|zone\)|zone,|zone;|zone\])/;

for (const file of walk(root)) {
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  lines.forEach((line, index) => {
    if (!visiblePattern.test(line)) return;
    if (likelyInternal.test(line) && !/["'`>][^"'`<>]*(Zone|Zones|zone|zones)[^"'`<>]*["'`<]/.test(line)) return;
    candidates.push(`${file}:${index + 1}: ${line.trim()}`);
  });
}

if (candidates.length) {
  console.log('\nRemaining user-facing terminology candidates to review:');
  candidates.forEach(item => console.log(item));
} else {
  console.log('\nNo remaining obvious user-facing Zone/Zones labels found.');
}
