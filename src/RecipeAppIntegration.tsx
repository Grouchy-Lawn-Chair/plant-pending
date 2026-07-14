import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import App from './App';
import { recipeCatalog } from './data/recipeCatalog';
import { runRecipePhysics } from './engine/recipePhysicsEngine';
import type { GardenPlan, GardenZone, PlacedPlant, PlantingGroup, TestSnapshot } from './types/plant';

const CURRENT_PLAN_KEY = 'garden-planner-current';
const RECIPE_DEBUG_HISTORY_KEY = 'plant-pending-recipe-generation-history';

type HookNode = { memoizedState?: unknown; queue?: { dispatch?: (value: unknown) => void } | null; next?: HookNode | null };
type FiberNode = { child?: FiberNode | null; sibling?: FiberNode | null; return?: FiberNode | null; memoizedProps?: Record<string, unknown> | null; pendingProps?: Record<string, unknown> | null; memoizedState?: HookNode | null };

function findReactFiber(element: Element | null): FiberNode | null {
  let current: Element | null = element;
  while (current) {
    const key = Object.keys(current).find(name => name.startsWith('__reactFiber$'));
    if (key) return (current as unknown as Record<string, FiberNode>)[key] || null;
    current = current.parentElement;
  }
  return null;
}

function fiberRoot(start: FiberNode | null): FiberNode | null {
  if (!start) return null;
  let root = start;
  while (root.return) root = root.return;
  return root;
}

function findCallbackInFiber(start: FiberNode | null, callbackName: string): ((plan: GardenPlan) => void) | null {
  const root = fiberRoot(start);
  if (!root) return null;
  const stack: FiberNode[] = [root];
  const visited = new Set<FiberNode>();
  while (stack.length) {
    const fiber = stack.pop()!;
    if (visited.has(fiber)) continue;
    visited.add(fiber);
    const memoized = fiber.memoizedProps?.[callbackName];
    if (typeof memoized === 'function') return memoized as (plan: GardenPlan) => void;
    const pending = fiber.pendingProps?.[callbackName];
    if (typeof pending === 'function') return pending as (plan: GardenPlan) => void;
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
  return null;
}

function applyPlanToRunningApp(host: HTMLElement, plan: GardenPlan): boolean {
  const apply = findCallbackInFiber(findReactFiber(host), 'onImportPlan') || findCallbackInFiber(findReactFiber(host), 'onLoadPlan');
  if (!apply) return false;
  apply(plan);
  return true;
}

function appendDebugSnapshotToRunningApp(host: HTMLElement, snapshot: TestSnapshot): boolean {
  const root = fiberRoot(findReactFiber(host));
  if (!root) return false;
  const stack: FiberNode[] = [root];
  const visited = new Set<FiberNode>();
  while (stack.length) {
    const fiber = stack.pop()!;
    if (visited.has(fiber)) continue;
    visited.add(fiber);
    const snapshotsProp = fiber.memoizedProps?.debugSnapshots;
    if (Array.isArray(snapshotsProp)) {
      let owner: FiberNode | null | undefined = fiber;
      while (owner) {
        let hook = owner.memoizedState;
        while (hook) {
          if (hook.memoizedState === snapshotsProp && typeof hook.queue?.dispatch === 'function') {
            hook.queue.dispatch([...(snapshotsProp as TestSnapshot[]).slice(-99), snapshot]);
            return true;
          }
          hook = hook.next;
        }
        owner = owner.return;
      }
    }
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
  return false;
}

function persistRecipeDebugSnapshot(snapshot: TestSnapshot): void {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECIPE_DEBUG_HISTORY_KEY) || '[]');
    const history = Array.isArray(parsed) ? parsed : [];
    localStorage.setItem(RECIPE_DEBUG_HISTORY_KEY, JSON.stringify([...history.slice(-99), snapshot]));
  } catch { /* Debug persistence must never block generation. */ }
}

