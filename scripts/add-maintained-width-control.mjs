import fs from 'node:fs';

const path = 'src/components/PlanDetails.tsx';
let source = fs.readFileSync(path, 'utf8');

if (source.includes('Maintained width')) {
  console.log('Maintained width control already exists.');
  process.exit(0);
}

const anchor = `                  {/* Color picker */}`;
if (!source.includes(anchor)) {
  throw new Error('Could not find the selected-plant color picker anchor in PlanDetails.tsx.');
}

const control = `                  {/* Maintained display width */}
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <label htmlFor={\`maintained-width-\${selectedPlaced.instanceId}\`} className="text-xs font-semibold text-slate-200">
                          Maintained width
                        </label>
                        <p className="mt-1 text-[11px] leading-4 text-slate-400">
                          Use the width you plan to keep through pruning. Natural mature width: {plant.matureWidthFt || '?'} ft.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUpdatePlacedPlant(selectedPlaced.instanceId, { displayWidthFt: null })}
                        className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-700"
                      >
                        Use mature width
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        id={\`maintained-width-\${selectedPlaced.instanceId}\`}
                        type="number"
                        min="0.5"
                        max="100"
                        step="0.25"
                        value={selectedPlaced.displayWidthFt ?? plant.matureWidthFt ?? 3}
                        onChange={(event) => {
                          const width = Number(event.target.value);
                          if (Number.isFinite(width) && width > 0) {
                            onUpdatePlacedPlant(selectedPlaced.instanceId, { displayWidthFt: width });
                          }
                        }}
                        className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                      />
                      <span className="shrink-0 text-xs text-slate-400">ft wide</span>
                    </div>
                    <p className="mt-2 text-[11px] text-emerald-300">
                      Shown on plan: {Math.round((selectedPlaced.displayWidthFt ?? plant.matureWidthFt ?? 3) * 12)} in wide. This size is used for spacing and overlap checks.
                    </p>
                  </div>

`;

source = source.replace(anchor, control + anchor);
fs.writeFileSync(path, source);
console.log('Added maintained width control to src/components/PlanDetails.tsx.');
