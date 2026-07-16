import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import App from './App';
import { recipeCatalog, type AppRecipe } from './data/recipeCatalog';
import {
  runRecipePhysics,
  type OpenSpaceFill,
  type PlantGrouping,
  type PlantSpacing,
  type RecipeDropOrder,
  type RecipeLayoutBehavior,
  type RecipePhysicsLayer,
  type RecipePlacementMode,
} from './engine/recipePhysicsEngine';
import type { GardenPlan, GardenZone, PlacedPlant, Plant, PlantingGroup } from './types/plant';
import { loadPlantsFromCSV } from './utils/csvParser';
import { edgeDebug, nearestRoleEdge, recipeRunId, recipeSnapshot, recordRecipeDebug } from './utils/recipeGenerationDebug';

const CURRENT_PLAN_KEY = 'garden-planner-current';
const STABLE_RECIPE_COLORS = ['#D54E27', '#A3DECF', '#A073C2', '#DDE985', '#59A5CB', '#E8B85C', '#B26175', '#6CA47F', '#88778F', '#F6DA7B', '#79C7A5', '#D76F4C', '#8B6FAF', '#94B797', '#C98A5F', '#7FAEBC', '#DFA3A3', '#B8C96F', '#6E8F73', '#94AA75'];
const stablePlantColor = (plantId: number) => STABLE_RECIPE_COLORS[Math.abs(Math.imul(plantId, 2654435761)) % STABLE_RECIPE_COLORS.length];

type HookNode = { memoizedState?: unknown; queue?: { dispatch?: (value: unknown) => void } | null; next?: HookNode | null };
type FiberNode = { child?: FiberNode | null; sibling?: FiberNode | null; return?: FiberNode | null; memoizedProps?: Record<string, unknown> | null; pendingProps?: Record<string, unknown> | null; memoizedState?: HookNode | null };
type PlantControl = {
  plantId: number;
  name: string;
  enabled: boolean;
  weight: number;
  count: number | null;
  layer: RecipePhysicsLayer;
  widthInches: number;
  clump: number;
  mode: RecipePlacementMode;
  grouping: PlantGrouping;
  spacing: PlantSpacing;
};
type ControlState = {
  seed: number;
  density: number;
  targetCount: number | null;
  layoutBehavior: RecipeLayoutBehavior;
  allowedOverlap: 0;
  padding: number;
  iterations: number;
  passes: number;
  attractionStrength: number;
  clumpStrength: number;
  keepCentersInside: boolean;
  replaceExisting: boolean;
  dropOrder: RecipeDropOrder;
  physicsPercent: number;
  spacingPad: number;
  openSpaceFill: OpenSpaceFill;
  plants: PlantControl[];
};

