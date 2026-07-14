import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import App from './App';
import { recipeCatalog } from './data/recipeCatalog';
import { runRecipePhysics } from './engine/recipePhysicsEngine';
import type { GardenPlan, GardenZone, PlacedPlant, PlantingGroup } from './types/plant';

const CURRENT_PLAN_KEY = 'garden-planner-current';

type FiberNode = {
  child?: FiberNode | null;
  sibling?: FiberNode | null;
  return?: FiberNode | null;
  memoizedProps?: Record<string, unknown> | null;
  pendingProps?: Record<string, unknown> | null;
};

function findReactFiber(element: Element | null): FiberNode | null {
  let current: Element | null = element;
  while (current) {
    const key = Object.keys(current).find(name => name.startsWith('__reactFiber$'));
    if (key) return (current as unknown as Record<string, FiberNode>)[key] || null;
    current = current.parentElement;
  }

  const root = document.querySelector('#root');
  if (!root) return null;
  const rootKey = Object.keys(root).find(name => name.startsWith('__reactContainer$') || name.startsWith('__reactFiber$'));
  return rootKey ? (root as unknown as Record<string, FiberNode>)[rootKey] || null : null;
}

function findCallbackInFiber(
  start: FiberNode | null,
  callbackName: string,
): ((plan: GardenPlan) => void) | null {
  if (!start) return null;

  let root = start;
  while (root.return) root = root.return;

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
  const fiber = findReactFiber(host);
  const apply = findCallbackInFiber(fiber, 'onImportPlan') || findCallbackInFiber(fiber, 'onLoadPlan');
  if (!apply) return false;
  apply(plan);
  return true;
}

