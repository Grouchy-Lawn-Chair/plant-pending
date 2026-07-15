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

type UpdateZone = (zoneId: string, updates: Partial<GardenZone>) => void;

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

function findFunction(start: FiberNode | null, name: string): Function | null {
  const root = rootOf(start);
  if (!root) return null;
  const stack = [root];
  const seen = new Set<FiberNode>();
  while (stack.length) {
    const fiber = stack.pop()!;
    if (seen.has(fiber)) continue;
    seen.add(fiber);
    const callback = fiber.memoizedProps?.[name] ?? fiber.pendingProps?.[name];
    if (typeof callback === 'function') return callback as Function;
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
  return null;
}

function pointToSegmentDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
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
  return {
    front: [...new Set(front)].sort((a, b) => a - b),
    back: [...new Set(back)].sort((a, b) => a - b),
  };
}

function isZoneEdgeHitLine(line: SVGLineElement) {
  if (line.getAttribute('stroke') !== 'transparent') return false;
  const label = line.parentElement?.querySelector('text')?.textContent?.trim().toLowerCase();
  return label === 'click edge' || label === 'front' || label === 'back';
}

function getZoneEdgeHitLines() {
  return [...document.querySelectorAll<SVGLineElement>('line[stroke="transparent"]')].filter(isZoneEdgeHitLine);
}

function findRenderedZone(plan: GardenPlan, line: SVGLineElement) {
  const x1 = Number(line.getAttribute('x1'));
  const y1 = Number(line.getAttribute('y1'));
  return (plan.zones || []).find(zone => zone.points.some(point => Math.abs(point.x - x1) < 0.5 && Math.abs(point.y - y1) < 0.5)) || null;
}

function worldPointForEvent(event: MouseEvent, svg: SVGSVGElement, zone: GardenZone): Point | null {
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const maxX = Math.max(...zone.points.map(point => point.x), 1);
  const maxY = Math.max(...zone.points.map(point => point.y), 1);
  const worldWidth = svg.viewBox.baseVal.width || svg.width.baseVal.value || Math.max(maxX, rect.width);
  const worldHeight = svg.viewBox.baseVal.height || svg.height.baseVal.value || Math.max(maxY, rect.height);
  return {
    x: (event.clientX - rect.left) * (worldWidth / rect.width),
    y: (event.clientY - rect.top) * (worldHeight / rect.height),
  };
}

export default function ZoneEdgeInteractionFix() {
  useEffect(() => {
    const widenTargets = () => {
      getZoneEdgeHitLines().forEach(line => {
        line.setAttribute('stroke-width', '46');
        line.setAttribute('pointer-events', 'stroke');
      });
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const plan = readPlan();
      if (!plan) return;

      const lines = getZoneEdgeHitLines();
      if (!lines.length) return;
      const line = lines[0];
      const zone = findRenderedZone(plan, line);
      const svg = line.ownerSVGElement;
      if (!zone || !svg || zone.points.length < 2) return;

      const point = worldPointForEvent(event, svg, zone);
      if (!point) return;
      const rect = svg.getBoundingClientRect();
      const maxX = Math.max(...zone.points.map(item => item.x), 1);
      const worldWidth = svg.viewBox.baseVal.width || svg.width.baseVal.value || Math.max(maxX, rect.width);
      const hitDistance = 28 * (worldWidth / rect.width);

      let nearestIndex = -1;
      let nearestDistance = Infinity;
      zone.points.forEach((start, index) => {
        const end = zone.points[(index + 1) % zone.points.length];
        const distance = pointToSegmentDistance(point, start, end);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      if (nearestIndex < 0 || nearestDistance > hitDistance) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const role = nextRole(zone, nearestIndex);
      const updateZone = findFunction(findFiber(document.getElementById('root')), 'onUpdateZone') as UpdateZone | null;
      if (updateZone) {
        updateZone(zone.id, { edgeRoles: updatedRoles(zone, nearestIndex, role) });
        return;
      }

      const nextPlan: GardenPlan = {
        ...plan,
        zones: (plan.zones || []).map(item => item.id === zone.id
          ? { ...item, edgeRoles: updatedRoles(item, nearestIndex, role) }
          : item),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(CURRENT_PLAN_KEY, JSON.stringify(nextPlan));
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
