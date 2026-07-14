import Matter from 'matter-js';

export type PhysicsPoint = { x: number; y: number };
export type RecipePhysicsLayer = 'front' | 'middle' | 'back' | 'accent';
export type RecipeLayoutBehavior = 'natural' | 'clumps' | 'even' | 'stacked' | 'spread';

export interface RecipePhysicsPlant {
  key: string;
  plantId: number;
  radius: number;
  layer: RecipePhysicsLayer;
  weight: number;
  clump?: number;
  count?: number;
  enabled?: boolean;
}

export interface RecipePhysicsOptions {
  polygon: PhysicsPoint[];
  plants: RecipePhysicsPlant[];
  seed: number;
  density?: number;
  targetCount?: number;
  frontEdges?: number[];
  backEdges?: number[];
  iterations?: number;
  passes?: number;
  padding?: number;
  allowedOverlap?: number;
  attractionStrength?: number;
  clumpStrength?: number;
  layoutBehavior?: RecipeLayoutBehavior;
  keepCentersInside?: boolean;
}

export interface RecipePhysicsPlacement {
  key: string;
  plantId: number;
  layer: RecipePhysicsLayer;
  x: number;
  y: number;
  radius: number;
  rotationDeg: number;
}

export interface RecipePhysicsResult {
  placements: RecipePhysicsPlacement[];
  diagnostics: {
    requested: number;
    placed: number;
    rejected: number;
    unresolvedOverlaps: number;
    seed: number;
    capacity: number;
    capacityLimited: boolean;
    estimatedCoverage: number;
    passes: number;
  };
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pointInPolygon(point: PhysicsPoint, polygon: PhysicsPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j];
    const intersects = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonArea(points: PhysicsPoint[]): number {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) area += points[j].x * points[i].y - points[i].x * points[j].y;
  return Math.abs(area / 2);
}

