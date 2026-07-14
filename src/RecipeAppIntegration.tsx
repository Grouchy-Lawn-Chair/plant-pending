import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import App from './App';
import { recipeCatalog, type AppRecipePlant } from './data/recipeCatalog';
import { runRecipePhysics } from './engine/recipePhysicsEngine';
import type { GardenPlan, GardenZone, PlacedPlant, PlantingGroup } from './types/plant';

const CURRENT_PLAN_KEY = 'garden-planner-current';

type CatalogPlant = {
  id: number;
  commonName?: string;
  botanicalName?: string;
  greenAcresProductName?: string;
  matureWidthFt?: number;
  minimumSpacingFt?: number;
};

type ResolvedRecipePlant = AppRecipePlant & {
  resolvedId: number;
  resolvedName: string;
  resolvedWidthFt: number;
};

type FiberNode = {
  child?: FiberNode | null;
  sibling?: FiberNode | null;
  return?: FiberNode | null;
  memoizedProps?: Record<string, unknown> | null;
  pendingProps?: Record<string, unknown> | null;
};

function normalizeName(value: string | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function catalogNames(plant: CatalogPlant): string[] {
  return [plant.commonName, plant.botanicalName, plant.greenAcresProductName]
    .map(normalizeName)
    .filter(Boolean);
}

function resolveRecipePlant(item: AppRecipePlant, catalog: CatalogPlant[]): ResolvedRecipePlant | null {
  const target = normalizeName(item.name);
  const exact = catalog.find(plant => catalogNames(plant).includes(target));
  const close = exact || catalog.find(plant => catalogNames(plant).some(name => name.includes(target) || target.includes(name)));
  if (!close) return null;

  const resolvedName = close.greenAcresProductName || close.commonName || close.botanicalName || item.name;
  const resolvedWidthFt = close.matureWidthFt || close.minimumSpacingFt || item.widthInches / 12;
  return {
    ...item,
    resolvedId: close.id,
    resolvedName,
    resolvedWidthFt,
  };
}

function findReactFiber(element: Element | null): FiberNode | null {
  let current: Element | null = element;
  while (current) {
    const key = Object.keys(current).find(name => name.startsWith('__reactFiber$'));
    if (key) return (current as unknown as Record<string, FiberNode>)[key] || null;
    current = current.parentElement;
  }
  return null;
}

function findCallbackInFiber(start: FiberNode | null, callbackName: string): ((plan: GardenPlan) => void) | null {
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
  const [catalog, setCatalog] = useState<CatalogPlant[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const selectedRecipe = useMemo(() => recipeCatalog.find(recipe => recipe.id === selectedId), [selectedId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}green_acres_normalized.json`)
      .then(response => {
        if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
        return response.json();
      })
      .then(data => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : Array.isArray(data?.plants) ? data.plants : [];
        setCatalog(rows as CatalogPlant[]);
      })
      .catch(error => {
        if (!cancelled) setCatalogError(error instanceof Error ? error.message : 'Catalog could not be loaded.');
      });
    return () => { cancelled = true; };
  }, []);

  const resolvedPlants = useMemo(() => {
    if (!selectedRecipe || catalog.length === 0) return [];
    return selectedRecipe.plants
      .map(item => resolveRecipePlant(item, catalog))
      .filter((item): item is ResolvedRecipePlant => !!item);
  }, [catalog, selectedRecipe]);

  const generate = () => {
    setMessage('');
    if (!selectedRecipe) return;
    if (catalogError) {
      setMessage(`Plant catalog error: ${catalogError}`);
      return;
    }
    if (catalog.length === 0) {
      setMessage('Plant catalog is still loading. Try again in a moment.');
      return;
    }
    if (resolvedPlants.length !== selectedRecipe.plants.length) {
      const unresolved = selectedRecipe.plants.filter(item => !resolveRecipePlant(item, catalog)).map(item => item.name);
      setMessage(`Recipe blocked because these catalog plants could not be verified: ${unresolved.join(', ')}`);
      return;
    }

    const raw = localStorage.getItem(CURRENT_PLAN_KEY);
    if (!raw) {
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
      iterations: 420,
      padding: 4,
      plants: resolvedPlants.map(item => ({
        key: `${selectedRecipe.id}:${item.resolvedId}`,
        plantId: item.resolvedId,
        layer: item.layer,
        weight: item.weight,
        radius: Math.max(5, item.resolvedWidthFt * pixelsPerFoot * 0.525),
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
      notes: 'Generated with live catalog IDs and mature widths from the shared Matter.js recipe physics engine.',
      plantIds: [...new Set(resolvedPlants.map(item => item.resolvedId))],
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

    const correctedIds = resolvedPlants.filter(item => item.resolvedId !== item.plantId).length;
    setMessage(`${selectedRecipe.name}: ${generated.length} plants placed using verified live catalog IDs${correctedIds ? `; ${correctedIds} stale ID${correctedIds === 1 ? '' : 's'} corrected` : ''}.`);
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
          {(resolvedPlants.length === selectedRecipe.plants.length ? resolvedPlants : selectedRecipe.plants)
            .map(item => `${'resolvedName' in item ? item.resolvedName : item.name} ${item.weight}%`)
            .join(' · ')}
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
        Verifies each recipe plant against the live catalog and uses the same mature widths the app uses for overlap warnings.
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