function findFiber(element: Element | null): FiberNode | null {
  let current = element;
  while (current) {
    const key = Object.keys(current).find(name => name.startsWith('__reactFiber$'));
    if (key) return (current as unknown as Record<string, FiberNode>)[key] || null;
    current = current.parentElement;
  }
  return null;
}
function rootOf(start: FiberNode | null) { let root = start; if (!root) return null; while (root.return) root = root.return; return root; }
function findCallback(start: FiberNode | null, name: string): ((plan: GardenPlan) => void) | null {
  const root = rootOf(start);
  if (!root) return null;
  const stack = [root];
  const seen = new Set<FiberNode>();
  while (stack.length) {
    const fiber = stack.pop()!;
    if (seen.has(fiber)) continue;
    seen.add(fiber);
    const callback = fiber.memoizedProps?.[name] ?? fiber.pendingProps?.[name];
    if (typeof callback === 'function') return callback as (plan: GardenPlan) => void;
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
  return null;
}
function applyPlan(host: HTMLElement, plan: GardenPlan) { const callback = findCallback(findFiber(host), 'onImportPlan') || findCallback(findFiber(host), 'onLoadPlan'); if (!callback) return false; callback(plan); return true; }
function readPlan(): Partial<GardenPlan> | null { try { const raw = localStorage.getItem(CURRENT_PLAN_KEY); return raw ? JSON.parse(raw) as Partial<GardenPlan> : null; } catch { return null; } }
function defaultMode(layer: RecipePhysicsLayer): RecipePlacementMode { return layer === 'front' ? 'front-fill' : layer === 'back' ? 'back-attract' : layer === 'middle' ? 'stack' : 'scatter'; }
function groupingFor(clump: number): PlantGrouping { return clump >= .82 ? 'large-drift' : clump >= .65 ? 'medium-drift' : clump >= .45 ? 'small-drift' : 'individual'; }
function controlsFor(recipe: AppRecipe, zone?: GardenZone): ControlState {
  return {
    seed: zone?.plantingSeed || Math.floor(Math.random() * 99999) + 1,
    density: zone?.density ?? recipe.defaultDensity,
    targetCount: null,
    layoutBehavior: recipe.layoutBehavior,
    allowedOverlap: 0,
    padding: 2,
    iterations: 1200,
    passes: 3,
    attractionStrength: recipe.attractionStrength,
    clumpStrength: recipe.clumpStrength,
    keepCentersInside: true,
    replaceExisting: true,
    dropOrder: 'random',
    physicsPercent: 100,
    spacingPad: 0,
    openSpaceFill: 'light',
    plants: recipe.plants.map(item => ({
      plantId: item.plantId,
      name: item.name,
      enabled: true,
      weight: item.weight,
      count: null,
      layer: item.layer,
      widthInches: item.widthInches,
      clump: item.clump,
      mode: defaultMode(item.layer),
      grouping: groupingFor(item.clump),
      spacing: 'natural',
    })),
  };
}
function catalogPlantName(plant: Plant) { return plant.greenAcresProductName || plant.commonName || plant.botanicalName || `Plant ${plant.id}`; }
function catalogPlantWidth(plant: Plant) { return Math.max(6, Math.round((plant.matureWidthFt || plant.minimumSpacingFt || 2) * 12)); }

const input = 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white';
const button = 'rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs font-bold hover:bg-slate-800';

function RecipePanel({ host }: { host: HTMLElement }) {
  const [selectedId, setSelectedId] = useState(recipeCatalog[0]?.id || '');
  const [message, setMessage] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [catalogPlants, setCatalogPlants] = useState<Plant[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [plantSearch, setPlantSearch] = useState('');
  const lastControls = useRef('');
  const selectedRecipe = useMemo(() => recipeCatalog.find(recipe => recipe.id === selectedId), [selectedId]);
  const currentZone = useMemo(() => {
    const plan = readPlan();
    const modal = host.closest('div.fixed') || host.parentElement?.parentElement;
    const name = modal?.querySelector('h3')?.textContent?.trim();
    return ((plan?.zones || []) as GardenZone[]).find(zone => zone.name === name);
  }, [host, selectedId]);
  const [controls, setControls] = useState<ControlState>(() => selectedRecipe ? controlsFor(selectedRecipe, currentZone) : controlsFor(recipeCatalog[0]));

  useEffect(() => {
    let cancelled = false;
    loadPlantsFromCSV().then(result => {
      if (cancelled) return;
      setCatalogPlants(result.plants);
      setCatalogError(result.error || '');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (selectedRecipe) {
      setControls(controlsFor(selectedRecipe, currentZone));
      setPlantSearch('');
      setMessage('');
    }
  }, [selectedRecipe, currentZone?.id]);

  useEffect(() => {
    if (!selectedRecipe) return;
    const signature = JSON.stringify({ recipeId: selectedRecipe.id, zoneId: currentZone?.id || null, controls });
    if (signature === lastControls.current) return;
    lastControls.current = signature;
    recordRecipeDebug(host, 'recipe.controls.changed', { recipeId: selectedRecipe.id, recipeName: selectedRecipe.name, zoneId: currentZone?.id || null, zoneName: currentZone?.name || null, controls });
  }, [controls, currentZone?.id, currentZone?.name, host, selectedRecipe]);

  const updatePlant = (plantId: number, updates: Partial<PlantControl>) => setControls(value => ({ ...value, plants: value.plants.map(item => item.plantId === plantId ? { ...item, ...updates } : item) }));
  const removePlant = (plantId: number) => setControls(value => ({ ...value, plants: value.plants.filter(item => item.plantId !== plantId) }));
  const addCatalogPlant = (plant: Plant) => {
    const existing = controls.plants.find(item => item.plantId === plant.id);
    if (existing) {
      updatePlant(plant.id, { enabled: true });
      setMessage(`${existing.name} is already in this recipe and has been enabled.`);
      setPlantSearch('');
      return;
    }
    const control: PlantControl = {
      plantId: plant.id,
      name: catalogPlantName(plant),
      enabled: true,
      weight: 10,
      count: null,
      layer: 'middle',
      widthInches: catalogPlantWidth(plant),
      clump: .5,
      mode: 'scatter',
      grouping: 'individual',
      spacing: 'natural',
    };
    setControls(value => ({ ...value, plants: [...value.plants, control] }));
    setMessage(`${control.name} added to this recipe generation.`);
    setPlantSearch('');
  };

  const searchResults = useMemo(() => {
    const query = plantSearch.trim().toLowerCase();
    if (query.length < 2) return [];
    return catalogPlants.filter(plant => {
      const text = `${plant.id} ${plant.commonName || ''} ${plant.botanicalName || ''} ${plant.greenAcresProductName || ''}`.toLowerCase();
      return text.includes(query);
    }).slice(0, 12);
  }, [catalogPlants, plantSearch]);

  const generate = (newSeed = false) => {
    if (!selectedRecipe) return;
    const plan = readPlan();
    if (!plan) { setMessage('No current plan was found.'); recordRecipeDebug(host, 'recipe.generation.failed', { recipeId: selectedRecipe.id, reason: 'current-plan-not-found' }); return; }
    const modal = host.closest('div.fixed') || host.parentElement?.parentElement;
    const zoneName = modal?.querySelector('h3')?.textContent?.trim();
    const zones = (plan.zones || []) as GardenZone[];
    const zone = zones.find(item => item.name === zoneName);
    if (!zone || zone.points.length < 3) { setMessage('The selected planting zone could not be found.'); recordRecipeDebug(host, 'recipe.generation.failed', { recipeId: selectedRecipe.id, zoneName, reason: 'zone-not-found-or-invalid' }); return; }
    if (!zone.edgeRoles?.front?.length || !zone.edgeRoles?.back?.length) { setMessage('Mark at least one front edge and one back edge first.'); recordRecipeDebug(host, 'recipe.generation.failed', { recipeId: selectedRecipe.id, zoneId: zone.id, reason: 'front-or-back-edge-missing', edgeRoles: zone.edgeRoles || { front: [], back: [] } }); return; }

    const runId = recipeRunId();
    const startedAt = performance.now();
    const seed = newSeed ? Math.floor(Math.random() * 99999) + 1 : controls.seed;
    const runControls = { ...controls, seed, allowedOverlap: 0 as const };
    if (newSeed) setControls(runControls);
    const usedFallbackScale = !plan.scalePixelsPerFoot;
    const pixelsPerFoot = plan.scalePixelsPerFoot || 20;
    const active = runControls.plants.filter(item => item.enabled);
    const existingZonePlants = ((plan.placedPlants || []) as PlacedPlant[]).filter(item => item.zone === zone.id && item.itemType !== 'rock');
    const physicsInput = {
      polygon: zone.points,
      seed,
      density: runControls.density / 100,
      targetCount: runControls.targetCount ?? undefined,
      frontEdges: zone.edgeRoles.front,
      backEdges: zone.edgeRoles.back,
      iterations: runControls.iterations,
      passes: runControls.passes,
      padding: runControls.padding,
      allowedOverlap: 0,
      attractionStrength: runControls.attractionStrength,
      clumpStrength: runControls.clumpStrength,
      layoutBehavior: runControls.layoutBehavior,
      keepCentersInside: true,
      dropOrder: runControls.dropOrder,
      physicsScale: runControls.physicsPercent / 100,
      spacingPad: runControls.spacingPad,
      openSpaceFill: runControls.openSpaceFill,
      plants: active.map(item => {
        const visibleRadius = Math.max(5, (item.widthInches / 12) * pixelsPerFoot / 2);
        return { key: `${selectedRecipe.id}:${item.plantId}`, plantId: item.plantId, layer: item.layer, weight: item.weight, count: item.count ?? undefined, enabled: item.enabled, radius: visibleRadius, clump: item.clump, mode: item.mode, grouping: item.grouping, spacing: item.spacing };
      }),
    };
    recordRecipeDebug(host, 'recipe.generation.started', { runId, trigger: newSeed ? 'new-seed-and-generate' : 'generate', recipe: { id: selectedRecipe.id, name: selectedRecipe.name, sourcePdf: selectedRecipe.sourcePdf || null, sourcePage: selectedRecipe.sourcePage || null, pattern: selectedRecipe.pattern, designIntent: selectedRecipe.designIntent }, zone: { id: zone.id, name: zone.name, polygon: zone.points, frontEdges: edgeDebug(zone, zone.edgeRoles.front), backEdges: edgeDebug(zone, zone.edgeRoles.back) }, scale: { pixelsPerFoot, source: usedFallbackScale ? 'fallback-20px-per-foot' : 'plan-scale' }, controls: runControls, activePlants: active, disabledPlants: runControls.plants.filter(item => !item.enabled), existingZonePlantCount: existingZonePlants.length, physicsInput });

    try {
      const physics = runRecipePhysics(physicsInput);
      const byId = new Map(active.map(item => [item.plantId, item]));
      const generated: PlacedPlant[] = physics.placements.map(item => {
        const control = byId.get(item.plantId);
        return { instanceId: `${runId}-${item.plantId}-${Math.random().toString(36).slice(2, 8)}`, plantId: item.plantId, x: item.x, y: item.y, zone: zone.id, notes: `Recipe: ${selectedRecipe.name}${item.driftId ? ` [drift:${item.driftId}]` : ''}`, displayMode: 'symbol', customColor: stablePlantColor(item.plantId), itemType: 'plant', rotationDeg: item.rotationDeg, displayWidthFt: (control?.widthInches || 24) / 12 };
      });
      const groupId = `recipe-${zone.id}`;
      const group: PlantingGroup = { id: groupId, name: `Recipe · ${selectedRecipe.name}`, notes: selectedRecipe.designIntent, plantIds: [...new Set(active.map(item => item.plantId))] };
      const plantingGroups = [...((plan.plantingGroups || []) as PlantingGroup[]).filter(item => item.id !== groupId && item.id !== zone.plantingGroupId), group];
      const nextZones = zones.map(item => item.id === zone.id ? { ...item, density: runControls.density, plantingGroupId: groupId, plantingGroupName: group.name, plantingRecipeId: selectedRecipe.id, plantingRecipeName: selectedRecipe.name, plantingSeed: seed, plantingType: 'flowerBed' as const, layoutMode: 'fill' as const, plantVariety: 'low' as const } : item);
      const existing = (plan.placedPlants || []) as PlacedPlant[];
      const placedPlants = runControls.replaceExisting ? [...existing.filter(item => item.zone !== zone.id || item.itemType === 'rock'), ...generated] : [...existing, ...generated];
      const nextPlan: GardenPlan = { id: plan.id || 'current-plan', name: plan.name || 'My Garden Plan', createdAt: plan.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), backgroundImage: plan.backgroundImage ?? null, backgroundOpacity: plan.backgroundOpacity ?? .5, backgroundLocked: plan.backgroundLocked ?? false, scalePixelsPerFoot: plan.scalePixelsPerFoot ?? null, placedPlants, zones: nextZones, plantingGroups, zoneShapesVisible: plan.zoneShapesVisible, notes: plan.notes || '', canvasWorldSize: plan.canvasWorldSize, plantCircleOpacity: plan.plantCircleOpacity, plantLabelMode: plan.plantLabelMode, plantClumpingEnabled: plan.plantClumpingEnabled, plantClumpStrength: plan.plantClumpStrength, zoom: plan.zoom, shrubScore: plan.shrubScore, restoreBackgroundOnLaunch: plan.restoreBackgroundOnLaunch };
      const countsByPlant = active.map(plant => ({ plantId: plant.plantId, name: plant.name, configuredWeight: plant.weight, configuredCount: plant.count, grouping: plant.grouping, spacing: plant.spacing, actual: generated.filter(item => item.plantId === plant.plantId).length }));
      const physicsPlacements = physics.placements.map(item => ({ ...item, plantName: byId.get(item.plantId)?.name || `Plant ${item.plantId}`, mode: byId.get(item.plantId)?.mode, configuredWidthInches: byId.get(item.plantId)?.widthInches, distanceToNearestFrontEdgePx: nearestRoleEdge(item, zone, zone.edgeRoles?.front || []), distanceToNearestBackEdgePx: nearestRoleEdge(item, zone, zone.edgeRoles?.back || []) }));
      const completion = { runId, durationMs: Math.round(performance.now() - startedAt), recipeId: selectedRecipe.id, recipeName: selectedRecipe.name, zoneId: zone.id, zoneName: zone.name, seed, userRequestedTotal: runControls.targetCount, requestedTotal: physics.diagnostics.requested, placedTotal: generated.length, rejectedTotal: physics.diagnostics.rejected, totalShortfall: Math.max(0, (runControls.targetCount ?? physics.diagnostics.requested) - generated.length), countsByPlant, diagnostics: physics.diagnostics, controls: runControls, physicsInput, physicsPlacements, generatedPlanPlants: generated, frontEdges: edgeDebug(zone, zone.edgeRoles.front), backEdges: edgeDebug(zone, zone.edgeRoles.back), replaceExisting: runControls.replaceExisting, previousZonePlantCount: existingZonePlants.length, finalZonePlantCount: generated.length, scale: { pixelsPerFoot, source: usedFallbackScale ? 'fallback-20px-per-foot' : 'plan-scale' } };
      if (!applyPlan(host, nextPlan)) { recordRecipeDebug(host, 'recipe.generation.failed', { ...completion, reason: 'running-app-could-not-accept-plan' }); setMessage('The running app could not accept the recipe.'); return; }
      recordRecipeDebug(host, 'recipe.generation.completed', completion, recipeSnapshot(runId, selectedRecipe, zone, generated, completion));
      const shortfall = Math.max(0, physics.diagnostics.requested - generated.length);
      setMessage(`${selectedRecipe.name}: ${generated.length} plants placed${shortfall ? ` · ${shortfall} could not fit without overlap` : ''} · seed ${seed}.`);
    } catch (error) {
      const failure = { runId, recipeId: selectedRecipe.id, recipeName: selectedRecipe.name, zoneId: zone.id, zoneName: zone.name, seed, durationMs: Math.round(performance.now() - startedAt), controls: runControls, physicsInput, reason: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack || null : null };
      recordRecipeDebug(host, 'recipe.generation.failed', failure);
      setMessage(`Recipe generation failed: ${failure.reason}`);
    }
  };

  if (!selectedRecipe) return null;
  const originalIds = new Set(selectedRecipe.plants.map(item => item.plantId));

  return createPortal(
    <section className="rounded-2xl border border-violet-500/50 bg-violet-950/25 p-3 text-slate-100">
      <div className="text-[10px] font-extrabold uppercase tracking-[.17em] text-violet-300">Plant recipe engine</div>
      <div className="mt-1 text-sm font-bold">Recipe controls</div>

      <label className="mt-3 block text-xs">Recipe
        <select value={selectedId} onChange={event => setSelectedId(event.target.value)} className={input}>
          {recipeCatalog.map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
        </select>
      </label>
      <div className="mt-2 rounded-lg border border-violet-500/20 bg-slate-950/40 p-2 text-[11px] text-slate-300">{selectedRecipe.designIntent}</div>

      <div className="relative mt-3 rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-3">
        <div className="text-xs font-bold text-emerald-200">Add any plant to this recipe</div>
        <input value={plantSearch} onChange={event => setPlantSearch(event.target.value)} placeholder="Search the plant catalog…" className={input} />
        {catalogError && <div className="mt-1 text-[10px] text-rose-300">{catalogError}</div>}
        {plantSearch.trim().length >= 2 && (
          <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-1">
            {searchResults.length === 0 ? <div className="p-2 text-[11px] text-slate-400">No catalog plants found.</div> : searchResults.map(plant => (
              <button key={plant.id} type="button" onClick={() => addCatalogPlant(plant)} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-[11px] hover:bg-slate-800">
                <span><strong>{catalogPlantName(plant)}</strong>{plant.botanicalName ? <span className="ml-1 text-slate-400">{plant.botanicalName}</span> : null}</span>
                <span className="shrink-0 rounded bg-emerald-700 px-2 py-1 font-bold">Add</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs">Plant fullness
          <input type="number" min="5" max="100" value={controls.density} onChange={event => setControls(value => ({ ...value, density: Math.max(5, Math.min(100, Number(event.target.value) || 5)) }))} className={input} />
        </label>
        <label className="text-xs">Seed
          <input type="number" value={controls.seed} onChange={event => setControls(value => ({ ...value, seed: Number(event.target.value) || 1 }))} className={input} />
        </label>
        <label className="text-xs">Target plant count
          <input type="number" min="1" placeholder="Automatic" value={controls.targetCount ?? ''} onChange={event => setControls(value => ({ ...value, targetCount: event.target.value === '' ? null : Math.max(1, Number(event.target.value) || 1) }))} className={input} />
        </label>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2 text-[11px] text-emerald-200">
          <strong>Plant overlap: 0%</strong><br />100% fullness means “fit as many as possible,” never stack plants.
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {controls.plants.map(item => (
          <div key={item.plantId} className="rounded-xl border border-slate-700 bg-slate-950/55 p-3">
            <div className="flex items-start justify-between gap-2">
              <label className="flex min-w-0 items-center gap-2 text-xs font-bold">
                <input type="checkbox" checked={item.enabled} onChange={event => updatePlant(item.plantId, { enabled: event.target.checked })} />
                <span className="truncate">{item.name}</span>
              </label>
              {!originalIds.has(item.plantId) && <button type="button" onClick={() => removePlant(item.plantId)} className="text-[10px] font-bold text-rose-300 hover:text-rose-200">Remove</button>}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-[10px]">Weight
                <input type="number" min="0" value={item.weight} onChange={event => updatePlant(item.plantId, { weight: Math.max(0, Number(event.target.value) || 0) })} className={input} />
              </label>
              <label className="text-[10px]">Exact count
                <input type="number" min="0" placeholder="Auto" value={item.count ?? ''} onChange={event => updatePlant(item.plantId, { count: event.target.value === '' ? null : Math.max(0, Number(event.target.value) || 0) })} className={input} />
              </label>
              <label className="text-[10px]">Width in
                <input type="number" min="6" max="240" value={item.widthInches} onChange={event => updatePlant(item.plantId, { widthInches: Math.max(6, Number(event.target.value) || 6) })} className={input} />
              </label>
              <label className="text-[10px]">Layer
                <select value={item.layer} onChange={event => updatePlant(item.plantId, { layer: event.target.value as RecipePhysicsLayer })} className={input}>
                  <option value="front">Front</option><option value="middle">Middle</option><option value="back">Back</option><option value="accent">Accent</option>
                </select>
              </label>
              <label className="text-[10px]">Placement
                <select value={item.mode} onChange={event => updatePlant(item.plantId, { mode: event.target.value as RecipePlacementMode })} className={input}>
                  <option value="scatter">Scatter</option><option value="stack">Matrix / stack pattern</option><option value="front-fill">Front fill</option><option value="back-attract">Back edge / hedge</option>
                </select>
              </label>
              <label className="text-[10px]">Grouping
                <select value={item.grouping} onChange={event => updatePlant(item.plantId, { grouping: event.target.value as PlantGrouping })} className={input}>
                  <option value="individual">Individual</option><option value="small-drift">Small drift</option><option value="medium-drift">Medium drift</option><option value="large-drift">Large drift</option><option value="continuous-mass">Continuous mass</option>
                </select>
              </label>
              <label className="text-[10px]">Spacing
                <select value={item.spacing} onChange={event => updatePlant(item.plantId, { spacing: event.target.value as PlantSpacing })} className={input}>
                  <option value="tight">Tight, touching only</option><option value="natural">Natural</option><option value="loose">Loose</option>
                </select>
              </label>
              <label className="text-[10px]">Clump strength
                <input type="number" min="0" max="1" step="0.05" value={item.clump} onChange={event => updatePlant(item.plantId, { clump: Math.max(0, Math.min(1, Number(event.target.value) || 0)) })} className={input} />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={() => setAdvanced(value => !value)} className={`mt-3 w-full ${button}`}>{advanced ? 'Hide advanced controls' : 'Show advanced controls'}</button>
      {advanced && (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-slate-700 bg-slate-950/40 p-3">
          <label className="text-[10px]">Iterations<input type="number" min="220" max="3000" value={controls.iterations} onChange={event => setControls(value => ({ ...value, iterations: Number(event.target.value) || 220 }))} className={input} /></label>
          <label className="text-[10px]">Passes<input type="number" min="1" max="8" value={controls.passes} onChange={event => setControls(value => ({ ...value, passes: Math.max(1, Math.min(8, Number(event.target.value) || 1)) }))} className={input} /></label>
          <label className="text-[10px]">Spacing pad px<input type="number" min="0" max="100" value={controls.spacingPad} onChange={event => setControls(value => ({ ...value, spacingPad: Math.max(0, Number(event.target.value) || 0) }))} className={input} /></label>
          <label className="text-[10px]">Attraction<input type="number" min="0.1" max="5" step="0.1" value={controls.attractionStrength} onChange={event => setControls(value => ({ ...value, attractionStrength: Number(event.target.value) || .1 }))} className={input} /></label>
          <label className="text-[10px]">Drop order<select value={controls.dropOrder} onChange={event => setControls(value => ({ ...value, dropOrder: event.target.value as RecipeDropOrder }))} className={input}><option value="random">Random</option><option value="grouped">Grouped</option></select></label>
          <label className="text-[10px]">Open-space fill<select value={controls.openSpaceFill} onChange={event => setControls(value => ({ ...value, openSpaceFill: event.target.value as OpenSpaceFill }))} className={input}><option value="off">Off</option><option value="light">Light</option><option value="medium">Medium</option><option value="strong">Strong</option></select></label>
          <label className="col-span-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={controls.replaceExisting} onChange={event => setControls(value => ({ ...value, replaceExisting: event.target.checked }))} />Replace existing plants in this zone</label>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => generate(false)} className="rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-black hover:bg-violet-500">Generate</button>
        <button type="button" onClick={() => generate(true)} className="rounded-xl border border-violet-400/50 bg-violet-950 px-3 py-2.5 text-xs font-black hover:bg-violet-900">New seed + generate</button>
      </div>
      {message && <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/60 p-2 text-[11px] text-slate-300">{message}</div>}
    </section>,
    host,
  );
}

export default function RecipeAppIntegration() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let frame = 0;
    const find = () => {
      const label = [...document.querySelectorAll('label')].find(item => item.textContent?.trim() === 'Planting type');
      const card = label?.closest('div.rounded-2xl');
      const parent = card?.parentElement;
      if (!card || !parent) { setHost(null); return; }
      let recipeHost = parent.querySelector<HTMLElement>('[data-recipe-react-host]');
      if (!recipeHost) {
        recipeHost = document.createElement('div');
        recipeHost.dataset.recipeReactHost = 'true';
        parent.insertBefore(recipeHost, card);
      }
      setHost(recipeHost);
    };
    const observer = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(find); });
    observer.observe(document.body, { childList: true, subtree: true });
    find();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return <><App />{host && <RecipePanel host={host} />}</>;
}