function createRecipeDebugImage(zone: GardenZone, placements: ReturnType<typeof runRecipePhysics>['placements']) {
  const bounds = { minX: Math.min(...zone.points.map(p => p.x)), minY: Math.min(...zone.points.map(p => p.y)), maxX: Math.max(...zone.points.map(p => p.x)), maxY: Math.max(...zone.points.map(p => p.y)) };
  const padding = 30;
  const sourceWidth = Math.max(160, bounds.maxX - bounds.minX + padding * 2);
  const sourceHeight = Math.max(120, bounds.maxY - bounds.minY + padding * 2);
  const scale = Math.min(1, 720 / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(220, Math.round(sourceWidth * scale));
  canvas.height = Math.max(180, Math.round(sourceHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) return { imageDataUrl: '', width: 0, height: 0 };
  const x = (value: number) => (value - bounds.minX + padding) * scale;
  const y = (value: number) => (value - bounds.minY + padding) * scale;
  context.fillStyle = '#f3f4f6'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.beginPath(); zone.points.forEach((p, i) => i ? context.lineTo(x(p.x), y(p.y)) : context.moveTo(x(p.x), y(p.y))); context.closePath();
  context.fillStyle = 'rgba(34,197,94,.14)'; context.strokeStyle = '#15803d'; context.lineWidth = 2; context.fill(); context.stroke();
  const colors: Record<string, string> = { front: '#14b8a6', middle: '#60a5fa', back: '#15803d', accent: '#db2777' };
  placements.forEach(p => { context.beginPath(); context.arc(x(p.x), y(p.y), Math.max(3, p.radius * scale), 0, Math.PI * 2); context.fillStyle = colors[p.layer] || '#64748b'; context.globalAlpha = .62; context.fill(); context.globalAlpha = 1; context.strokeStyle = '#0f172a'; context.lineWidth = 1; context.stroke(); });
  return { imageDataUrl: canvas.toDataURL('image/jpeg', .62), width: canvas.width, height: canvas.height };
}

function buildOverlapWarnings(placements: PlacedPlant[], recipe: (typeof recipeCatalog)[number], pixelsPerFoot: number) {
  const byId = new Map(recipe.plants.map(item => [item.plantId, item]));
  const warnings: Array<Record<string, unknown>> = [];
  for (let i = 0; i < placements.length; i += 1) {
    const a = placements[i]; const ar = byId.get(a.plantId); if (!ar) continue;
    const aRadius = Math.max(5, (ar.widthInches / 12) * pixelsPerFoot / 2);
    for (let j = i + 1; j < placements.length; j += 1) {
      const b = placements[j]; const br = byId.get(b.plantId); if (!br) continue;
      const bRadius = Math.max(5, (br.widthInches / 12) * pixelsPerFoot / 2);
      const distance = Math.hypot(a.x - b.x, a.y - b.y); const threshold = aRadius + bRadius;
      if (distance >= threshold) continue;
      warnings.push({
        id: `recipe-overlap-${a.instanceId}-${b.instanceId}`, type: 'overlap', severity: 'warning',
        message: `${ar.name} overlaps with ${br.name}`, plantIds: [a.plantId, b.plantId], instanceIds: [a.instanceId, b.instanceId], plantNames: [ar.name, br.name],
        distancePx: distance, overlapThresholdPx: threshold, overlapPx: threshold - distance,
        overlapPercent: Math.round(((threshold - distance) / threshold) * 1000) / 10,
        positions: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }], displayWidthsFt: [ar.widthInches / 12, br.widthInches / 12],
      });
    }
  }
  return warnings;
}

