import { useEffect } from 'react';
import type { GardenPlan, PlacedPlant } from './types/plant';
import { recordRecipeDebug } from './utils/recipeGenerationDebug';

const CURRENT_PLAN_KEY = 'garden-planner-current';
const RECIPE_COLORS = ['#D54E27','#A3DECF','#A073C2','#DDE985','#59A5CB','#E8B85C','#B26175','#6CA47F','#88778F','#F6DA7B','#79C7A5','#D76F4C','#8B6FAF','#94B797','#C98A5F','#7FAEBC','#DFA3A3','#B8C96F','#6E8F73','#94AA75'];

type ColorPlan = GardenPlan & { plantColors?: Record<string, string> };

type ColorPlantDiagnostic = {
  instanceId: string;
  plantId: number;
  plantName: string | null;
  zoneId: string;
  driftId: string | null;
  mergeable: boolean;
  customColor: string | null;
  planSpeciesColor: string | null;
  catalogDefaultColor: null;
  generatedRecipeColor: string;
  resolvedColor: string;
  resolvedColorSource: 'planSpeciesColor' | 'customColor' | 'generatedRecipeColor';
};

function readPlan(): ColorPlan | null {
  try {
    const raw = localStorage.getItem(CURRENT_PLAN_KEY);
    return raw ? JSON.parse(raw) as ColorPlan : null;
  } catch {
    return null;
  }
}

function debugHost(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-recipe-react-host]') || document.getElementById('root');
}

function driftId(plant: PlacedPlant): string | null {
  return plant.notes?.match(/\[drift:([^\]]+)\]/)?.[1] || null;
}

function generatedRecipeColor(plantId: number): string {
  return RECIPE_COLORS[Math.abs(Math.imul(plantId, 2654435761)) % RECIPE_COLORS.length];
}

function plantName(plant: PlacedPlant): string | null {
  return (plant as PlacedPlant & { plantName?: string }).plantName || null;
}

function plantDiagnostic(plan: ColorPlan, plant: PlacedPlant): ColorPlantDiagnostic {
  const planSpeciesColor = plan.plantColors?.[String(plant.plantId)] || null;
  const recipeColor = generatedRecipeColor(plant.plantId);
  const customColor = plant.customColor || null;
  const resolvedColor = planSpeciesColor || customColor || recipeColor;
  const resolvedColorSource = planSpeciesColor
    ? 'planSpeciesColor'
    : customColor
      ? 'customColor'
      : 'generatedRecipeColor';
  return {
    instanceId: plant.instanceId,
    plantId: plant.plantId,
    plantName: plantName(plant),
    zoneId: plant.zone || '',
    driftId: driftId(plant),
    mergeable: plant.notes?.includes('[mergeable]') || false,
    customColor,
    planSpeciesColor,
    catalogDefaultColor: null,
    generatedRecipeColor: recipeColor,
    resolvedColor,
    resolvedColorSource,
  };
}

function colorSnapshot(plan: ColorPlan) {
  const plants = (plan.placedPlants || [])
    .filter(item => item.itemType !== 'rock')
    .map(item => plantDiagnostic(plan, item));
  const groups = new Map<string, ColorPlantDiagnostic[]>();
  plants.forEach(item => {
    if (!item.mergeable || !item.driftId) return;
    const key = `${item.zoneId}|${item.plantId}|${item.driftId}`;
    const members = groups.get(key) || [];
    members.push(item);
    groups.set(key, members);
  });
  const clumps = [...groups.entries()].map(([clumpId, members]) => {
    const first = members[0];
    return {
      clumpId,
      plantId: first.plantId,
      plantName: first.plantName,
      memberInstanceIds: members.map(item => item.instanceId),
      memberColors: members.map(item => ({
        instanceId: item.instanceId,
        customColor: item.customColor,
        resolvedColor: item.resolvedColor,
        resolvedColorSource: item.resolvedColorSource,
      })),
      planSpeciesColor: first.planSpeciesColor,
      resolvedColor: first.resolvedColor,
      resolvedColorSource: first.resolvedColorSource,
      rendererType: 'PlantDriftOverlay',
      rendererColorRule: 'first member color unless the renderer overrides it',
      colorMismatch: new Set(members.map(item => item.resolvedColor.toLowerCase())).size > 1,
    };
  });
  return {
    plantColors: plan.plantColors || {},
    plants,
    clumps,
    summary: {
      placedPlantCount: plants.length,
      speciesCount: new Set(plants.map(item => item.plantId)).size,
      clumpCount: clumps.length,
      clumpsWithMixedMemberColors: clumps.filter(item => item.colorMismatch).length,
    },
  };
}

