import fs from 'node:fs';

const file = 'src/components/PlanDetails.tsx';
const original = fs.readFileSync(file, 'utf8');
const newline = original.includes('\r\n') ? '\r\n' : '\n';
let text = original.replace(/\r\n/g, '\n');

const startMarker = "{zoneSettingsTab === 'generate' && editingZone.zoneType !== 'exclusion' && (";
const endMarker = "{zoneSettingsTab === 'generate' && editingZone.zoneType === 'exclusion' && (";
const start = text.indexOf(startMarker);
const end = text.indexOf(endMarker);

if (start === -1 || end === -1 || end <= start) {
  throw new Error('Generate tab boundaries not found. No changes written.');
}

let block = text.slice(start, end);
const originalBlock = block;

const replacements = [
  // Remove decorative all-caps section styling.
  ['text-xs font-semibold uppercase tracking-[0.16em] text-slate-300', 'text-sm font-semibold text-slate-100'],
  ['text-xs font-semibold uppercase tracking-[0.16em] text-slate-400', 'text-sm font-semibold text-slate-200'],
  ['text-xs text-slate-400 block mb-1', 'text-xs font-medium text-slate-300 block mb-1.5'],
  ['text-xs text-slate-300 font-medium block mb-1', 'text-xs font-medium text-slate-300 block mb-1.5'],
  ['text-xs font-semibold text-slate-300', 'text-sm font-semibold text-slate-100'],

  // Unify cards and controls with the app slate palette.
  ['rounded-2xl border border-slate-700 bg-slate-900 p-3', 'rounded-xl border border-slate-800 bg-slate-900/70 p-3'],
  ['rounded-2xl border border-slate-700 bg-slate-900 p-3 space-y-3', 'rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-3'],
  ['rounded-xl border border-slate-700 bg-slate-900', 'rounded-lg border border-slate-700 bg-slate-950'],
  ['rounded-xl border border-slate-800 bg-slate-900/60', 'rounded-lg border border-slate-800 bg-slate-900/50'],
  ['rounded-xl border border-slate-800 bg-slate-950', 'rounded-lg border border-slate-800 bg-slate-950'],

  // Make helper text consistent and quieter.
  ['text-xs text-slate-400', 'text-xs leading-5 text-slate-400'],
  ['text-[11px] text-slate-500', 'text-[11px] leading-4 text-slate-500'],
  ['text-xs text-blue-300', 'text-xs leading-5 text-slate-400'],

  // Use one accent color for the main action.
  ['className="w-full rounded-2xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-500"', 'className="w-full rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"'],

  // Clean accordion summaries.
  ['cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white', 'cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800/60 hover:text-white'],

  // Cleaner input sizing.
  ['px-3 py-2 text-sm text-white', 'px-3 py-2.5 text-sm text-white'],
  ['px-2 py-1 text-white', 'px-2 py-1.5 text-sm text-white'],
];

for (const [before, after] of replacements) {
  block = block.split(before).join(after);
}

// Keep the vocabulary concise and consistent.
block = block
  .split('Assigned planting group')
  .join('Plant set')
  .split('No group assigned, generator will auto-pick from the catalog using the area settings.')
  .join('No plant set selected. The generator will choose from the catalog using these area settings.')
  .split('No group assigned, generator will auto-pick from the catalog using the zone settings.')
  .join('No plant set selected. The generator will choose from the catalog using these area settings.')
  .split('Planting type')
  .join('Planting style')
  .split('Planting seed')
  .join('Layout seed')
  .split('Generate planting layout')
  .join('Generate layout');

if (block === originalBlock) {
  console.log('Area Settings Generate tab visuals are already cleaned up.');
  process.exit(0);
}

text = text.slice(0, start) + block + text.slice(end);
const output = newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
fs.writeFileSync(file, output);
console.log('Cleaned the Area Settings Generate tab typography, spacing, and colors.');
