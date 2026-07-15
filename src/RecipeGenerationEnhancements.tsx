import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GardenPlan, GardenZone, PlacedPlant } from './types/plant';

const CURRENT_PLAN_KEY = 'garden-planner-current';

type Point = { x: number; y: number };
type HookNode = { memoizedState?: unknown; queue?: { dispatch?: (value: unknown) => void } | null; next?: HookNode | null };
type FiberNode = { child?: FiberNode | null; sibling?: FiberNode | null; return?: FiberNode | null; memoizedProps?: Record<string, unknown> | null; pendingProps?: Record<string, unknown> | null; memoizedState?: HookNode | null };
type ProgressState = { visible: boolean; percent: number; message: string };
type PlantCardInfo = { card: HTMLElement; name: string; widthInches: number; enabled: boolean; placement: string; checkbox: HTMLInputElement; widthInput: HTMLInputElement };
type PreflightIssue = { plant: PlantCardInfo; availableInches: number };
type PendingRun = { button: HTMLButtonElement; zone: GardenZone; plan: GardenPlan; issues: PreflightIssue[]; hedge: boolean };

const messages = [
  'Measuring the dirt. It remains dirt.',
  'Dropping tiny botanical marbles into the garden jar…',
  'Physics is doing the slow bit. The browser may stare into space.',
  'Politely asking the shrubs to stop sitting on each other…',
  'Checking rocks. Rocks remain extremely committed to their locations.',
  'Evicting plants from the forbidden polygon…',
  'Checking the weird corners where plants go to hide…',
  'Final shrub inspection. Clipboards have appeared.',
];

function readPlan(): GardenPlan | null {
  try {
    const raw = localStorage.getItem(CURRENT_PLAN_KEY);
    return raw ? JSON.parse(raw) as GardenPlan : null;
  } catch {
    return null;
  }
}

function findFiber(element: Element | null): FiberNode | null {
  let current = element;
  while (current) {
    const key = Object.keys(current).find(name => name.startsWith('__reactFiber$'));
    if (key) return (current as unknown as Record<string, FiberNode>)[key] || null;
    current = current.parentElement;
  }
  return null;
}

function rootOf(start: FiberNode | null) {
  let root = start;
  if (!root) return null;
  while (root.return) root = root.return;
  return root;
}

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

function applyPlan(plan: GardenPlan) {
  const host = document.querySelector<HTMLElement>('[data-recipe-react-host]') || document.getElementById('root');
  const callback = findCallback(findFiber(host), 'onImportPlan') || findCallback(findFiber(host), 'onLoadPlan');
  if (!callback) return false;
  callback(plan);
  return true;
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x) inside = !inside;
  }
  return inside;
}

function bounds(points: Point[]) {
  return {
    minX: Math.min(...points.map(point => point.x)),
    maxX: Math.max(...points.map(point => point.x)),
    minY: Math.min(...points.map(point => point.y)),
    maxY: Math.max(...points.map(point => point.y)),
  };
}