function changedPlants(before: ColorPlan | null, after: ColorPlan) {
  const old = new Map((before?.placedPlants || []).map(item => [item.instanceId, item.customColor || null]));
  return (after.placedPlants || []).filter(item => item.itemType !== 'rock' && old.get(item.instanceId) !== (item.customColor || null));
}

export default function ColorDiagnostics() {
  useEffect(() => {
    let beforeColorPlan: ColorPlan | null = null;
    let verifyTimer = 0;
    let snapshotTimer = 0;
    let lastSnapshotSignature = '';

    const recordSnapshot = () => {
      const plan = readPlan();
      const host = debugHost();
      if (!plan || !host) return;
      const signature = JSON.stringify({
        updatedAt: plan.updatedAt,
        plantColors: plan.plantColors || {},
        colors: (plan.placedPlants || []).map(item => [item.instanceId, item.customColor || null]),
      });
      if (signature === lastSnapshotSignature) return;
      lastSnapshotSignature = signature;
      recordRecipeDebug(host, 'color.renderSnapshot', colorSnapshot(plan));
    };

    const onInputCapture = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== 'color') return;
      if (!beforeColorPlan) beforeColorPlan = readPlan();
    };

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== 'color') return;
      const before = beforeColorPlan;
      const requestedColor = target.value;
      beforeColorPlan = null;
      window.clearTimeout(verifyTimer);
      verifyTimer = window.setTimeout(() => {
        const after = readPlan();
        const host = debugHost();
        if (!after || !host) return;
        const changed = changedPlants(before, after);
        const plantIds = [...new Set(changed.map(item => item.plantId))];
        const selected = changed.length === 1 ? changed[0] : null;
        const plantId = plantIds.length === 1 ? plantIds[0] : selected?.plantId ?? null;
        const matching = plantId === null ? [] : (after.placedPlants || []).filter(item => item.itemType !== 'rock' && item.plantId === plantId);
        const expectedColor = requestedColor.toLowerCase();
        const correct = matching.filter(item => (item.customColor || '').toLowerCase() === expectedColor);
        const incorrect = matching.filter(item => (item.customColor || '').toLowerCase() !== expectedColor);
        const affectedClumps = new Set(matching.map(driftId).filter(Boolean));
        recordRecipeDebug(host, 'speciesColor.changed', {
          selectedInstanceId: selected?.instanceId || null,
          plantId,
          oldColor: selected && before?.placedPlants?.find(item => item.instanceId === selected.instanceId)?.customColor || null,
          newColor: requestedColor,
          matchingInstanceCount: matching.length,
          updatedInstanceCount: correct.length,
          clumpsAffected: affectedClumps.size,
          planSpeciesColorBefore: plantId === null ? null : before?.plantColors?.[String(plantId)] || null,
          planSpeciesColorAfter: plantId === null ? null : after.plantColors?.[String(plantId)] || null,
          directlyChangedInstances: changed.map(item => ({ instanceId: item.instanceId, plantId: item.plantId, customColor: item.customColor || null })),
        });
        recordRecipeDebug(host, 'speciesColor.verified', {
          plantId,
          expectedColor: requestedColor,
          matchingPlants: matching.length,
          correctPlants: correct.length,
          incorrectPlants: incorrect.length,
          incorrectInstances: incorrect.map(item => ({ instanceId: item.instanceId, actualColor: item.customColor || null, driftId: driftId(item) })),
        });
        recordRecipeDebug(host, 'color.renderSnapshot', colorSnapshot(after));
        lastSnapshotSignature = '';
      }, 350);
    };

    const observer = new MutationObserver(() => {
      window.clearTimeout(snapshotTimer);
      snapshotTimer = window.setTimeout(recordSnapshot, 250);
    });
    observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
    const interval = window.setInterval(recordSnapshot, 1500);
    document.addEventListener('input', onInputCapture, true);
    document.addEventListener('change', onChange, false);
    recordSnapshot();

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.clearTimeout(verifyTimer);
      window.clearTimeout(snapshotTimer);
      document.removeEventListener('input', onInputCapture, true);
      document.removeEventListener('change', onChange, false);
    };
  }, []);

  return null;
}
