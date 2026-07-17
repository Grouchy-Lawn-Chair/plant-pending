import fs from 'node:fs';

const path = 'src/components/PlanDetails.tsx';
let source = fs.readFileSync(path, 'utf8');
const newline = source.includes('\r\n') ? '\r\n' : '\n';
let normalized = source.replace(/\r\n/g, '\n');

const replacements = [
  ["{ id: 'canvas' as const, label: 'Canvas',", "{ id: 'canvas' as const, label: 'Yard setup',"],
  ["{ id: 'zones' as const, label: 'Zones',", "{ id: 'zones' as const, label: 'Areas',"],
  ["{ id: 'groups' as const, label: 'Groups',", "{ id: 'groups' as const, label: 'Plant sets',"],
  ["{ id: 'legend' as const, label: 'Legend',", "{ id: 'legend' as const, label: 'Plant list',"],
  ["{ id: 'debug' as const, label: 'Debug',", "{ id: 'debug' as const, label: 'Developer tools',"],
  ['Assign selected to zone', 'Assign selected to area'],
  ['No zone assigned', 'No area assigned'],
  ['<label className="text-xs text-slate-400 block mb-1">Zone</label>', '<label className="text-xs text-slate-400 block mb-1">Area</label>'],
  ["{ id: 'zones' as const, label: 'Zones' },", "{ id: 'zones' as const, label: 'Areas' },"],
  ["{ id: 'groups' as const, label: 'Groups' },", "{ id: 'groups' as const, label: 'Plant sets' },"],
  ['<h3 className="text-sm font-medium text-slate-100">Canvas</h3>', '<h3 className="text-sm font-medium text-slate-100">Yard setup</h3>'],
  ['Plan display and drafting controls.', 'Background, scale, display, and drafting controls.'],
  ['<h3 className="text-sm font-medium text-slate-100">Zones</h3>', '<h3 className="text-sm font-medium text-slate-100">Areas</h3>'],
  ['Draw zones from the canvas toolbar, then manage them here.', 'Draw planting beds, surfaces, and no-plant areas, then manage them here.'],
  ['Toggle all zone shapes on the plan', 'Show or hide all area shapes on the plan'],
  ['No zones yet. Use Draw zone on the canvas.', 'No areas yet. Use Draw area on the canvas.'],
  ["title={zone.visible === false ? 'Show this zone' : 'Hide this zone'}", "title={zone.visible === false ? 'Show this area' : 'Hide this area'}"],
  ['title="Select zone"', 'title="Select area"'],
  ['title="Duplicate zone"', 'title="Duplicate area"'],
  ['title="Zone settings"', 'title="Area settings"'],
  ['<h3 className="text-sm font-medium text-slate-100">Planting Groups</h3>', '<h3 className="text-sm font-medium text-slate-100">Plant Sets</h3>'],
  ['Reusable plant lists for zones and future auto-planting.', 'Reusable plant lists for planting areas and layout generation.'],
  ['placeholder="New group name"', 'placeholder="New plant set name"'],
  ['<label className="text-xs text-slate-400 block mb-1">Group name</label>', '<label className="text-xs text-slate-400 block mb-1">Plant set name</label>'],
  ['<h3 className="text-sm font-medium text-slate-100 mb-1">\n            Plant Legend\n          </h3>', '<h3 className="text-sm font-medium text-slate-100 mb-1">\n            Plant List\n          </h3>'],
  ['<h3 className="text-sm font-medium text-slate-100">Test Log</h3>', '<h3 className="text-sm font-medium text-slate-100">Developer Tools</h3>'],
];

let changed = 0;
for (const [before, after] of replacements) {
  if (normalized.includes(after)) continue;
  if (!normalized.includes(before)) {
    console.warn(`Skipped missing text: ${before.slice(0, 70)}`);
    continue;
  }
  normalized = normalized.split(before).join(after);
  changed += 1;
}

if (changed === 0) {
  console.log('Inspector language is already cleaned up.');
  process.exit(0);
}

source = newline === '\r\n' ? normalized.replace(/\n/g, '\r\n') : normalized;
fs.writeFileSync(path, source);
console.log(`Cleaned up inspector language with ${changed} UI-only text changes.`);
