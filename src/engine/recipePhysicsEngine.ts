import Matter from 'matter-js';
import { getRecipePhysicsProfile } from '../data/recipePhysicsProfiles';

export type PhysicsPoint = { x: number; y: number };
export type RecipePhysicsLayer = 'front' | 'middle' | 'back' | 'accent';
export type RecipeLayoutBehavior = 'natural' | 'clumps' | 'even' | 'stacked' | 'spread';
export type RecipePlacementMode = 'scatter' | 'stack' | 'front-fill' | 'back-attract';
export type RecipeDropOrder = 'random' | 'grouped';
export type OpenSpaceFill = 'off' | 'light' | 'medium' | 'strong';
export type PlantSpacing = 'tight' | 'natural' | 'loose';
export type PlantGrouping = 'individual' | 'small-drift' | 'medium-drift' | 'large-drift' | 'continuous-mass';
export type GroupGap = 'small' | 'medium' | 'large';

export interface RecipePhysicsPlant {
  key: string;
  plantId: number;
  radius: number;
  layer: RecipePhysicsLayer;
  weight: number;
  clump?: number;
  count?: number;
  enabled?: boolean;
  frontAttraction?: number;
  backAttraction?: number;
  edgeAttraction?: number;
  repetition?: string;
  mode?: RecipePlacementMode;
  spacing?: PlantSpacing;
  grouping?: PlantGrouping;
  groupGap?: GroupGap;
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
  dropOrder?: RecipeDropOrder;
  physicsScale?: number;
  spacingPad?: number;
  openSpaceFill?: OpenSpaceFill;
}

export interface RecipePhysicsPlacement {
  key: string;
  plantId: number;
  layer: RecipePhysicsLayer;
  x: number;
  y: number;
  radius: number;
  rotationDeg: number;
  driftId?: string;
}

export interface RecipePhysicsCycle {
  cycle: number;
  requested: number;
  placed: number;
  coverage: number;
  pruned: number;
  refilled: number;
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
    targetCoverage: number;
    cycles: RecipePhysicsCycle[];
    driftCenters: Array<{ id: string; plantId: number; x: number; y: number; grouping: PlantGrouping; gapDiameters: number }>;
  };
}

