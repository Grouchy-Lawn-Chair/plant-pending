import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GardenPlan, GardenZone, PlacedPlant } from './types/plant';

const CURRENT_PLAN_KEY = 'garden-planner-current';

type HookNode = { memoizedState?: unknown; queue?: { dispatch?: (value: unknown) => void } | null; next?: HookNode | null };
type FiberNode = { child?: FiberNode | null; sibling?: FiberNode | null; return?: FiberNode | null; memoizedProps?: Record<string, unknown> | null; pendingProps?: Record<string, unknown> | null; memoizedState?: HookNode | null };

type ProgressState = {
  visible: boolean;
  percent: number;
  message: string;
};

const messages = [
  'Unfolding the garden-shaped container…',
  'Dropping tiny botanical marbles into the dirt…',
  'Politely asking the shrubs to stop sitting on each other…',
  'Applying a suspicious but legal amount of gravity…',
  'Checking the weird corners where plants go to hide…',
  'Filling the empty bits nobody volunteered for…',
  'Removing plants that attempted to leave the garden…',
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

function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x) inside = !inside;
  }
  return inside;
}

function bounds(points: Array<{ x: number; y: number }>) {
  return {
    minX: Math.min(...points.map(point => point.x)),
    maxX: Math.max(...points.map(point => point.x)),
    minY: Math.min(...points.map(point => point.y)),
    maxY: Math.max(...points.map(point => point.y)),
  };
}

function nearestInside(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
  if (pointInPolygon(point, polygon)) return point;
  const box = bounds(polygon);
  let best = polygon[0];
  let bestDistance = Infinity;
  const steps = 34;
  for (let y = 0; y <= steps; y++) {
    for (let x = 0; x <= steps; x++) {
      const candidate = {
        x: box.minX + (x / steps) * (box.maxX - box.minX),
        y: box.minY + (y / steps) * (box.maxY - box.minY),
      };
      if (!pointInPolygon(candidate, polygon)) continue;
      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }
  return best;
}

function overlapCount(plants: PlacedPlant[], pixelsPerFoot: number) {
  let count = 0;
  for (let i = 0; i < plants.length; i++) {
    for (let j = i + 1; j < plants.length; j++) {
      const radiusA = Math.max(5, ((plants[i].displayWidthFt || 2) * pixelsPerFoot) / 2);
      const radiusB = Math.max(5, ((plants[j].displayWidthFt || 2) * pixelsPerFoot) / 2);
      if (Math.hypot(plants[i].x - plants[j].x, plants[i].y - plants[j].y) < radiusA + radiusB) count++;
    }
  }
  return count;
}

async function relaxZone(plan: GardenPlan, zone: GardenZone, onProgress: (percent: number, message: string) => void) {
  const pixelsPerFoot = plan.scalePixelsPerFoot || 20;
  const allPlants = plan.placedPlants || [];
  const zonePlants = allPlants.filter(item => item.zone === zone.id && item.itemType !== 'rock').map(item => ({ ...item }));
  if (zonePlants.length < 2) return plan;

  const before = overlapCount(zonePlants, pixelsPerFoot);
  const iterations = 110;

  for (let iteration = 0; iteration < iterations; iteration++) {
    for (let i = 0; i < zonePlants.length; i++) {
      for (let j = i + 1; j < zonePlants.length; j++) {
        const a = zonePlants[i];
        const b = zonePlants[j];
        const radiusA = Math.max(5, ((a.displayWidthFt || 2) * pixelsPerFoot) / 2);
        const radiusB = Math.max(5, ((b.displayWidthFt || 2) * pixelsPerFoot) / 2);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.001;
        const preferred = (radiusA + radiusB) * 0.94;
        if (distance >= preferred) continue;
        const push = (preferred - distance) * 0.52;
        const ux = dx / distance;
        const uy = dy / distance;
        const nextA = nearestInside({ x: a.x - ux * push, y: a.y - uy * push }, zone.points);
        const nextB = nearestInside({ x: b.x + ux * push, y: b.y + uy * push }, zone.points);
        a.x = nextA.x;
        a.y = nextA.y;
        b.x = nextB.x;
        b.y = nextB.y;
      }
    }

    if (iteration % 10 === 0) {
      const percent = 68 + Math.round((iteration / iterations) * 24);
      onProgress(percent, messages[Math.min(messages.length - 1, 4 + Math.floor(iteration / 28))]);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
  }

  const after = overlapCount(zonePlants, pixelsPerFoot);
  const replacements = new Map(zonePlants.map(item => [item.instanceId, item]));
  const placedPlants = allPlants.map(item => replacements.get(item.instanceId) || item);
  const updated: GardenPlan = { ...plan, placedPlants, updatedAt: new Date().toISOString() };
  console.info(`[Recipe physics cleanup] overlaps ${before} -> ${after}`);
  return updated;
}

export default function RecipeGenerationEnhancements() {
  const [progress, setProgress] = useState<ProgressState>({ visible: false, percent: 0, message: messages[0] });

  useEffect(() => {
    let running = false;
    let bypass = false;

    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest('button');
      if (!button || bypass || running) return;
      const text = button.textContent?.toLowerCase() || '';
      if (!text.includes('generate')) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      running = true;

      const modal = button.closest('div.fixed') || button.parentElement;
      const zoneName = modal?.querySelector('h3')?.textContent?.trim() || '';
      const beforePlan = readPlan();
      const beforeUpdatedAt = beforePlan?.updatedAt || '';

      setProgress({ visible: true, percent: 8, message: messages[0] });

      window.setTimeout(() => {
        setProgress({ visible: true, percent: 18, message: messages[1] });
        bypass = true;
        button.click();
        bypass = false;

        let attempts = 0;
        const poll = window.setInterval(async () => {
          attempts++;
          const nextPlan = readPlan();
          if (!nextPlan || nextPlan.updatedAt === beforeUpdatedAt) {
            if (attempts > 120) {
              window.clearInterval(poll);
              setProgress({ visible: true, percent: 100, message: 'The shrubs have formed a committee. Please try again.' });
              window.setTimeout(() => setProgress(value => ({ ...value, visible: false })), 1500);
              running = false;
            }
            return;
          }

          window.clearInterval(poll);
          setProgress({ visible: true, percent: 64, message: messages[3] });
          const zone = (nextPlan.zones || []).find(item => item.name === zoneName);
          const improved = zone ? await relaxZone(nextPlan, zone, (percent, message) => setProgress({ visible: true, percent, message })) : nextPlan;
          setProgress({ visible: true, percent: 96, message: messages[7] });
          applyPlan(improved);
          localStorage.setItem(CURRENT_PLAN_KEY, JSON.stringify(improved));
          setProgress({ visible: true, percent: 100, message: 'Done. The shrubs are pretending this was their idea.' });
          window.setTimeout(() => setProgress(value => ({ ...value, visible: false })), 900);
          running = false;
        }, 150);
      }, 100);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  if (!progress.visible) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm">
      <div className="w-[min(560px,calc(100vw-32px))] rounded-3xl border border-violet-300/30 bg-slate-950 p-6 shadow-2xl">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-300">Botanical machinery in progress</div>
        <div className="mt-2 text-xl font-black text-white">Please remain calm. The plants are being negotiated with.</div>
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-200">{progress.message}</div>
        <div className="mt-5 h-4 overflow-hidden rounded-full border border-slate-700 bg-slate-900">
          <div className="h-full rounded-full bg-violet-400 transition-[width] duration-300" style={{ width: `${progress.percent}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>{progress.percent}%</span>
          <span>Probably needs a shrub.</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
