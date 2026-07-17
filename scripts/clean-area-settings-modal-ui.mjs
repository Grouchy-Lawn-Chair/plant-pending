import fs from 'node:fs';

const file = 'src/components/PlanDetails.tsx';
let source = fs.readFileSync(file, 'utf8');
const newline = source.includes('\r\n') ? '\r\n' : '\n';
let text = source.replace(/\r\n/g, '\n');
const originalText = text;

function replaceOnce(before, after, label) {
  if (text.includes(after)) return;
  if (!text.includes(before)) throw new Error(`${label} anchor not found. No changes written.`);
  text = text.replace(before, after);
}

function replaceFirstAvailable(options, after, label) {
  if (text.includes(after)) return;
  const before = options.find(option => text.includes(option));
  if (!before) throw new Error(`${label} anchor not found. No changes written.`);
  text = text.replace(before, after);
}

// Normalize a few visible phrases first so this script works whether the earlier
// terminology cleanup was fully or only partly applied locally.
text = text
  .split('Controls where plants are placed inside the zone.')
  .join('Controls where plants are placed inside the area.')
  .split('Zone settings')
  .join('Area settings')
  .split('Style & zone')
  .join('Style & area')
  .split('Zone name')
  .join('Area name')
  .split('Zone color')
  .join('Area color')
  .split('Zone transparency')
  .join('Area transparency')
  .split('Delete zone')
  .join('Delete area');

// Keep the existing three-tab behavior, but use the app's normal slate/blue palette.
replaceFirstAvailable(
  [
    "{ id: 'site' as const, label: 'Site info' },\n                { id: 'generate' as const, label: 'Generate' },\n                { id: 'style' as const, label: 'Style & area' },",
    "{ id: 'site' as const, label: 'Site' },\n                { id: 'generate' as const, label: 'Generate' },\n                { id: 'style' as const, label: 'Appearance' },",
  ],
  "{ id: 'site' as const, label: 'Site' },\n                { id: 'generate' as const, label: 'Generate' },\n                { id: 'style' as const, label: 'Appearance' },",
  'area settings tab labels',
);

replaceOnce(
  "className={`rounded-xl border px-3 py-2 text-xs font-semibold ${zoneSettingsTab === tab.id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'}`}",
  "className={`rounded-xl border px-3 py-2 text-xs font-semibold ${zoneSettingsTab === tab.id ? 'border-blue-500 bg-blue-500/15 text-blue-100' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'}`}",
  'tab palette',
);

// Remove one-off emerald and sky cards from the generation panel.
replaceOnce(
  'className="rounded-2xl border border-emerald-900/70 bg-emerald-950/40 p-3"',
  'className="rounded-2xl border border-slate-700 bg-slate-900 p-3"',
  'planting type card palette',
);
replaceOnce(
  'className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200"',
  'className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300"',
  'planting type label palette',
);
replaceOnce(
  'className="mt-2 text-xs text-emerald-100/80"',
  'className="mt-2 text-xs text-slate-400"',
  'planting type helper palette',
);
replaceOnce(
  'className="rounded-2xl border border-sky-900/70 bg-sky-950/30 p-3 space-y-3"',
  'className="rounded-2xl border border-slate-700 bg-slate-900 p-3 space-y-3"',
  'fullness card palette',
);
replaceOnce(
  'className="flex items-center justify-between text-xs font-semibold text-sky-100"',
  'className="flex items-center justify-between text-xs font-semibold text-slate-300"',
  'fullness label palette',
);
replaceOnce(
  'className="text-xs text-sky-100 font-medium block mb-1"',
  'className="text-xs text-slate-300 font-medium block mb-1"',
  'variety label palette',
);
replaceOnce(
  'className="mt-1 text-xs text-sky-100/75"',
  'className="mt-1 text-xs text-slate-400"',
  'variety helper palette',
);

// Hide less-common generation controls until requested.
const seedAndRocks = `                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label title="Controls where plants are placed inside the area." className="text-xs text-slate-400 block mb-1">Layout mode</label>
                      <select
                        value={editingZone.layoutMode || 'fill'}
                        onChange={(e) => onUpdateZone(editingZone.id, { layoutMode: e.target.value as ZoneLayoutMode })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      >
                        {ZONE_LAYOUT_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Planting seed</label>
                      <input
                        type="number"
                        value={editingZone.plantingSeed ?? 12345}
                        onChange={(e) => onUpdateZone(editingZone.id, { plantingSeed: parseInt(e.target.value || '0', 10) })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={editingZone.plantingType === 'rockGarden' || editingZone.includeRocks === true}
                      disabled={editingZone.plantingType === 'rockGarden'}
                      onChange={(e) => onUpdateZone(editingZone.id, { includeRocks: e.target.checked })}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium text-white">Include rocks in generated mix</span>
                      <span className="block text-xs text-slate-400">Adds a few tasteful boulders before plants. Rock gardens always include rocks.</span>
                    </span>
                  </label>`;