type ExpandedPlant = RecipePhysicsPlant & { ordinal: number; driftId?: string; driftCenter?: PhysicsPoint };
type RecordBody = { body: Matter.Body; plant: ExpandedPlant; target: PhysicsPoint; rotationDeg: number };

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
function rng(seed: number) { let value = seed >>> 0; return () => { value += 0x6d2b79f5; let t = value; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle<T>(items: T[], random: () => number) { const out = [...items]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }
export function pointInPolygon(point: PhysicsPoint, polygon: PhysicsPoint[]) { let hit = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x) hit = !hit; } return hit; }
function area(polygon: PhysicsPoint[]) { let value = 0; for (let i = 0; i < polygon.length; i++) { const a = polygon[i], b = polygon[(i + 1) % polygon.length]; value += a.x * b.y - b.x * a.y; } return Math.abs(value / 2); }
function centroid(polygon: PhysicsPoint[]) { return polygon.reduce((sum, point) => ({ x: sum.x + point.x / polygon.length, y: sum.y + point.y / polygon.length }), { x: 0, y: 0 }); }
function nearestPoint(point: PhysicsPoint, a: PhysicsPoint, b: PhysicsPoint) { const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy || 1, t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / length); return { x: a.x + t * dx, y: a.y + t * dy }; }
function distanceToSegment(point: PhysicsPoint, a: PhysicsPoint, b: PhysicsPoint) { const nearest = nearestPoint(point, a, b); return Math.hypot(point.x - nearest.x, point.y - nearest.y); }
function edgeDistance(point: PhysicsPoint, polygon: PhysicsPoint[]) { return Math.min(...polygon.map((a, index) => distanceToSegment(point, a, polygon[(index + 1) % polygon.length]))); }
function inward(polygon: PhysicsPoint[], index: number) { const a = polygon[index], b = polygon[(index + 1) % polygon.length], midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, center = centroid(polygon), dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1, first = { x: -dy / length, y: dx / length }, second = { x: dy / length, y: -dx / length }, towardCenter = { x: center.x - midpoint.x, y: center.y - midpoint.y }; return first.x * towardCenter.x + first.y * towardCenter.y > 0 ? first : second; }
function pointAcross(polygon: PhysicsPoint[], indexes: number[], t: number, offset: number) { const usable = indexes.length ? indexes : [0]; const segments = usable.map(index => ({ index, a: polygon[index], b: polygon[(index + 1) % polygon.length] })); const lengths = segments.map(segment => Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y)); const total = lengths.reduce((sum, value) => sum + value, 0) || 1; let remaining = clamp(t) * total, segment = segments[segments.length - 1], u = 1; for (let i = 0; i < segments.length; i++) { if (remaining <= lengths[i]) { segment = segments[i]; u = lengths[i] ? remaining / lengths[i] : 0; break; } remaining -= lengths[i]; } const normal = inward(polygon, segment.index); return { x: segment.a.x + (segment.b.x - segment.a.x) * u + normal.x * offset, y: segment.a.y + (segment.b.y - segment.a.y) * u + normal.y * offset }; }
function bounds(polygon: PhysicsPoint[]) { const xs = polygon.map(point => point.x), ys = polygon.map(point => point.y); return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; }
function randomInside(polygon: PhysicsPoint[], random: () => number, minimumEdge = 0, tries = 2400) { const box = bounds(polygon), center = centroid(polygon); for (let i = 0; i < tries; i++) { const point = { x: box.minX + random() * (box.maxX - box.minX), y: box.minY + random() * (box.maxY - box.minY) }; if (pointInPolygon(point, polygon) && edgeDistance(point, polygon) >= minimumEdge) return point; } return pointInPolygon(center, polygon) ? center : polygon[0]; }
function resolvedPlant(plant: RecipePhysicsPlant): RecipePhysicsPlant { const profile = getRecipePhysicsProfile(plant.key); const repetition = profile?.repetition ?? plant.repetition ?? ''; const grouping = plant.grouping ?? (/hedge|row/.test(repetition) ? 'individual' : /matrix|mass/.test(repetition) ? 'continuous-mass' : (plant.clump ?? profile?.clumpStrength ?? 0) >= .82 ? 'large-drift' : (plant.clump ?? profile?.clumpStrength ?? 0) >= .65 ? 'medium-drift' : 'individual'); return { ...plant, layer: profile?.role ?? plant.layer, clump: plant.clump ?? profile?.clumpStrength, frontAttraction: plant.frontAttraction ?? profile?.frontAttraction, backAttraction: plant.backAttraction ?? profile?.backAttraction, edgeAttraction: plant.edgeAttraction ?? profile?.edgeAttraction, repetition, spacing: plant.spacing ?? 'natural', grouping, groupGap: plant.groupGap ?? 'medium' }; }
function modeFor(plant: RecipePhysicsPlant): RecipePlacementMode { if (plant.mode) return plant.mode; const repetition = plant.repetition || ''; if (plant.layer === 'back' || /hedge|row/.test(repetition)) return 'back-attract'; if (plant.layer === 'front' || /ribbon|edge/.test(repetition)) return 'front-fill'; if (/matrix|stack/.test(repetition)) return 'stack'; return 'scatter'; }
function spacingMultiplier(plant: RecipePhysicsPlant) { return plant.spacing === 'tight' ? 1 : plant.spacing === 'loose' ? 1.22 : 1.06; }
function groupSize(grouping: PlantGrouping, random: () => number) { if (grouping === 'individual') return 1; if (grouping === 'small-drift') return 3 + Math.floor(random() * 3); if (grouping === 'medium-drift') return 6 + Math.floor(random() * 5); if (grouping === 'large-drift') return 11 + Math.floor(random() * 8); return 9999; }
function groupGapDiameters(gap: GroupGap, random: () => number) { const range = gap === 'small' ? [.25, .75] : gap === 'large' ? [1.5, 2.5] : [.75, 1.5]; return range[0] + random() * (range[1] - range[0]); }
function counts(plants: RecipePhysicsPlant[], total: number) { const sum = plants.reduce((value, plant) => value + Math.max(0, plant.weight), 0) || 1; const raw = plants.map(plant => total * Math.max(0, plant.weight) / sum), base = raw.map(Math.floor); let left = total - base.reduce((a, b) => a + b, 0); const order = raw.map((value, index) => ({ index, remainder: value - Math.floor(value) })).sort((a, b) => b.remainder - a.remainder || a.index - b.index); for (let i = 0; i < left; i++) base[order[i % order.length].index]++; return base; }
function targetCoverage(density: number) { return Math.round((.18 + clamp(density, .05, 1) * .72) * 100); }
function estimateCount(options: RecipePhysicsOptions, plants: RecipePhysicsPlant[]) { if (typeof options.targetCount === 'number') return Math.max(0, Math.round(options.targetCount)); if (plants.some(plant => typeof plant.count === 'number')) return plants.reduce((sum, plant) => sum + Math.max(0, Math.round(plant.count ?? 0)), 0); const weights = plants.reduce((sum, plant) => sum + Math.max(0, plant.weight), 0) || 1; const weightedVisibleArea = plants.reduce((sum, plant) => sum + Math.PI * plant.radius * plant.radius * (Math.max(0, plant.weight) / weights), 0) || 1; return Math.max(plants.length, Math.ceil(area(options.polygon) * (targetCoverage(options.density ?? .5) / 100) / weightedVisibleArea)); }
function buildDrifts(plants: RecipePhysicsPlant[], plantCounts: number[], polygon: PhysicsPoint[], random: () => number) { const centers: RecipePhysicsResult['diagnostics']['driftCenters'] = [], expanded: ExpandedPlant[] = [], allCenters: Array<{ point: PhysicsPoint; radius: number }> = []; plants.forEach((plant, plantIndex) => { const count = plantCounts[plantIndex], grouping = plant.grouping ?? 'individual', size = groupSize(grouping, random), driftCount = grouping === 'continuous-mass' ? 1 : Math.max(1, Math.ceil(count / size)), localCenters: PhysicsPoint[] = []; for (let drift = 0; drift < driftCount; drift++) { let center: PhysicsPoint | null = null; const gap = groupGapDiameters(plant.groupGap ?? 'medium', random); for (let tries = 0; tries < 900; tries++) { const candidate = randomInside(polygon, random, plant.radius + 2); const ownSpeciesOk = localCenters.every(existing => Math.hypot(candidate.x - existing.x, candidate.y - existing.y) >= plant.radius * 2 * gap); const globalGap = .42 + gap * .32; const allSpeciesOk = allCenters.every(existing => Math.hypot(candidate.x - existing.point.x, candidate.y - existing.point.y) >= (plant.radius + existing.radius) * globalGap); if (ownSpeciesOk && allSpeciesOk) { center = candidate; break; } } center = center ?? randomInside(polygon, random, plant.radius + 2); localCenters.push(center); allCenters.push({ point: center, radius: plant.radius }); centers.push({ id: `${plant.key}:drift:${drift}`, plantId: plant.plantId, x: center.x, y: center.y, grouping, gapDiameters: gap }); } for (let i = 0; i < count; i++) { const driftIndex = grouping === 'continuous-mass' ? 0 : Math.min(localCenters.length - 1, Math.floor(i / size)); expanded.push({ ...plant, ordinal: i, driftId: `${plant.key}:drift:${driftIndex}`, driftCenter: localCenters[driftIndex] }); } }); return { expanded, centers }; }
function targetFor(plant: ExpandedPlant, totalForPlant: number, polygon: PhysicsPoint[], front: number[], back: number[], random: () => number) { const mode = modeFor(plant), radius = plant.radius, t = (plant.ordinal + .5) / Math.max(1, totalForPlant); if (mode === 'back-attract') return pointAcross(polygon, back, clamp(t + (random() - .5) * .018), radius + 4); if (mode === 'front-fill') { const depth = plant.ordinal % 3; return pointAcross(polygon, front, clamp(t + (random() - .5) * .035), radius + 4 + depth * radius * .95); } if (plant.driftCenter) { const tightness = .25 + (1 - (plant.clump ?? .5)) * .85; return { x: plant.driftCenter.x + (random() - .5) * radius * 2 * tightness, y: plant.driftCenter.y + (random() - .5) * radius * 2 * tightness }; } return randomInside(polygon, random, radius + 3); }
function wall(engine: Matter.Engine, a: PhysicsPoint, b: PhysicsPoint) { const dx = b.x - a.x, dy = b.y - a.y; Matter.Composite.add(engine.world, Matter.Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(dx, dy), 8, { isStatic: true, angle: Math.atan2(dy, dx), friction: .35, restitution: 0, label: 'zone-wall' })); }
function nearestValidPoint(wanted: PhysicsPoint, polygon: PhysicsPoint[], minimumEdge: number, random: () => number) { if (pointInPolygon(wanted, polygon) && edgeDistance(wanted, polygon) >= minimumEdge) return wanted; let best: PhysicsPoint | null = null, bestScore = Infinity; const box = bounds(polygon); for (let i = 0; i < 2200; i++) { const point = { x: box.minX + random() * (box.maxX - box.minX), y: box.minY + random() * (box.maxY - box.minY) }; if (!pointInPolygon(point, polygon) || edgeDistance(point, polygon) < minimumEdge) continue; const score = Math.hypot(point.x - wanted.x, point.y - wanted.y); if (score < bestScore) { best = point; bestScore = score; } } return best ?? randomInside(polygon, random, minimumEdge); }
function settle(polygon: PhysicsPoint[], records: RecordBody[], options: RecipePhysicsOptions, random: () => number) { const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } }); polygon.forEach((a, index) => wall(engine, a, polygon[(index + 1) % polygon.length])); records.forEach(record => Matter.Composite.add(engine.world, record.body)); const attraction = Math.max(.1, options.attractionStrength ?? 1), steps = Math.max(220, options.iterations ?? 900); for (let step = 0; step < steps; step++) { records.forEach(record => { const mode = modeFor(record.plant), dx = record.target.x - record.body.position.x, dy = record.target.y - record.body.position.y, distance = Math.hypot(dx, dy) || 1, profile = mode === 'back-attract' ? (record.plant.backAttraction ?? 2.4) : mode === 'front-fill' ? (record.plant.frontAttraction ?? 1.8) : 1, base = mode === 'back-attract' ? .0065 : mode === 'front-fill' ? .0046 : record.plant.driftCenter ? .0012 : .00035; Matter.Body.applyForce(record.body, record.body.position, { x: dx / distance * record.body.mass * base * attraction * profile, y: dy / distance * record.body.mass * base * attraction * profile }); }); Matter.Engine.update(engine, 1000 / 120); } for (let i = 0; i < 120; i++) Matter.Engine.update(engine, 1000 / 120); records.forEach(record => { const minimum = (record.body.circleRadius || 0) + 1; if (!pointInPolygon(record.body.position, polygon) || edgeDistance(record.body.position, polygon) < minimum) Matter.Body.setPosition(record.body, nearestValidPoint(record.target, polygon, minimum, random)); }); Matter.Engine.clear(engine); }
function coverage(placements: RecipePhysicsPlacement[], polygon: PhysicsPoint[]) { return Math.min(100, Math.round(placements.reduce((sum, placement) => sum + Math.PI * placement.radius * placement.radius, 0) / Math.max(1, area(polygon)) * 100)); }
function pruneOverlaps(records: RecordBody[]) { const accepted: RecordBody[] = []; let pruned = 0; for (const record of records) { const overlaps = accepted.some(existing => Math.hypot(record.body.position.x - existing.body.position.x, record.body.position.y - existing.body.position.y) < record.plant.radius + existing.plant.radius - .01); if (overlaps) pruned++; else accepted.push(record); } return { accepted, pruned }; }

