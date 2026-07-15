const CURRENT_PLAN_KEY = 'garden-planner-current';

type Point = { x: number; y: number };
type Zone = {
  id?: string;
  points?: Point[];
  edgeRoles?: { front?: number[]; back?: number[] };
};
type StoredPlan = { zones?: Zone[] };

function edgeMidpoint(points: Point[], index: number): Point {
  const a = points[index];
  const b = points[(index + 1) % points.length];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function edgeLength(points: Point[], index: number): number {
  const a = points[index];
  const b = points[(index + 1) % points.length];
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function inferredEdges(points: Point[]): { front: number[]; back: number[] } {
  if (points.length < 2) return { front: [], back: [] };
  const indexes = points.map((_, index) => index);
  const back = indexes.reduce((best, index) => edgeLength(points, index) > edgeLength(points, best) ? index : best, 0);
  const backMidpoint = edgeMidpoint(points, back);
  const candidates = indexes.filter(index => index !== back);
  const front = candidates.reduce((best, index) => {
    const midpoint = edgeMidpoint(points, index);
    const bestMidpoint = edgeMidpoint(points, best);
    return Math.hypot(midpoint.x - backMidpoint.x, midpoint.y - backMidpoint.y)
      > Math.hypot(bestMidpoint.x - backMidpoint.x, bestMidpoint.y - backMidpoint.y)
      ? index
      : best;
  }, candidates[0] ?? back);
  return { front: [front], back: [back] };
}

function patchMissingRecipeEdges(): void {
  try {
    const raw = localStorage.getItem(CURRENT_PLAN_KEY);
    if (!raw) return;
    const plan = JSON.parse(raw) as StoredPlan;
    let changed = false;
    const zones = (plan.zones || []).map(zone => {
      const points = zone.points || [];
      if (points.length < 3) return zone;
      const currentFront = zone.edgeRoles?.front || [];
      const currentBack = zone.edgeRoles?.back || [];
      if (currentFront.length && currentBack.length) return zone;
      const inferred = inferredEdges(points);
      changed = true;
      return {
        ...zone,
        edgeRoles: {
          front: currentFront.length ? currentFront : inferred.front,
          back: currentBack.length ? currentBack : inferred.back,
        },
      };
    });
    if (changed) localStorage.setItem(CURRENT_PLAN_KEY, JSON.stringify({ ...plan, zones }));
  } catch (error) {
    console.warn('Could not infer recipe front/back edges', error);
  }
}

export function installRecipeEdgeFallback(): () => void {
  const handleClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    const label = button?.textContent?.trim().toLowerCase();
    if (label === 'generate' || label === 'new seed + generate') patchMissingRecipeEdges();
  };
  document.addEventListener('click', handleClick, true);
  return () => document.removeEventListener('click', handleClick, true);
}