function distanceToSegment(point: PhysicsPoint, a: PhysicsPoint, b: PhysicsPoint): number {
  const dx = b.x - a.x; const dy = b.y - a.y; const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

function distanceToPolygonEdge(point: PhysicsPoint, polygon: PhysicsPoint[]): number {
  return Math.min(...polygon.map((a, index) => distanceToSegment(point, a, polygon[(index + 1) % polygon.length])));
}

function distanceToMarkedEdges(point: PhysicsPoint, polygon: PhysicsPoint[], indexes?: number[]): number {
  if (!indexes?.length) return Number.POSITIVE_INFINITY;
  return Math.min(...indexes.map(index => distanceToSegment(point, polygon[index], polygon[(index + 1) % polygon.length])));
}

function boundsOf(polygon: PhysicsPoint[]) {
  return { minX: Math.min(...polygon.map(p => p.x)), maxX: Math.max(...polygon.map(p => p.x)), minY: Math.min(...polygon.map(p => p.y)), maxY: Math.max(...polygon.map(p => p.y)) };
}

function targetForLayer(layer: RecipePhysicsLayer, polygon: PhysicsPoint[], random: () => number, frontEdges?: number[], backEdges?: number[], layout: RecipeLayoutBehavior = 'natural'): PhysicsPoint {
  const bounds = boundsOf(polygon); const width = Math.max(1, bounds.maxX - bounds.minX); const height = Math.max(1, bounds.maxY - bounds.minY);
  if (layout === 'stacked') {
    const yRatio = layer === 'back' ? .2 : layer === 'middle' ? .5 : layer === 'front' ? .8 : .5;
    return { x: bounds.minX + width * (.15 + random() * .7), y: bounds.minY + height * yRatio };
  }
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const candidate = { x: bounds.minX + random() * width, y: bounds.minY + random() * height };
    if (!pointInPolygon(candidate, polygon)) continue;
    if (layout === 'spread' || layer === 'accent') return candidate;
    const frontDistance = distanceToMarkedEdges(candidate, polygon, frontEdges);
    const backDistance = distanceToMarkedEdges(candidate, polygon, backEdges);
    const fallbackFront = bounds.maxY - candidate.y; const fallbackBack = candidate.y - bounds.minY;
    const layerDistance = layer === 'front' ? (Number.isFinite(frontDistance) ? frontDistance : fallbackFront)
      : layer === 'back' ? (Number.isFinite(backDistance) ? backDistance : fallbackBack)
        : (Number.isFinite(frontDistance) && Number.isFinite(backDistance) ? Math.abs(frontDistance - backDistance) : Math.abs(candidate.y - (bounds.minY + height / 2)));
    if (layerDistance <= Math.max(width, height) * .28 * (.25 + random() * .75)) return candidate;
  }
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

function estimateCapacity(plants: RecipePhysicsPlant[], polygon: PhysicsPoint[]): number {
  const active = plants.filter(p => p.enabled !== false);
  const totalWeight = active.reduce((sum, p) => sum + Math.max(0, p.weight), 0) || 1;
  const weightedArea = active.reduce((sum, p) => sum + Math.PI * Math.max(3, p.radius) ** 2 * (Math.max(0, p.weight) / totalWeight), 0);
  return weightedArea > 0 ? Math.max(active.length, Math.floor((polygonArea(polygon) * .68) / weightedArea)) : active.length;
}

function expandPlants(options: RecipePhysicsOptions) {
  const plants = options.plants.filter(p => p.enabled !== false);
  const totalWeight = plants.reduce((sum, p) => sum + Math.max(0, p.weight), 0) || 1;
  const desired = options.targetCount ?? Math.max(plants.length, Math.round(10 + Math.max(.05, Math.min(1, options.density ?? .5)) * 30));
  const capacity = estimateCapacity(plants, options.polygon); const target = Math.min(desired, capacity); const expanded: RecipePhysicsPlant[] = [];
  const explicit = plants.some(p => typeof p.count === 'number');
  plants.forEach(p => {
    const count = explicit ? Math.max(0, Math.round(p.count ?? 0)) : Math.max(1, Math.round((p.weight / totalWeight) * target));
    for (let i = 0; i < count; i += 1) expanded.push(p);
  });
  while (expanded.length > capacity && expanded.length > plants.length) expanded.pop();
  return { expanded, capacity, capacityLimited: desired > capacity };
}

function runPass(options: RecipePhysicsOptions, seed: number): RecipePhysicsResult {
  const random = seededRandom(seed); const padding = Math.max(0, options.padding ?? 2); const iterations = Math.max(30, options.iterations ?? 180);
  const overlapRatio = Math.max(0, Math.min(.35, options.allowedOverlap ?? .08)); const attraction = Math.max(.1, options.attractionStrength ?? 1);
  const clumpStrength = Math.max(0, options.clumpStrength ?? 1); const layout = options.layoutBehavior ?? 'natural'; const keepInside = options.keepCentersInside !== false;
  const { expanded, capacity, capacityLimited } = expandPlants(options);
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } }); engine.positionIterations = 12; engine.velocityIterations = 10; engine.constraintIterations = 4;
  const bodies: Matter.Body[] = []; const metadata = new Map<number, { plant: RecipePhysicsPlant; target: PhysicsPoint; rotationDeg: number }>(); let rejected = 0;
  expanded.forEach((plant, index) => {
    const effectiveRadius = Math.max(3, plant.radius * (1 - overlapRatio)); let start: PhysicsPoint | null = null;
    const target = targetForLayer(plant.layer, options.polygon, random, options.frontEdges, options.backEdges, layout);
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const baseJitter = layout === 'even' ? effectiveRadius * 4 : layout === 'clumps' ? effectiveRadius * .55 : effectiveRadius * (plant.clump ?? 1.2);
      const jitter = Math.max(2, baseJitter / Math.max(.25, clumpStrength));
      const candidate = { x: target.x + (random() - .5) * jitter, y: target.y + (random() - .5) * jitter };
      if ((!keepInside || pointInPolygon(candidate, options.polygon)) && distanceToPolygonEdge(candidate, options.polygon) >= effectiveRadius + padding) { start = candidate; break; }
    }
    if (!start) { rejected += 1; return; }
    const body = Matter.Bodies.circle(start.x, start.y, effectiveRadius, { restitution: .05, friction: .05, frictionAir: layout === 'even' ? .25 : .18, density: .002, label: `recipe:${plant.key}:${index}` });
    bodies.push(body); metadata.set(body.id, { plant, target, rotationDeg: Math.round(random() * 359) });
  });
  Matter.Composite.add(engine.world, bodies);
  for (let step = 0; step < iterations; step += 1) {
    bodies.forEach(body => {
      const info = metadata.get(body.id); if (!info) return;
      const pull = layout === 'spread' ? .0002 : .00055 * attraction;
      Matter.Body.applyForce(body, body.position, { x: (info.target.x - body.position.x) * pull, y: (info.target.y - body.position.y) * pull });
      if (keepInside && (!pointInPolygon(body.position, options.polygon) || distanceToPolygonEdge(body.position, options.polygon) < body.circleRadius! + padding)) {
        const b = boundsOf(options.polygon); const center = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
        Matter.Body.applyForce(body, body.position, { x: (center.x - body.position.x) * .0025, y: (center.y - body.position.y) * .0025 });
      }
    });
    Matter.Engine.update(engine, 1000 / 60);
  }
  const valid = bodies.filter(body => !keepInside || (pointInPolygon(body.position, options.polygon) && distanceToPolygonEdge(body.position, options.polygon) >= body.circleRadius! * .9));
  let unresolvedOverlaps = 0;
  for (let i = 0; i < valid.length; i += 1) for (let j = i + 1; j < valid.length; j += 1) {
    const actual = Matter.Vector.magnitude(Matter.Vector.sub(valid[i].position, valid[j].position));
    if (actual < (valid[i].circleRadius! + valid[j].circleRadius!) * .92) unresolvedOverlaps += 1;
  }
  const placements = valid.map(body => { const info = metadata.get(body.id)!; return { key: info.plant.key, plantId: info.plant.plantId, layer: info.plant.layer, x: body.position.x, y: body.position.y, radius: info.plant.radius, rotationDeg: info.rotationDeg }; });
  const occupied = placements.reduce((sum, p) => sum + Math.PI * p.radius * p.radius, 0); Matter.Engine.clear(engine);
  return { placements, diagnostics: { requested: expanded.length, placed: placements.length, rejected: rejected + (bodies.length - valid.length), unresolvedOverlaps, seed, capacity, capacityLimited, estimatedCoverage: Math.min(100, Math.round((occupied / Math.max(1, polygonArea(options.polygon))) * 100)), passes: 1 } };
}

export function runRecipePhysics(options: RecipePhysicsOptions): RecipePhysicsResult {
  if (options.polygon.length < 3) throw new Error('Recipe physics requires a polygon with at least three points.');
  if (!options.plants.some(p => p.enabled !== false)) return { placements: [], diagnostics: { requested: 0, placed: 0, rejected: 0, unresolvedOverlaps: 0, seed: options.seed, capacity: 0, capacityLimited: false, estimatedCoverage: 0, passes: 0 } };
  const passes = Math.max(1, Math.min(8, Math.round(options.passes ?? 1))); let best: RecipePhysicsResult | null = null;
  for (let pass = 0; pass < passes; pass += 1) {
    const result = runPass(options, options.seed + pass * 7919);
    if (!best || result.diagnostics.unresolvedOverlaps < best.diagnostics.unresolvedOverlaps || (result.diagnostics.unresolvedOverlaps === best.diagnostics.unresolvedOverlaps && result.diagnostics.placed > best.diagnostics.placed)) best = result;
  }
  best!.diagnostics.seed = options.seed; best!.diagnostics.passes = passes; return best!;
}