function runPass(options: RecipePhysicsOptions, seed: number): RecipePhysicsResult {
  const random = rng(seed);
  const plants = options.plants.filter(plant => plant.enabled !== false).map(resolvedPlant);
  const desired = estimateCount(options, plants);
  const explicit = plants.some(plant => typeof plant.count === 'number');
  const baseCounts = explicit ? plants.map(plant => Math.max(0, Math.round(plant.count ?? 0))) : counts(plants, desired);
  const target = targetCoverage(options.density ?? .5);
  const scale = clamp(options.physicsScale ?? 1, 1, 1.2);
  const pad = Math.max(0, options.spacingPad ?? options.padding ?? 0);
  const front = options.frontEdges || [];
  const back = options.backEdges || [];
  const cycles: RecipePhysicsCycle[] = [];
  let plantCounts = [...baseCounts];
  let records: RecordBody[] = [];
  let driftCenters: RecipePhysicsResult['diagnostics']['driftCenters'] = [];
  let previousCoverage = -1;
  let totalPruned = 0;

  for (let cycle = 0; cycle < 8; cycle++) {
    const built = buildDrifts(plants, plantCounts, options.polygon, random);
    driftCenters = built.centers;
    const expanded = options.dropOrder === 'grouped' ? built.expanded : shuffle(built.expanded, random);
    const totals = new Map<number, number>();
    expanded.forEach(plant => totals.set(plant.plantId, (totals.get(plant.plantId) || 0) + 1));
    records = expanded.map((plant, index) => {
      const collisionRadius = Math.max(3, plant.radius * scale * spacingMultiplier(plant) + pad);
      const target = targetFor({ ...plant, radius: collisionRadius }, totals.get(plant.plantId) || 1, options.polygon, front, back, random);
      const start = nearestValidPoint({ x: target.x + (random() - .5) * collisionRadius * .25, y: target.y + (random() - .5) * collisionRadius * .25 }, options.polygon, collisionRadius + 1, random);
      const body = Matter.Bodies.circle(start.x, start.y, collisionRadius, { friction: .03, frictionAir: .16, restitution: .01, density: .002, label: `recipe:${plant.key}:${index}` });
      return { body, plant, target, rotationDeg: Math.round(random() * 359) };
    });

    settle(options.polygon, records, options, random);
    const boundaryValid = records.filter(record => pointInPolygon(record.body.position, options.polygon) && edgeDistance(record.body.position, options.polygon) >= record.plant.radius);
    const boundaryPruned = records.length - boundaryValid.length;
    const overlapResult = pruneOverlaps(boundaryValid);
    records = overlapResult.accepted;
    const pruned = boundaryPruned + overlapResult.pruned;
    totalPruned = pruned;
    const placements = records.map(record => ({ key: record.plant.key, plantId: record.plant.plantId, layer: record.plant.layer, x: record.body.position.x, y: record.body.position.y, radius: record.plant.radius, rotationDeg: record.rotationDeg, driftId: record.plant.driftId }));
    const currentCoverage = coverage(placements, options.polygon);
    const needed = currentCoverage >= target ? 0 : Math.max(1, Math.ceil((target - currentCoverage) / Math.max(1, currentCoverage) * Math.max(1, records.length) * .7));
    cycles.push({ cycle: cycle + 1, requested: plantCounts.reduce((a, b) => a + b, 0), placed: records.length, coverage: currentCoverage, pruned, refilled: needed });

    if (currentCoverage >= target || currentCoverage === previousCoverage || cycle === 7) {
      const weightTotal = plants.reduce((sum, plant) => sum + plant.weight, 0) || 1;
      const meanArea = plants.reduce((sum, plant) => sum + Math.PI * plant.radius * plant.radius * (plant.weight / weightTotal), 0) || 1;
      const capacity = Math.max(plants.length, Math.floor(area(options.polygon) * .9 / meanArea));
      return { placements, diagnostics: { requested: plantCounts.reduce((a, b) => a + b, 0), placed: placements.length, rejected: totalPruned, unresolvedOverlaps: 0, seed, capacity, capacityLimited: placements.length < plantCounts.reduce((a, b) => a + b, 0), estimatedCoverage: currentCoverage, passes: 1, targetCoverage: target, cycles, driftCenters } };
    }

    previousCoverage = currentCoverage;
    const extra = counts(plants, needed);
    plantCounts = plantCounts.map((count, index) => count + extra[index]);
  }

  throw new Error('Recipe physics failed to complete.');
}

export function runRecipePhysics(options: RecipePhysicsOptions): RecipePhysicsResult {
  if (options.polygon.length < 3) throw new Error('Recipe physics requires a polygon with at least three points.');
  if (!options.plants.some(plant => plant.enabled !== false)) return { placements: [], diagnostics: { requested: 0, placed: 0, rejected: 0, unresolvedOverlaps: 0, seed: options.seed, capacity: 0, capacityLimited: false, estimatedCoverage: 0, passes: 0, targetCoverage: 0, cycles: [], driftCenters: [] } };
  const passes = Math.max(1, Math.min(8, Math.round(options.passes ?? 1)));
  let best: RecipePhysicsResult | null = null;
  for (let pass = 0; pass < passes; pass++) {
    const result = runPass({ ...options, allowedOverlap: 0 }, options.seed + pass * 7919);
    if (!best || result.diagnostics.estimatedCoverage > best.diagnostics.estimatedCoverage || (result.diagnostics.estimatedCoverage === best.diagnostics.estimatedCoverage && result.diagnostics.placed > best.diagnostics.placed)) best = result;
  }
  best!.diagnostics.seed = options.seed;
  best!.diagnostics.passes = passes;
  best!.diagnostics.unresolvedOverlaps = 0;
  return best!;
}
