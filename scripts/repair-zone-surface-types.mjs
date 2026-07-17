import fs from 'node:fs';

const files = [
  'src/types/plant.ts',
  'src/App.tsx',
  'src/components/PlanDetails.tsx',
  'src/components/GardenCanvas.tsx',
];

for (const path of files) {
  const source = fs.readFileSync(path, 'utf8');
  const normalized = source.replace(/\r\n/g, '\n');
  if (normalized !== source) fs.writeFileSync(path, normalized);
}

await import('./add-zone-surface-types.mjs');
