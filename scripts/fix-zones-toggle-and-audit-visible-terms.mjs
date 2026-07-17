import fs from 'node:fs';
import path from 'node:path';

const canvasPath = 'src/components/GardenCanvas.tsx';
let canvas = fs.readFileSync(canvasPath, 'utf8');
const original = canvas;

const exactReplacements = [
  ["Zones {zoneShapesVisible ? 'on' : 'off'}", "Areas {zoneShapesVisible ? 'on' : 'off'}"],
  ['title="Show or hide zone shapes"', 'title="Show or hide area shapes"'],
  ['Zone name', 'Area name'],
  ['Zone color', 'Area color'],
  ['Zone transparency', 'Area transparency'],
];

for (const [before, after] of exactReplacements) {
  canvas = canvas.split(before).join(after);
}

if (canvas !== original) {
  fs.writeFileSync(canvasPath, canvas);
  console.log('Fixed remaining visible area terminology in GardenCanvas.tsx.');
} else {
  console.log('No targeted GardenCanvas terminology changes were needed.');
}

const srcRoot = 'src';
const candidates = [];
const internalPatterns = [
  /\bGardenZone\b/,
  /\bZone(Type|SurfaceType|LayoutMode|PlantingType|PlantVariety|SunExposure|WaterNeed|AfternoonSun)\b/,
  /\b(zone|zones|selectedZone|editingZone|zoneDraft|zonePreview|zoneShapes|zoneModal|zoneSettings|zoneSurface|zoneEdge|onZone|setZone|handleZone|addZone|updateZone|deleteZone|duplicateZone|selectZone)[A-Za-z0-9_]*/,
  /['\"](zone|zones|zones?)['\"]/,
  /\bzoneId\b|\bselectedZoneId\b|\beditingZoneId\b/,
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) scan(full);
  }
}

function scan(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/\bZones?\b|\bzones?\b/.test(line)) return;
    if (internalPatterns.some(pattern => pattern.test(line))) return;
    candidates.push(`${file}:${index + 1}: ${line.trim()}`);
  });
}

walk(srcRoot);

if (candidates.length === 0) {
  console.log('No remaining likely user-facing Zone/Zones terms found in src.');
} else {
  console.log('\nRemaining likely user-facing terminology candidates:');
  candidates.forEach(item => console.log(`- ${item}`));
}
