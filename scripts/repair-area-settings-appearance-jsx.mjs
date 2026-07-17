import fs from 'node:fs';

const file = 'src/components/PlanDetails.tsx';
const source = fs.readFileSync(file, 'utf8');
const newline = source.includes('\r\n') ? '\r\n' : '\n';
let text = source.replace(/\r\n/g, '\n');

const startMarker = "              {zoneSettingsTab === 'style' && (";
const endMarker = "              )}\n            </div>";

const start = text.indexOf(startMarker);
if (start === -1) throw new Error('Appearance tab start marker not found. No changes written.');
const end = text.indexOf(endMarker, start);
if (end === -1) throw new Error('Appearance tab end marker not found. No changes written.');

const replacement = `              {zoneSettingsTab === 'style' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Area name</label>
                    <input
                      type="text"
                      value={editingZone.name}
                      onChange={(e) => onUpdateZone(editingZone.id, { name: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
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
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white">
                      Color, transparency, and notes
                    </summary>
                    <div className="space-y-4 border-t border-slate-800 p-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Area color</label>
                        <input
                          type="color"
                          value={editingZone.color}
                          onChange={(e) => onUpdateZone(editingZone.id, { color: e.target.value })}
                          className="h-10 w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-950"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <label>Area transparency</label>
                          <span>{Math.round((editingZone.opacity ?? 0.28) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="80"
                          value={(editingZone.opacity ?? 0.28) * 100}
                          onChange={(e) => onUpdateZone(editingZone.id, { opacity: parseInt(e.target.value, 10) / 100 })}
                          className="mt-2 w-full"
                        />
                      </div>

                      <div>
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

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(\`Delete \${editingZone.name}?\`)) {
                          onDeleteZone(editingZone.id);
                          setEditingZoneId(null);
                        }
                      }}
                      className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-200 hover:bg-red-900/50"
                    >
                      Delete area
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingZoneId(null)}
                      className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}`;

text = text.slice(0, start) + replacement + text.slice(end + "              )}".length);
fs.writeFileSync(file, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
console.log('Repaired the Area Settings Appearance tab JSX.');
