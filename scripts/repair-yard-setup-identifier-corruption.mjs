import fs from 'node:fs';

const files = ['src/App.tsx', 'src/components/GardenCanvas.tsx'];
let total = 0;

for (const path of files) {
  if (!fs.existsSync(path)) continue;
  const original = fs.readFileSync(path, 'utf8');
  const count = original.split('Yard setup').length - 1;
  if (count === 0) continue;
  const repaired = original.split('Yard setup').join('Canvas');
  fs.writeFileSync(path, repaired);
  total += count;
  console.log(`Repaired ${path} (${count} identifier/text replacements).`);
}

if (total === 0) {
  console.log('No Yard setup identifier corruption found.');
} else {
  console.log(`Repaired ${total} corrupted Canvas identifiers. Reapply visible Yard setup wording only through targeted UI labels.`);
}