function distanceToSegment(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function edgeDistance(point: Point, polygon: Point[]) {
  return Math.min(...polygon.map((a, index) => distanceToSegment(point, a, polygon[(index + 1) % polygon.length])));
}

function circlesOverlap(a: Point, radiusA: number, b: Point, radiusB: number, factor = 0.94) {
  return Math.hypot(a.x - b.x, a.y - b.y) < (radiusA + radiusB) * factor;
}

function plantRadius(plant: PlacedPlant, pixelsPerFoot: number) {
  return Math.max(5, ((plant.displayWidthFt || 2) * pixelsPerFoot) / 2);
}

function rockRadius(rock: PlacedPlant, pixelsPerFoot: number) {
  return Math.max(6, ((rock.rockSizeFt || 2) * pixelsPerFoot) / 2);
}

function relevantExclusions(plan: GardenPlan, zone: GardenZone) {
  const zoneBox = bounds(zone.points);
  return (plan.zones || []).filter(candidate => {
    if (candidate.zoneType !== 'exclusion' || candidate.points.length < 3) return false;
    const box = bounds(candidate.points);
    return box.maxX >= zoneBox.minX && box.minX <= zoneBox.maxX && box.maxY >= zoneBox.minY && box.minY <= zoneBox.maxY;
  });
}

function isValidCenter(point: Point, radius: number, zone: GardenZone, exclusions: GardenZone[], rocks: PlacedPlant[], pixelsPerFoot: number) {
  if (!pointInPolygon(point, zone.points) || edgeDistance(point, zone.points) < radius) return false;
  for (const exclusion of exclusions) {
    if (pointInPolygon(point, exclusion.points) || edgeDistance(point, exclusion.points) < radius) return false;
  }
  return rocks.every(rock => !circlesOverlap(point, radius, rock, rockRadius(rock, pixelsPerFoot), 1));
}

function findBestOpenPoint(wanted: Point, radius: number, zone: GardenZone, exclusions: GardenZone[], rocks: PlacedPlant[], settled: PlacedPlant[], pixelsPerFoot: number) {
  const box = bounds(zone.points);
  let best: Point | null = null;
  let bestScore = -Infinity;
  const steps = 46;
  for (let y = 0; y <= steps; y++) {
    for (let x = 0; x <= steps; x++) {
      const candidate = { x: box.minX + (x / steps) * (box.maxX - box.minX), y: box.minY + (y / steps) * (box.maxY - box.minY) };
      if (!isValidCenter(candidate, radius, zone, exclusions, rocks, pixelsPerFoot)) continue;
      let clearance = Math.min(edgeDistance(candidate, zone.points), 200);
      for (const plant of settled) clearance = Math.min(clearance, Math.hypot(candidate.x - plant.x, candidate.y - plant.y) - plantRadius(plant, pixelsPerFoot) - radius);
      const movementPenalty = Math.hypot(candidate.x - wanted.x, candidate.y - wanted.y) * 0.04;
      const score = clearance - movementPenalty;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
  }
  return best;
}

function overlapCount(plants: PlacedPlant[], pixelsPerFoot: number) {
  let count = 0;
  for (let i = 0; i < plants.length; i++) {
    for (let j = i + 1; j < plants.length; j++) {
      if (circlesOverlap(plants[i], plantRadius(plants[i], pixelsPerFoot), plants[j], plantRadius(plants[j], pixelsPerFoot))) count++;
    }
  }
  return count;
}

function collectPlantCards(host: HTMLElement): PlantCardInfo[] {
  return [...host.querySelectorAll<HTMLElement>('div.rounded-xl')].flatMap(card => {
    const checkbox = card.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const widthLabel = [...card.querySelectorAll('label')].find(label => label.textContent?.includes('Width in'));
    const widthInput = widthLabel?.querySelector<HTMLInputElement>('input[type="number"]');
    const placementLabel = [...card.querySelectorAll('label')].find(label => label.textContent?.includes('Placement'));
    const placement = placementLabel?.querySelector<HTMLSelectElement>('select')?.value || '';
    const name = card.querySelector<HTMLElement>('.font-bold')?.textContent?.trim() || '';
    if (!checkbox || !widthInput || !name) return [];
    return [{ card, name, widthInches: Number(widthInput.value) || 0, enabled: checkbox.checked, placement, checkbox, widthInput }];
  });
}

function maximumClearDiameter(zone: GardenZone, exclusions: GardenZone[], rocks: PlacedPlant[], pixelsPerFoot: number) {
  const box = bounds(zone.points);
  let bestRadius = 0;
  const steps = 42;
  for (let y = 0; y <= steps; y++) {
    for (let x = 0; x <= steps; x++) {
      const point = { x: box.minX + (x / steps) * (box.maxX - box.minX), y: box.minY + (y / steps) * (box.maxY - box.minY) };
      if (!pointInPolygon(point, zone.points)) continue;
      let radius = edgeDistance(point, zone.points);
      for (const exclusion of exclusions) {
        if (pointInPolygon(point, exclusion.points)) radius = 0;
        else radius = Math.min(radius, edgeDistance(point, exclusion.points));
      }
      for (const rock of rocks) radius = Math.min(radius, Math.max(0, Math.hypot(point.x - rock.x, point.y - rock.y) - rockRadius(rock, pixelsPerFoot)));
      bestRadius = Math.max(bestRadius, radius);
    }
  }
  return (bestRadius * 2 / pixelsPerFoot) * 12;
}

async function cleanGeneratedZone(plan: GardenPlan, zone: GardenZone, onProgress: (percent: number, message: string) => void) {
  const pixelsPerFoot = plan.scalePixelsPerFoot || 20;
  const allPlants = plan.placedPlants || [];
  const zonePlants = allPlants.filter(item => item.zone === zone.id && item.itemType !== 'rock').map(item => ({ ...item }));
  const rocks = allPlants.filter(item => item.itemType === 'rock' && (pointInPolygon(item, zone.points) || item.zone === zone.id));
  const exclusions = relevantExclusions(plan, zone);
  if (zonePlants.length === 0) return plan;

  const before = overlapCount(zonePlants, pixelsPerFoot);
  onProgress(68, messages[4]);
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

  // Largest plants claim valid space first. Smaller plants then fill the remaining pockets.
  const ordered = [...zonePlants].sort((a, b) => plantRadius(b, pixelsPerFoot) - plantRadius(a, pixelsPerFoot));
  const settled: PlacedPlant[] = [];
  const rejected = new Set<string>();
  for (let index = 0; index < ordered.length; index++) {
    const plant = ordered[index];
    const radius = plantRadius(plant, pixelsPerFoot);
    const collides = settled.some(other => circlesOverlap(plant, radius, other, plantRadius(other, pixelsPerFoot)));
    if (!isValidCenter(plant, radius, zone, exclusions, rocks, pixelsPerFoot) || collides) {
      const replacement = findBestOpenPoint(plant, radius, zone, exclusions, rocks, settled, pixelsPerFoot);
      if (!replacement) {
        rejected.add(plant.instanceId);
        continue;
      }
      plant.x = replacement.x;
      plant.y = replacement.y;
    }
    settled.push(plant);
    if (index % 6 === 0) {
      onProgress(72 + Math.round((index / Math.max(1, ordered.length)) * 18), exclusions.length ? messages[5] : messages[6]);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
  }

  // A short relaxation pass removes small residual collisions without allowing rocks or exclusions to move.
  for (let iteration = 0; iteration < 36; iteration++) {
    for (let i = 0; i < settled.length; i++) {
      for (let j = i + 1; j < settled.length; j++) {
        const a = settled[i];
        const b = settled[j];
        const radiusA = plantRadius(a, pixelsPerFoot);
        const radiusB = plantRadius(b, pixelsPerFoot);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.001;
        const preferred = (radiusA + radiusB) * 0.96;
        if (distance >= preferred) continue;
        const push = (preferred - distance) * 0.56;
        const ux = dx / distance;
        const uy = dy / distance;
        const wantedA = { x: a.x - ux * push, y: a.y - uy * push };
        const wantedB = { x: b.x + ux * push, y: b.y + uy * push };
        if (isValidCenter(wantedA, radiusA, zone, exclusions, rocks, pixelsPerFoot)) Object.assign(a, wantedA);
        if (isValidCenter(wantedB, radiusB, zone, exclusions, rocks, pixelsPerFoot)) Object.assign(b, wantedB);
      }
    }
    if (iteration % 9 === 0) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }

  const replacements = new Map(settled.map(item => [item.instanceId, item]));
  const placedPlants = allPlants.flatMap(item => {
    if (rejected.has(item.instanceId)) return [];
    return [replacements.get(item.instanceId) || item];
  });
  const after = overlapCount(settled, pixelsPerFoot);
  console.info(`[Recipe physics cleanup] overlaps ${before} -> ${after}; exclusions ${exclusions.length}; rocks ${rocks.length}; removed ${rejected.size}`);
  return { ...plan, placedPlants, updatedAt: new Date().toISOString() };
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export default function RecipeGenerationEnhancements() {
  const [progress, setProgress] = useState<ProgressState>({ visible: false, percent: 0, message: messages[0] });
  const [pending, setPending] = useState<PendingRun | null>(null);
  const [trimWidth, setTrimWidth] = useState(36);

  useEffect(() => {
    let running = false;
    let bypass = false;

    const runGeneration = (button: HTMLButtonElement, zone: GardenZone, beforePlan: GardenPlan) => {
      running = true;
      const beforeUpdatedAt = beforePlan.updatedAt || '';
      setProgress({ visible: true, percent: 8, message: messages[0] });

      window.setTimeout(() => {
        setProgress({ visible: true, percent: 24, message: messages[2] });
        bypass = true;
        button.click();
        bypass = false;

        let attempts = 0;
        const poll = window.setInterval(async () => {
          attempts++;
          const nextPlan = readPlan();
          if (!nextPlan || nextPlan.updatedAt === beforeUpdatedAt) {
            if (attempts > 180) {
              window.clearInterval(poll);
              setProgress({ visible: true, percent: 100, message: 'The shrubs have formed a committee. Please try again.' });
              window.setTimeout(() => setProgress(value => ({ ...value, visible: false })), 1500);
              running = false;
            }
            return;
          }

          window.clearInterval(poll);
          setProgress({ visible: true, percent: 64, message: messages[3] });
          const freshZone = (nextPlan.zones || []).find(item => item.id === zone.id) || zone;
          const improved = await cleanGeneratedZone(nextPlan, freshZone, (percent, message) => setProgress({ visible: true, percent, message }));
          setProgress({ visible: true, percent: 96, message: messages[7] });
          applyPlan(improved);
          localStorage.setItem(CURRENT_PLAN_KEY, JSON.stringify(improved));
          setProgress({ visible: true, percent: 100, message: 'Done. The shrubs are pretending this was their idea.' });
          window.setTimeout(() => setProgress(value => ({ ...value, visible: false })), 900);
          running = false;
        }, 150);
      }, 120);
    };

    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button');
      const recipeHost = button?.closest<HTMLElement>('[data-recipe-react-host]');
      if (!button || !recipeHost || bypass || running) return;
      const text = button.textContent?.trim().toLowerCase() || '';
      if (text !== 'generate' && text !== 'new seed + generate') return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const modal = recipeHost.closest('div.fixed') || recipeHost.parentElement;
      const zoneName = modal?.querySelector('h3')?.textContent?.trim() || '';
      const plan = readPlan();
      const zone = plan?.zones?.find(item => item.name === zoneName);
      if (!plan || !zone) return;

      const cards = collectPlantCards(recipeHost).filter(item => item.enabled);
      const exclusions = relevantExclusions(plan, zone);
      const pixelsPerFoot = plan.scalePixelsPerFoot || 20;
      const rocks = (plan.placedPlants || []).filter(item => item.itemType === 'rock' && (pointInPolygon(item, zone.points) || item.zone === zone.id));
      const availableInches = maximumClearDiameter(zone, exclusions, rocks, pixelsPerFoot);
      const issues = cards.filter(item => item.widthInches > availableInches * 1.02).map(plant => ({ plant, availableInches }));
      const hedge = zone.plantingType === 'hedgeRow' || /hedge|privacy|fence/i.test(zone.name) || cards.some(item => item.placement === 'back-attract');

      if (issues.length || hedge) {
        setTrimWidth(Math.max(12, Math.min(72, Math.round(availableInches))));
        setPending({ button, zone, plan, issues, hedge });
        return;
      }
      runGeneration(button, zone, plan);
    };

    const onProceed = (event: Event) => {
      const detail = (event as CustomEvent<{ button: HTMLButtonElement; zone: GardenZone; plan: GardenPlan }>).detail;
      runGeneration(detail.button, detail.zone, detail.plan);
    };
    document.addEventListener('recipe-preflight-proceed', onProceed);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('recipe-preflight-proceed', onProceed);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  const proceed = (mode: 'adjust' | 'exclude' | 'trim' | 'anyway') => {
    if (!pending) return;
    if (mode === 'adjust') {
      setPending(null);
      return;
    }
    if (mode === 'exclude') {
      pending.issues.forEach(issue => issue.plant.checkbox.click());
    }
    if (mode === 'trim') {
      collectPlantCards(pending.button.closest<HTMLElement>('[data-recipe-react-host]')!).filter(item => item.enabled && item.placement === 'back-attract').forEach(item => setInputValue(item.widthInput, String(trimWidth)));
    }
    const detail = { button: pending.button, zone: pending.zone, plan: pending.plan };
    setPending(null);
    window.setTimeout(() => document.dispatchEvent(new CustomEvent('recipe-preflight-proceed', { detail })), 80);
  };

  return <>
    {pending && createPortal(
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
        <div className="max-h-[calc(100vh-32px)] w-[min(620px,100%)] overflow-auto rounded-3xl border border-amber-300/35 bg-slate-950 p-6 text-white shadow-2xl">
          <div className="text-[11px] font-black uppercase tracking-[.2em] text-amber-300">Pre-shrub flight check</div>
          <h2 className="mt-2 text-xl font-black">Before we launch several plants into a polygon…</h2>
          <p className="mt-2 text-sm text-slate-300">The app measured the usable space, exclusion zones, and rocks. A few botanical decisions require adult supervision.</p>
          {pending.issues.length > 0 && <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-950/25 p-4">
            <div className="font-bold text-amber-200">Too large at the current width</div>
            <div className="mt-2 space-y-1 text-sm text-slate-200">{pending.issues.map(issue => <div key={issue.plant.name}>• {issue.plant.name}: {Math.round(issue.plant.widthInches)} in wide; this zone has about {Math.max(0, Math.round(issue.availableInches))} in of clear diameter.</div>)}</div>
          </div>}
          {pending.hedge && <div className="mt-4 rounded-2xl border border-violet-400/30 bg-violet-950/25 p-4">
            <div className="font-bold text-violet-200">Hedge detected. It would like a haircut plan.</div>
            <label className="mt-2 block text-sm">Maintained hedge width (inches)<input type="number" min="12" max="120" value={trimWidth} onChange={event => setTrimWidth(Number(event.target.value) || 12)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2" /></label>
            <button type="button" onClick={() => proceed('trim')} className="mt-3 w-full rounded-xl bg-violet-600 px-3 py-2.5 font-bold">Use this trim width and generate</button>
          </div>}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {pending.issues.length > 0 && <button type="button" onClick={() => proceed('exclude')} className="rounded-xl bg-amber-600 px-3 py-2.5 font-bold">Exclude plants that cannot fit</button>}
            <button type="button" onClick={() => proceed('adjust')} className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 font-bold">Go back and adjust widths</button>
            <button type="button" onClick={() => proceed('anyway')} className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-3 py-2.5 font-bold">Generate anyway, tempt fate</button>
          </div>
        </div>
      </div>, document.body)}
    {progress.visible && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm">
        <div className="w-[min(560px,calc(100vw-32px))] rounded-3xl border border-violet-300/30 bg-slate-950 p-6 shadow-2xl">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-300">Botanical machinery in progress</div>
          <div className="mt-2 text-xl font-black text-white">Please remain calm. The plants are being negotiated with.</div>
          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-200">{progress.message}</div>
          <div className="mt-5 h-4 overflow-hidden rounded-full border border-slate-700 bg-slate-900">
            <div className="h-full rounded-full bg-violet-400 transition-[width] duration-300" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400"><span>{progress.percent}%</span><span>Probably needs a shrub.</span></div>
        </div>
      </div>, document.body)}
  </>;
}
