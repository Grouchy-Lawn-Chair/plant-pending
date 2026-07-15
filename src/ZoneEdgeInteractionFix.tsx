import { useEffect } from 'react';
import type { GardenPlan, GardenZone } from './types/plant';

const CURRENT_PLAN_KEY = 'garden-planner-current';

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

function findZoneAndEdge(plan: GardenPlan, line: SVGLineElement) {
  const x1 = Number(line.getAttribute('x1'));
  const y1 = Number(line.getAttribute('y1'));
  const x2 = Number(line.getAttribute('x2'));
  const y2 = Number(line.getAttribute('y2'));
  for (const zone of plan.zones || []) {
    for (let index = 0; index < zone.points.length; index += 1) {
      const start = zone.points[index];
      const end = zone.points[(index + 1) % zone.points.length];
      const forward = Math.abs(start.x - x1) < 0.5 && Math.abs(start.y - y1) < 0.5 && Math.abs(end.x - x2) < 0.5 && Math.abs(end.y - y2) < 0.5;
      const reverse = Math.abs(start.x - x2) < 0.5 && Math.abs(start.y - y2) < 0.5 && Math.abs(end.x - x1) < 0.5 && Math.abs(end.y - y1) < 0.5;
      if (forward || reverse) return { zone, edgeIndex: index };
    }
  }
  return null;
}

function screenPoint(line: SVGLineElement, x: number, y: number) {
  const svg = line.ownerSVGElement;
  const matrix = line.getScreenCTM();
  if (!svg || !matrix) return null;
  const point = svg.createSVGPoint();
  point.x = x;
  point.y = y;
  return point.matrixTransform(matrix);
}

export default function ZoneEdgeInteractionFix() {
  useEffect(() => {
    const overlayRoot = document.createElement('div');
    overlayRoot.dataset.zoneEdgeOverlayRoot = 'true';
    overlayRoot.style.position = 'fixed';
    overlayRoot.style.inset = '0';
    overlayRoot.style.pointerEvents = 'none';
    overlayRoot.style.zIndex = '2147483646';
    document.body.appendChild(overlayRoot);

    const renderOverlays = () => {
      overlayRoot.replaceChildren();
      const plan = readPlan();
      if (!plan) return;

      for (const line of getZoneEdgeHitLines()) {
        const match = findZoneAndEdge(plan, line);
        if (!match) continue;

        const x1 = Number(line.getAttribute('x1'));
        const y1 = Number(line.getAttribute('y1'));
        const x2 = Number(line.getAttribute('x2'));
        const y2 = Number(line.getAttribute('y2'));
        const start = screenPoint(line, x1, y1);
        const end = screenPoint(line, x2, y2);
        if (!start || !end) continue;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const role = match.zone.edgeRoles?.front?.includes(match.edgeIndex)
          ? 'front'
          : match.zone.edgeRoles?.back?.includes(match.edgeIndex)
            ? 'back'
            : 'click edge';

        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.zoneEdgeIndex = String(match.edgeIndex);
        button.title = `Set edge role: ${role} → ${role === 'click edge' ? 'front' : role === 'front' ? 'back' : 'unmarked'}`;
        button.setAttribute('aria-label', button.title);
        button.style.position = 'fixed';
        button.style.left = `${(start.x + end.x) / 2}px`;
        button.style.top = `${(start.y + end.y) / 2}px`;
        button.style.width = `${Math.max(44, length)}px`;
        button.style.height = '44px';
        button.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        button.style.transformOrigin = 'center';
        button.style.pointerEvents = 'auto';
        button.style.cursor = 'pointer';
        button.style.border = '0';
        button.style.padding = '0';
        button.style.margin = '0';
        button.style.background = 'transparent';

        button.addEventListener('mousedown', event => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }, true);

        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          const freshPlan = readPlan();
          const freshZone = freshPlan?.zones?.find(zone => zone.id === match.zone.id);
          if (!freshPlan || !freshZone) return;
          const roleValue = nextRole(freshZone, match.edgeIndex);
          const edgeRoles = updatedRoles(freshZone, match.edgeIndex, roleValue);
          const updateZone = findFunction(findFiber(document.getElementById('root')), 'onUpdateZone') as UpdateZone | null;
          if (updateZone) {
            updateZone(freshZone.id, { edgeRoles });
          } else {
            const nextPlan: GardenPlan = {
              ...freshPlan,
              zones: (freshPlan.zones || []).map(zone => zone.id === freshZone.id ? { ...zone, edgeRoles } : zone),
              updatedAt: new Date().toISOString(),
            };
            localStorage.setItem(CURRENT_PLAN_KEY, JSON.stringify(nextPlan));
          }
          window.setTimeout(renderOverlays, 0);
        }, true);

        overlayRoot.appendChild(button);
      }
    };

    const observer = new MutationObserver(renderOverlays);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['transform', 'style'] });
    const timer = window.setInterval(renderOverlays, 250);
    window.addEventListener('resize', renderOverlays);
    window.addEventListener('scroll', renderOverlays, true);
    renderOverlays();

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      window.removeEventListener('resize', renderOverlays);
      window.removeEventListener('scroll', renderOverlays, true);
      overlayRoot.remove();
    };
  }, []);

  return null;
}