function RecipePanel({ host }: { host: HTMLElement }) {
  const [selectedId, setSelectedId] = useState(recipeCatalog[0]?.id || '');
  const [message, setMessage] = useState('');
  const selectedRecipe = useMemo(() => recipeCatalog.find(recipe => recipe.id === selectedId), [selectedId]);

  const generate = () => {
    setMessage(''); if (!selectedRecipe) return;
    const raw = localStorage.getItem(CURRENT_PLAN_KEY);
    if (!raw) { setMessage('No current plan was found. Make one change to the plan and try again.'); return; }
    let plan: Partial<GardenPlan>;
    try { plan = JSON.parse(raw) as Partial<GardenPlan>; } catch { setMessage('The current plan could not be read.'); return; }
    const modal = host.closest('div.fixed') || host.parentElement?.parentElement;
    const zoneName = modal?.querySelector('h3')?.textContent?.trim();
    const zones = (plan.zones || []) as GardenZone[];
    const zone = zones.find(item => item.name === zoneName);
    if (!zone || zone.points.length < 3) { setMessage('The selected planting zone could not be found.'); return; }

    const previousZonePlants = ((plan.placedPlants || []) as PlacedPlant[]).filter(item => item.zone === zone.id);
    const pixelsPerFoot = plan.scalePixelsPerFoot || 20;
    const density = Math.max(.05, Math.min(1, (zone.density ?? 50) / 100));
    const physicsInputs = selectedRecipe.plants.map(item => ({ key: `${selectedRecipe.id}:${item.plantId}`, plantId: item.plantId, layer: item.layer, weight: item.weight, radius: Math.max(5, (item.widthInches / 12) * pixelsPerFoot / 2), clump: item.clump }));
    const physics = runRecipePhysics({ polygon: zone.points, seed: zone.plantingSeed || Math.floor(Math.random() * 99999), density, frontEdges: zone.edgeRoles?.front, backEdges: zone.edgeRoles?.back, iterations: 520, padding: 5, plants: physicsInputs });
    const recipeById = new Map(selectedRecipe.plants.map(item => [item.plantId, item]));
    const generated: PlacedPlant[] = physics.placements.map(item => ({ instanceId: `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`, plantId: item.plantId, x: item.x, y: item.y, zone: zone.id, notes: `Recipe: ${selectedRecipe.name}`, displayMode: 'symbol', customColor: null, itemType: 'plant', rotationDeg: item.rotationDeg, displayWidthFt: (recipeById.get(item.plantId)?.widthInches || 24) / 12 }));
    const overlapWarnings = buildOverlapWarnings(generated, selectedRecipe, pixelsPerFoot);

    const groupId = `recipe-${selectedRecipe.id}`;
    const group: PlantingGroup = { id: groupId, name: `Recipe · ${selectedRecipe.name}`, notes: 'Generated from normalized Green Acres recipe IDs with the shared Matter.js recipe physics engine.', plantIds: [...new Set(selectedRecipe.plants.map(item => item.plantId))] };
    const plantingGroups = [...((plan.plantingGroups || []) as PlantingGroup[]).filter(item => item.id !== groupId), group];
    const nextZones = zones.map(item => item.id === zone.id ? { ...item, plantingGroupId: groupId, plantingGroupName: group.name, plantingRecipeId: selectedRecipe.id, plantingRecipeName: selectedRecipe.name, plantingSeed: zone.plantingSeed || physics.diagnostics.seed, plantingType: 'flowerBed' as const, layoutMode: 'fill' as const, plantVariety: 'low' as const } : item);
    const placedPlants = [...((plan.placedPlants || []) as PlacedPlant[]).filter(item => item.zone !== zone.id || item.itemType === 'rock'), ...generated];
    const nextPlan: GardenPlan = { id: plan.id || 'current-plan', name: plan.name || 'My Garden Plan', createdAt: plan.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), backgroundImage: plan.backgroundImage ?? null, backgroundOpacity: plan.backgroundOpacity ?? .5, backgroundLocked: plan.backgroundLocked ?? false, scalePixelsPerFoot: plan.scalePixelsPerFoot ?? null, placedPlants, zones: nextZones, plantingGroups, zoneShapesVisible: plan.zoneShapesVisible, notes: plan.notes || '', canvasWorldSize: plan.canvasWorldSize, plantCircleOpacity: plan.plantCircleOpacity, plantLabelMode: plan.plantLabelMode, plantClumpingEnabled: plan.plantClumpingEnabled, plantClumpStrength: plan.plantClumpStrength, zoom: plan.zoom, shrubScore: plan.shrubScore, restoreBackgroundOnLaunch: plan.restoreBackgroundOnLaunch };
    if (!applyPlanToRunningApp(host, nextPlan)) { setMessage('The running app could not accept the recipe. Nothing was changed.'); return; }

    const image = createRecipeDebugImage(zone, physics.placements);
    const snapshot: TestSnapshot = { id: `recipe-${selectedRecipe.id}-${Date.now().toString(36)}`, timestamp: new Date().toISOString(), reason: 'recipe.physics.completed', imageDataUrl: image.imageDataUrl, width: image.width, height: image.height, details: { recipeId: selectedRecipe.id, recipeName: selectedRecipe.name, recipePlants: selectedRecipe.plants, zone: { id: zone.id, name: zone.name, points: zone.points, density: zone.density ?? 50, seed: physics.diagnostics.seed, frontEdges: zone.edgeRoles?.front || [], backEdges: zone.edgeRoles?.back || [] }, physicsInputs, physicsDiagnostics: physics.diagnostics, placements: physics.placements, generatedPlacedPlants: generated, overlapWarnings, warningSummary: { total: overlapWarnings.length, physicsUnresolvedOverlaps: physics.diagnostics.unresolvedOverlaps }, replacedZonePlants: previousZonePlants, planCountsAfterGeneration: { placedPlants: placedPlants.length, zones: nextZones.length, plantingGroups: plantingGroups.length } } };
    persistRecipeDebugSnapshot(snapshot);
    const captured = appendDebugSnapshotToRunningApp(host, snapshot);
    setMessage(`${selectedRecipe.name}: ${generated.length} plants placed · ${overlapWarnings.length} overlap warnings. Debug ${captured ? 'captured' : 'saved to backup history'}.`);
  };

  return createPortal(<section className="rounded-2xl border border-violet-500/50 bg-violet-950/25 p-3 text-slate-100"><div className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-violet-300">Plant recipe</div><div className="mt-1 text-sm font-bold">Physics-generated recipe</div><label className="mt-3 block text-xs text-slate-300">Recipe<select value={selectedId} onChange={event => setSelectedId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">{recipeCatalog.map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select></label>{selectedRecipe && <div className="mt-2 text-xs leading-5 text-slate-300">{selectedRecipe.plants.map(item => `${item.name} ${item.weight}%`).join(' · ')}</div>}<button type="button" onClick={generate} className="mt-3 w-full rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-violet-500">Generate recipe with physics</button><div className="mt-2 text-[11px] text-violet-200/80">Every generation retains its full overlap warning list, exact placements, normalized widths, zone, seed, physics diagnostics, replaced layout, and preview image.</div>{message && <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200">{message}</div>}</section>, host);
}

export default function RecipeAppIntegration() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let frame = 0;
    const findHost = () => {
      const plantingLabel = [...document.querySelectorAll('label')].find(label => label.textContent?.trim() === 'Planting type');
      const plantingCard = plantingLabel?.closest('div.rounded-2xl');
      const parent = plantingCard?.parentElement;
      if (!plantingCard || !parent) { setHost(null); return; }
      let recipeHost = parent.querySelector<HTMLElement>('[data-recipe-react-host]');
      if (!recipeHost) { recipeHost = document.createElement('div'); recipeHost.dataset.recipeReactHost = 'true'; parent.insertBefore(recipeHost, plantingCard); }
      setHost(recipeHost);
    };
    const observer = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(findHost); });
    observer.observe(document.body, { childList: true, subtree: true }); findHost();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return <><App />{host && <RecipePanel host={host} />}</>;
}
