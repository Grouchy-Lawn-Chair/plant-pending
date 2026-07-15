import { useEffect } from 'react';
import type { GardenPlan, GardenZone } from './types/plant';

const CURRENT_PLAN_KEY = 'garden-planner-current';

type Point = { x: number; y: number };
type FiberNode = {
  child?: FiberNode | null;
  sibling?: FiberNode | null;
  return?: FiberNode | null;
  memoizedProps?: Record<string, unknown> | null;
  pendingProps?: Record<string, unknown> | null;
};

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
  while (root?.return) root = root.return;
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
  const root = document.getElementById('root');
  const callback = findCallback(findFiber(root), 'onImportPlan') || findCallback(findFiber(root), 'onLoadPlan');
  if (!callback) return false;
  callback(plan);
  localStorage.setItem(CURRENT_PLAN_KEY, JSON.stringify(plan));
  return true;
}

function samePoint(a: Point, b: Point) {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

function findZoneEdge(plan: GardenPlan, line: SVGLineElement): { zone: GardenZone; edgeIndex: number } | null {
  const a = { x: Number(line.getAttribute('x1')), y: Number(line.getAttribute('y1')) };
  const b = { x: Number(line.getAttribute('x2')), y: Number(line.getAttribute('y2')) };
  for (const zone of plan.zones || []) {
    for (let index = 0; index < zone.points.length; index += 1) {
      const start = zone.points[index];
      const end = zone.points[(index + 1) % zone.points.length];
      if ((samePoint(a, start) && samePoint(b, end)) || (samePoint(a, end) && samePoint(b, start))) {
        return { zone, edgeIndex: index };
      }
    }
  }
  return null;
}

function nextRole(zone: GardenZone, edgeIndex: number): 'front' | 'back' | '' {
  if (zone.edgeRoles?.front?.includes(edgeIndex)) return 'back';
  if (zone.edgeRoles?.back?.includes(edgeIndex)) return '';
  return 'front';
}

function updatedRoles(zone: GardenZone, edgeIndex: number, role: 'front' | 'back' | '') {
  const front = (zone.edgeRoles?.front || []).filter(index => index !== edgeIndex);
  const back = (zone.edgeRoles?.back || []).filter(index => index !== edgeIndex);
  if (role === 'front') front.push(edgeIndex);
  if (role === 'back') back.push(edgeIndex);
  return { front: [...new Set(front)].sort((a, b) => a - b), back: [...new Set(back)].sort((a, b) => a - b) };
}

function isEdgeHitLine(target: EventTarget | null): target is SVGLineElement {
  return target instanceof SVGLineElement && target.getAttribute('stroke') === 'transparent';
}

export default function ZoneEdgeInteractionFix() {
  useEffect(() => {
    const widenTargets = () => {
      document.querySelectorAll<SVGLineElement>('line[stroke="transparent"]').forEach(line => {
        line.setAttribute('stroke-width', '46');
        line.style.pointerEvents = 'stroke';
      });
    };

    const onMouseDown = (event: MouseEvent) => {
      if (!isEdgeHitLine(event.target) || event.button !== 0) return;
      const plan = readPlan();
      if (!plan) return;
      const match = findZoneEdge(plan, event.target);
      if (!match) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const role = nextRole(match.zone, match.edgeIndex);
      const nextPlan: GardenPlan = {
        ...plan,
        zones: plan.zones.map(zone => zone.id === match.zone.id
          ? { ...zone, edgeRoles: updatedRoles(zone, match.edgeIndex, role) }
          : zone),
        updatedAt: new Date().toISOString(),
      };
      applyPlan(nextPlan);
    };

    const observer = new MutationObserver(widenTargets);
    observer.observe(document.body, { childList: true, subtree: true });
    widenTargets();
    document.addEventListener('mousedown', onMouseDown, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('mousedown', onMouseDown, true);
    };
  }, []);

  return null;
}