function RecipePanel({ host }: { host: HTMLElement }) {
  const [selectedId, setSelectedId] = useState(recipeCatalog[0]?.id || '');
  const [message, setMessage] = useState('');
  const selectedRecipe = useMemo(() => recipeCatalog.find(recipe => recipe.id === selectedId), [selectedId]);

  const generate = () => {
    setMessage('');
    const raw = localStorage.getItem(CURRENT_PLAN_KEY);
    if (!raw || !selectedRecipe) {
      setMessage('No current plan was found. Make one change to the plan and try again.');
      return;
    }

    let plan: Partial<GardenPlan>;
    try {
      plan = JSON.parse(raw) as Partial<GardenPlan>;
    } catch {
      setMessage('The current plan could not be read.');
      return;
    }

    const modal = host.closest('div.fixed') || host.parentElement?.parentElement;
    const zoneName = modal?.querySelector('h3')?.textContent?.trim();
    const zones = (plan.zones || []) as GardenZone[];
    const zone = zones.find(item => item.name === zoneName);
    if (!zone || zone.points.length < 3) {
      setMessage('The selected planting zone could not be found.');
      return;
    }

    const pixelsPerFoot = plan.scalePixelsPerFoot || 20;
    const physics = runRecipePhysics({
      polygon: zone.points,
      seed: zone.plantingSeed || Math.floor(Math.random() * 99999),
      density: Math.max(0.05, Math.min(1, (zone.density ?? 50) / 100)),
      frontEdges: zone.edgeRoles?.front,
      backEdges: zone.edgeRoles?.back,
      iterations: 260,
      padding: 2,
      plants: selectedRecipe.plants.map(item => ({
        key: `${selectedRecipe.id}:${item.plantId}`,
        plantId: item.plantId,
        layer: item.layer,
        weight: item.weight,
        radius: Math.max(5, (item.widthInches / 12) * pixelsPerFoot / 2),
        clump: item.clump,
      })),
    });

    const generated: PlacedPlant[] = physics.placements.map(item => ({
      instanceId: `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`,
      plantId: item.plantId,
      x: item.x,
      y: item.y,
      zone: zone.id,
      notes: `Recipe: ${selectedRecipe.name}`,
      displayMode: 'symbol',
      customColor: null,
      itemType: 'plant',
      rotationDeg: item.rotationDeg,
    }));

    const groupId = `recipe-${selectedRecipe.id}`;
    const group: PlantingGroup = {
      id: groupId,
      name: `Recipe · ${selectedRecipe.name}`,
      notes: 'Generated with the shared Matter.js recipe physics engine.',
      plantIds: [...new Set(selectedRecipe.plants.map(item => item.plantId))],
    };

    const plantingGroups = [
      ...((plan.plantingGroups || []) as PlantingGroup[]).filter(item => item.id !== groupId),
      group,
    ];

    const nextZones = zones.map(item => item.id === zone.id ? {
      ...item,
      plantingGroupId: groupId,
      plantingGroupName: group.name,
      plantingRecipeId: selectedRecipe.id,
      plantingRecipeName: selectedRecipe.name,
      plantingSeed: zone.plantingSeed || physics.diagnostics.seed,
      plantingType: 'flowerBed' as const,
      layoutMode: 'fill' as const,
      plantVariety: 'low' as const,
    } : item);

    const placedPlants = [
      ...((plan.placedPlants || []) as PlacedPlant[]).filter(item => item.zone !== zone.id || item.itemType === 'rock'),
      ...generated,
    ];

    const nextPlan: GardenPlan = {
      id: plan.id || 'current-plan',
      name: plan.name || 'My Garden Plan',
      createdAt: plan.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      backgroundImage: plan.backgroundImage ?? null,
      backgroundOpacity: plan.backgroundOpacity ?? 0.5,
      backgroundLocked: plan.backgroundLocked ?? false,
      scalePixelsPerFoot: plan.scalePixelsPerFoot ?? null,
      placedPlants,
      zones: nextZones,
      plantingGroups,
      zoneShapesVisible: plan.zoneShapesVisible,
      notes: plan.notes || '',
      canvasWorldSize: plan.canvasWorldSize,
      plantCircleOpacity: plan.plantCircleOpacity,
      plantLabelMode: plan.plantLabelMode,
      plantClumpingEnabled: plan.plantClumpingEnabled,
      plantClumpStrength: plan.plantClumpStrength,
      zoom: plan.zoom,
      shrubScore: plan.shrubScore,
      restoreBackgroundOnLaunch: plan.restoreBackgroundOnLaunch,
    };

    if (!applyPlanToRunningApp(host, nextPlan)) {
      setMessage('The running app could not accept the recipe. Nothing was changed.');
      return;
    }

    setMessage(`${selectedRecipe.name}: ${generated.length} plants placed. ${physics.diagnostics.unresolvedOverlaps} unresolved overlap${physics.diagnostics.unresolvedOverlaps === 1 ? '' : 's'}.`);
  };

  return createPortal(
    <section className="rounded-2xl border border-violet-500/50 bg-violet-950/25 p-3 text-slate-100">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-violet-300">Plant recipe</div>
      <div className="mt-1 text-sm font-bold">Physics-generated recipe</div>
      <label className="mt-3 block text-xs text-slate-300">
        Recipe
        <select
          value={selectedId}
          onChange={event => setSelectedId(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          {recipeCatalog.map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
        </select>
      </label>
      {selectedRecipe && (
        <div className="mt-2 text-xs leading-5 text-slate-300">
          {selectedRecipe.plants.map(item => `${item.name} ${item.weight}%`).join(' · ')}
        </div>
      )}
      <button
        type="button"
        onClick={generate}
        className="mt-3 w-full rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-violet-500"
      >
        Generate recipe with physics
      </button>
      <div className="mt-2 text-[11px] text-violet-200/80">
        Uses mature plant sizes, recipe percentages, the zone seed, marked front/back edges, clumping, collision handling, and normal editable plant icons.
      </div>
      {message && <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200">{message}</div>}
    </section>,
    host,
  );
}

export default function RecipeAppIntegration() {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const findHost = () => {
      const labels = [...document.querySelectorAll('label')];
      const plantingLabel = labels.find(label => label.textContent?.trim() === 'Planting type');
      const plantingCard = plantingLabel?.closest('div.rounded-2xl');
      const parent = plantingCard?.parentElement;
      if (!plantingCard || !parent) {
        setHost(null);
        return;
      }

      let recipeHost = parent.querySelector<HTMLElement>('[data-recipe-react-host]');
      if (!recipeHost) {
        recipeHost = document.createElement('div');
        recipeHost.dataset.recipeReactHost = 'true';
        parent.insertBefore(recipeHost, plantingCard);
      }
      setHost(recipeHost);
    };

    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(findHost);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    findHost();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <App />
      {host && <RecipePanel host={host} />}
    </>
  );
}
