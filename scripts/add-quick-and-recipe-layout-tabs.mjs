import fs from 'node:fs';

const planFile = 'src/components/PlanDetails.tsx';
const recipeFile = 'src/RecipeAppIntegration.tsx';

function read(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return { raw, newline: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
}

function write(path, text, newline) {
  fs.writeFileSync(path, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

function replaceOnce(text, before, after, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`${label} anchor not found. No files written.`);
  return text.replace(before, after);
}

const plan = read(planFile);
let planText = plan.text;

planText = replaceOnce(
  planText,
  "const [zoneSettingsTab, setZoneSettingsTab] = useState<'site' | 'generate' | 'style'>('site');",
  "const [zoneSettingsTab, setZoneSettingsTab] = useState<'site' | 'quick' | 'recipe' | 'style'>('site');",
  'area settings tab state',
);

planText = planText.replace('grid grid-cols-3 gap-2 border-b', 'grid grid-cols-4 gap-2 border-b');

const tabVariants = [
  `                { id: 'site' as const, label: 'Site' },\n                { id: 'generate' as const, label: 'Generate' },\n                { id: 'style' as const, label: 'Appearance' },`,
  `                { id: 'site' as const, label: 'Site info' },\n                { id: 'generate' as const, label: 'Generate' },\n                { id: 'style' as const, label: 'Style & area' },`,
  `                { id: 'site' as const, label: 'Site info' },\n                { id: 'generate' as const, label: 'Generate' },\n                { id: 'style' as const, label: 'Style & zone' },`,
];
const newTabs = `                { id: 'site' as const, label: 'Site' },\n                { id: 'quick' as const, label: 'Quick layout' },\n                { id: 'recipe' as const, label: 'Recipe layout' },\n                { id: 'style' as const, label: 'Appearance' },`;
if (!planText.includes(newTabs)) {
  const variant = tabVariants.find(value => planText.includes(value));
  if (!variant) throw new Error('area settings tab list anchor not found. No files written.');
  planText = planText.replace(variant, newTabs);
}

planText = planText
  .split("zoneSettingsTab === 'generate'")
  .join("zoneSettingsTab === 'quick'");

const quickOpen = `              {zoneSettingsTab === 'quick' && editingZone.zoneType !== 'exclusion' && (\n                <div className="space-y-4">`;
const quickOpenWithHost = `              {zoneSettingsTab === 'quick' && editingZone.zoneType !== 'exclusion' && (\n                <div className="space-y-4">\n                  <div data-quick-recipe-mix-host />`;
planText = replaceOnce(planText, quickOpen, quickOpenWithHost, 'quick layout host');

const recipeBlock = `\n              {zoneSettingsTab === 'recipe' && editingZone.zoneType !== 'exclusion' && (\n                <div data-recipe-layout-host className="space-y-4" />\n              )}\n\n              {zoneSettingsTab === 'recipe' && editingZone.zoneType === 'exclusion' && (\n                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">\n                  Recipe layout is available only for planting areas. Change the area type in Site first.\n                </div>\n              )}\n`;
const styleAnchor = `\n              {zoneSettingsTab === 'style' && (`;
if (!planText.includes(recipeBlock.trim())) {
  if (!planText.includes(styleAnchor)) throw new Error('appearance tab anchor not found. No files written.');
  planText = planText.replace(styleAnchor, `${recipeBlock}${styleAnchor}`);
}

const recipe = read(recipeFile);
let recipeText = recipe.text;

const quickPanel = `\nfunction QuickRecipeMixPanel({ host }: { host: HTMLElement }) {\n  const [selectedId, setSelectedId] = useState('');\n  const [message, setMessage] = useState('');\n  const selectedRecipe = recipeCatalog.find(recipe => recipe.id === selectedId);\n\n  const applyMix = () => {\n    if (!selectedRecipe) { setMessage('Choose a recipe first.'); return; }\n    const plan = readPlan();\n    if (!plan) { setMessage('No current plan was found.'); return; }\n    const modal = host.closest('div.fixed') || host.parentElement?.parentElement;\n    const zoneName = modal?.querySelector('h3')?.textContent?.trim();\n    const zones = (plan.zones || []) as GardenZone[];\n    const zone = zones.find(item => item.name === zoneName);\n    if (!zone) { setMessage('The current area could not be found.'); return; }\n\n    const groupId = \`quick-recipe-\${zone.id}\`;\n    const group: PlantingGroup = {\n      id: groupId,\n      name: \`Recipe mix · \${selectedRecipe.name}\`,\n      notes: \`Plant mix only. Quick layout ignores recipe placement rules. \${selectedRecipe.designIntent || ''}\`.trim(),\n      plantIds: [...new Set(selectedRecipe.plants.map(item => item.plantId))],\n    };\n    const plantingGroups = [...((plan.plantingGroups || []) as PlantingGroup[]).filter(item => item.id !== groupId), group];\n    const nextZones = zones.map(item => item.id === zone.id ? {\n      ...item,\n      plantingGroupId: groupId,\n      plantingGroupName: group.name,\n      plantingRecipeId: selectedRecipe.id,\n      plantingRecipeName: selectedRecipe.name,\n    } : item);\n    const nextPlan = {\n      ...plan,\n      id: plan.id || 'current-plan',\n      name: plan.name || 'My Garden Plan',\n      createdAt: plan.createdAt || new Date().toISOString(),\n      updatedAt: new Date().toISOString(),\n      placedPlants: (plan.placedPlants || []) as PlacedPlant[],\n      zones: nextZones,\n      plantingGroups,\n      notes: plan.notes || '',\n    } as GardenPlan;\n\n    if (!applyPlan(host, nextPlan)) { setMessage('The running app could not accept the recipe mix.'); return; }\n    setMessage(\`Using \${selectedRecipe.name} as the plant mix. Quick layout will arrange these plants with its normal rules.\`);\n  };\n\n  return createPortal(\n    <section className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-100">\n      <div className="text-sm font-semibold">Recipe plant mix</div>\n      <p className="mt-1 text-xs leading-5 text-slate-400">Use a recipe's plants without its placement pattern.</p>\n      <label className="mt-3 block text-xs font-medium text-slate-300">Recipe\n        <select value={selectedId} onChange={event => setSelectedId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">\n          <option value="">Choose a recipe</option>\n          {recipeCatalog.map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}\n        </select>\n      </label>\n      {selectedRecipe && <p className="mt-2 text-xs leading-5 text-slate-400">{selectedRecipe.designIntent}</p>}\n      <button type="button" onClick={applyMix} disabled={!selectedRecipe} className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">Use this plant mix</button>\n      {message && <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-slate-300">{message}</div>}\n    </section>,\n    host,\n  );\n}\n`;

if (!recipeText.includes('function QuickRecipeMixPanel')) {
  const insertBefore = '\nexport default function RecipeAppIntegration() {';
  if (!recipeText.includes(insertBefore)) throw new Error('recipe integration export anchor not found. No files written.');
  recipeText = recipeText.replace(insertBefore, `${quickPanel}${insertBefore}`);
}

const oldExportStart = `export default function RecipeAppIntegration() {\n  const [host, setHost] = useState<HTMLElement | null>(null);`;
const newExportStart = `export default function RecipeAppIntegration() {\n  const [recipeHost, setRecipeHost] = useState<HTMLElement | null>(null);\n  const [quickHost, setQuickHost] = useState<HTMLElement | null>(null);`;
recipeText = replaceOnce(recipeText, oldExportStart, newExportStart, 'recipe integration host state');

const oldFind = `      const label = [...document.querySelectorAll('label')].find(item => item.textContent?.trim() === 'Planting type');\n      const card = label?.closest('div.rounded-2xl');\n      const parent = card?.parentElement;\n      if (!card || !parent) { setHost(null); return; }\n      let recipeHost = parent.querySelector<HTMLElement>('[data-recipe-react-host]');\n      if (!recipeHost) {\n        recipeHost = document.createElement('div');\n        recipeHost.dataset.recipeReactHost = 'true';\n        parent.insertBefore(recipeHost, card);\n      }\n      setHost(recipeHost);`;
const newFind = `      setRecipeHost(document.querySelector<HTMLElement>('[data-recipe-layout-host]'));\n      setQuickHost(document.querySelector<HTMLElement>('[data-quick-recipe-mix-host]'));`;
recipeText = replaceOnce(recipeText, oldFind, newFind, 'recipe host discovery');

const oldReturn = `  return <><App />{host && <RecipePanel host={host} />}</>;`;
const newReturn = `  return <>\n    <App />\n    {quickHost && <QuickRecipeMixPanel host={quickHost} />}\n    {recipeHost && <RecipePanel host={recipeHost} />}\n  </>;`;
recipeText = replaceOnce(recipeText, oldReturn, newReturn, 'recipe integration render');

// Bring the existing recipe editor into the same palette and typography as Area Settings.
recipeText = recipeText
  .split('rounded-2xl border border-violet-500/50 bg-violet-950/25 p-3 text-slate-100')
  .join('rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-100')
  .split('text-[10px] font-extrabold uppercase tracking-[.17em] text-violet-300')
  .join('text-sm font-semibold text-slate-100')
  .split('Plant recipe engine')
  .join('Recipe layout')
  .split('mt-1 text-sm font-bold')
  .join('mt-1 text-xs font-normal text-slate-400')
  .split('Recipe controls')
  .join('Build the layout from a recipe pattern, then adjust the details below.')
  .split('border-violet-500/20')
  .join('border-slate-700')
  .split('border-emerald-500/30 bg-emerald-950/15')
  .join('border-slate-700 bg-slate-950')
  .split('text-emerald-200')
  .join('text-slate-200')
  .split('bg-emerald-700')
  .join('bg-blue-600')
  .split('border-violet-400/50 bg-violet-950')
  .join('border-slate-700 bg-slate-950')
  .split('bg-violet-600')
  .join('bg-blue-600')
  .split('hover:bg-violet-500')
  .join('hover:bg-blue-500')
  .split('hover:bg-violet-900')
  .join('hover:bg-slate-800')
  .split('font-black')
  .join('font-semibold');

write(planFile, planText, plan.newline);
write(recipeFile, recipeText, recipe.newline);
console.log('Added Site, Quick layout, Recipe layout, and Appearance tabs.');
console.log('Quick layout can now use any recipe as a plant mix without recipe placement rules.');
console.log('Recipe layout contains the full recipe-based placement controls.');