const seedAndRocksReplacement = `                  <div>
                    <label title="Controls where plants are placed inside the area." className="text-xs text-slate-400 block mb-1">Layout mode</label>
                    <select
                      value={editingZone.layoutMode || 'fill'}
                      onChange={(e) => onUpdateZone(editingZone.id, { layoutMode: e.target.value as ZoneLayoutMode })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      {ZONE_LAYOUT_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <details className="rounded-xl border border-slate-800 bg-slate-900/60">
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white">Advanced generation</summary>
                    <div className="space-y-3 border-t border-slate-800 p-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Planting seed</label>
                        <input
                          type="number"
                          value={editingZone.plantingSeed ?? 12345}
                          onChange={(e) => onUpdateZone(editingZone.id, { plantingSeed: parseInt(e.target.value || '0', 10) })}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                        />
                        <p className="mt-1 text-[11px] text-slate-500">Change this only when you want a different version of the same layout.</p>
                      </div>

                      <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={editingZone.plantingType === 'rockGarden' || editingZone.includeRocks === true}
                          disabled={editingZone.plantingType === 'rockGarden'}
                          onChange={(e) => onUpdateZone(editingZone.id, { includeRocks: e.target.checked })}
                          className="mt-1"
                        />
                        <span>
                          <span className="block font-medium text-white">Include rocks</span>
                          <span className="block text-xs text-slate-400">Rock gardens always include them.</span>
                        </span>
                      </label>
                    </div>
                  </details>`;
replaceOnce(seedAndRocks, seedAndRocksReplacement, 'advanced generation controls');

// Put edge guidance in its own collapsed section.
replaceOnce(
  `<div>
                    <div title="Optional edge guidance. Front edges get lower plants; back edges get taller structure." className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Front / back edges</div>`,
  `<details className="rounded-xl border border-slate-800 bg-slate-900/60">
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white">Front and back edges</summary>
                    <div className="border-t border-slate-800 p-3">
                      <p className="mb-2 text-[11px] text-slate-500">Optional. Mark edges only when plant height should follow a direction.</p>`,
  'edge guidance accordion open',
);
replaceOnce(
  `                    </div>
                  </div>

                </div>
              )}`,
  `                    </div>
                    </div>
                  </details>

                </div>
              )}`,
  'edge guidance accordion close',
);

// Keep core site fields visible; hide optional notes.
replaceOnce(
  `                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Sun notes</label>
                    <input
                      type="text"
                      value={editingZone.sunNotes || ''}
                      onChange={(e) => onUpdateZone(editingZone.id, { sunNotes: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                      placeholder="Example: fence shade after 2 pm, neighbor tree in winter"
                    />
                  </div>`,
  `                  <details className="rounded-xl border border-slate-800 bg-slate-900/60">
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white">Site notes</summary>
                    <div className="border-t border-slate-800 p-3">
                      <input
                        type="text"
                        value={editingZone.sunNotes || ''}
                        onChange={(e) => onUpdateZone(editingZone.id, { sunNotes: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                        placeholder="Example: fence shade after 2 pm, neighbor tree in winter"
                      />
                    </div>
                  </details>`,
  'site notes accordion',
);

// Keep name and visibility visible. Move color, transparency, and notes into one accordion.
const appearanceStart = `                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Area color</label>`;
replaceOnce(
  appearanceStart,
  `                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Visible on plan</label>
                    <button
                      type="button"
                      onClick={() => onUpdateZone(editingZone.id, { visible: editingZone.visible === false })}
                      className={\`h-10 w-full rounded-xl border text-sm \${editingZone.visible === false ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-blue-500/50 bg-blue-500/15 text-blue-100'}\`}
                    >
                      {editingZone.visible === false ? 'Hidden' : 'Shown'}
                    </button>
                  </div>

                  <details className="rounded-xl border border-slate-800 bg-slate-900/60">
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white">Color, transparency, and notes</summary>
                    <div className="space-y-4 border-t border-slate-800 p-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Area color</label>`,
  'appearance accordion open',
);

const duplicateVisibility = `                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Visible on plan</label>
                      <button
                        type="button"
                        onClick={() => onUpdateZone(editingZone.id, { visible: editingZone.visible === false })}
                        className={\`h-10 w-full rounded-xl border text-sm \${editingZone.visible === false ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100'}\`}
                      >
                        {editingZone.visible === false ? 'Hidden' : 'Shown'}
                      </button>
                    </div>
                  </div>`;
replaceOnce(duplicateVisibility, '                      </div>', 'remove duplicate visibility control');

replaceOnce(
  `                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Notes</label>
                    <textarea
                      value={editingZone.notes || ''}
                      onChange={(e) => onUpdateZone(editingZone.id, { notes: e.target.value })}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                      placeholder="Example: tall hedge along back edge, rocks in corners, avoid bees near seating..."
                    />
                  </div>

                  <div className="flex gap-2 pt-2">`,
  `                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Notes</label>
                        <textarea
                          value={editingZone.notes || ''}
                          onChange={(e) => onUpdateZone(editingZone.id, { notes: e.target.value })}
                          rows={3}
                          className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                          placeholder="Example: tall hedge along back edge, rocks in corners, avoid bees near seating..."
                        />
                      </div>
                    </div>
                  </details>

                  <div className="flex gap-2 pt-2">`,
  'appearance accordion close',
);

// Write only after every guarded replacement succeeds.
if (text === originalText) {
  console.log('Area Settings modal is already cleaned up.');
  process.exit(0);
}
source = newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
fs.writeFileSync(file, source);
console.log('Cleaned the Area Settings modal without changing its tabs, flyout behavior, settings, or defaults.');
