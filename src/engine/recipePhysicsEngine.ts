import Matter from 'matter-js';

export type PhysicsPoint = { x: number; y: number };
export type RecipePhysicsLayer = 'front' | 'middle' | 'back' | 'accent';

export interface RecipePhysicsPlant {
  key: string;
  plantId: number;
  radius: number;
  layer: RecipePhysicsLayer;
  weight: number;
  clump?: number;
}

export interface RecipePhysicsOptions {
  polygon: PhysicsPoint[];
  plants: RecipePhysicsPlant[];
  seed: number;
  density?: number;
  frontEdges?: number[];
  backEdges?: number[];
  iterations?: number;
  padding?: number;
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
    const a = polygon[i];
    const b = polygon[j];
    const intersects = a.y > point.y !== b.y > point.y
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point: PhysicsPoint, a: PhysicsPoint, b: PhysicsPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

function distanceToPolygonEdge(point: PhysicsPoint, polygon: PhysicsPoint[]): number {
  return Math.min(...polygon.map((a, index) => distanceToSegment(point, a, polygon[(index + 1) % polygon.length])));
}

function distanceToMarkedEdges(point: PhysicsPoint, polygon: PhysicsPoint[], indexes: number[] | undefined): number {
  if (!indexes?.length) return Number.POSITIVE_INFINITY;
  return Math.min(...indexes.map(index => distanceToSegment(point, polygon[index], polygon[(index + 1) % polygon.length])));
}

function boundsOf(polygon: PhysicsPoint[]) {
  return {
    minX: Math.min(...polygon.map(point => point.x)),
    maxX: Math.max(...polygon.map(point => point.x)),
    minY: Math.min(...polygon.map(point => point.y)),
    maxY: Math.max(...polygon.map(point => point.y)),
  };
}

function targetForLayer(
  layer: RecipePhysicsLayer,
  polygon: PhysicsPoint[],
  random: () => number,
  frontEdges?: number[],
  backEdges?: number[],
): PhysicsPoint {
  const bounds = boundsOf(polygon);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const candidate = {
      x: bounds.minX + random() * width,
      y: bounds.minY + random() * height,
    };
    if (!pointInPolygon(candidate, polygon)) continue;

    const frontDistance = distanceToMarkedEdges(candidate, polygon, frontEdges);
    const backDistance = distanceToMarkedEdges(candidate, polygon, backEdges);
    const fallbackFront = bounds.maxY - candidate.y;
    const fallbackBack = candidate.y - bounds.minY;

    const layerDistance = layer === 'front'
      ? (Number.isFinite(frontDistance) ? frontDistance : fallbackFront)
      : layer === 'back'
        ? (Number.isFinite(backDistance) ? backDistance : fallbackBack)
        : layer === 'middle'
          ? (Number.isFinite(frontDistance) && Number.isFinite(backDistance)
            ? Math.abs(frontDistance - backDistance)
            : Math.abs(candidate.y - (bounds.minY + height / 2)))
          : 0;

    const threshold = layer === 'accent' ? Math.max(width, height) : Math.max(width, height) * 0.28;
    if (layerDistance <= threshold * (0.25 + random() * 0.75)) return candidate;
  }

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

function expandWeightedPlants(plants: RecipePhysicsPlant[], density: number): RecipePhysicsPlant[] {
  const totalWeight = plants.reduce((sum, plant) => sum + Math.max(0, plant.weight), 0) || 1;
  const targetCount = Math.max(plants.length, Math.round(10 + density * 30));
  const expanded: RecipePhysicsPlant[] = [];

  plants.forEach(plant => {
    const count = Math.max(1, Math.round((plant.weight / totalWeight) * targetCount));
    for (let index = 0; index < count; index += 1) expanded.push(plant);
  });

  return expanded;
}

export function runRecipePhysics(options: RecipePhysicsOptions): RecipePhysicsResult {
  if (options.polygon.length < 3) {
    throw new Error('Recipe physics requires a polygon with at least three points.');
  }
  if (!options.plants.length) {
    return { placements: [], diagnostics: { requested: 0, placed: 0, rejected: 0, unresolvedOverlaps: 0, seed: options.seed } };
  }

  const random = seededRandom(options.seed);
  const density = Math.max(0.05, Math.min(1, options.density ?? 0.5));
  const padding = Math.max(0, options.padding ?? 2);
  const iterations = Math.max(30, options.iterations ?? 180);
  const expanded = expandWeightedPlants(options.plants, density);
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
  engine.positionIterations = 12;
  engine.velocityIterations = 10;
  engine.constraintIterations = 4;

  const bodies: Matter.Body[] = [];
  const metadata = new Map<number, { plant: RecipePhysicsPlant; target: PhysicsPoint; rotationDeg: number }>();
  let rejected = 0;

  expanded.forEach((plant, index) => {
    const radius = Math.max(3, plant.radius);
    let start: PhysicsPoint | null = null;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const target = targetForLayer(plant.layer, options.polygon, random, options.frontEdges, options.backEdges);
      const jitter = Math.max(2, radius * (plant.clump ?? 1.2));
      const candidate = {
        x: target.x + (random() - 0.5) * jitter,
        y: target.y + (random() - 0.5) * jitter,
      };
      if (pointInPolygon(candidate, options.polygon) && distanceToPolygonEdge(candidate, options.polygon) >= radius + padding) {
        start = candidate;
        break;
      }
    }
    if (!start) {
      rejected += 1;
      return;
    }

    const body = Matter.Bodies.circle(start.x, start.y, radius, {
      restitution: 0.05,
      friction: 0.05,
      frictionAir: 0.18,
      density: 0.002,
      label: `recipe:${plant.key}:${index}`,
    });
    bodies.push(body);
    metadata.set(body.id, {
      plant,
      target: targetForLayer(plant.layer, options.polygon, random, options.frontEdges, options.backEdges),
      rotationDeg: Math.round(random() * 359),
    });
  });

  Matter.Composite.add(engine.world, bodies);

  for (let step = 0; step < iterations; step += 1) {
    bodies.forEach(body => {
      const info = metadata.get(body.id);
      if (!info) return;

      const toTarget = {
        x: (info.target.x - body.position.x) * 0.00055,
        y: (info.target.y - body.position.y) * 0.00055,
      };
      Matter.Body.applyForce(body, body.position, toTarget);

      if (!pointInPolygon(body.position, options.polygon) || distanceToPolygonEdge(body.position, options.polygon) < info.plant.radius + padding) {
        const bounds = boundsOf(options.polygon);
        const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
        Matter.Body.applyForce(body, body.position, {
          x: (center.x - body.position.x) * 0.0025,
          y: (center.y - body.position.y) * 0.0025,
        });
      }
    });
    Matter.Engine.update(engine, 1000 / 60);
  }

  const validBodies = bodies.filter(body => {
    const info = metadata.get(body.id);
    return !!info
      && pointInPolygon(body.position, options.polygon)
      && distanceToPolygonEdge(body.position, options.polygon) >= info.plant.radius * 0.9;
  });

  let unresolvedOverlaps = 0;
  for (let i = 0; i < validBodies.length; i += 1) {
    const aInfo = metadata.get(validBodies[i].id)!;
    for (let j = i + 1; j < validBodies.length; j += 1) {
      const bInfo = metadata.get(validBodies[j].id)!;
      const actual = Matter.Vector.magnitude(Matter.Vector.sub(validBodies[i].position, validBodies[j].position));
      if (actual < (aInfo.plant.radius + bInfo.plant.radius) * 0.92) unresolvedOverlaps += 1;
    }
  }

  const placements = validBodies.map(body => {
    const info = metadata.get(body.id)!;
    return {
      key: info.plant.key,
      plantId: info.plant.plantId,
      layer: info.plant.layer,
      x: body.position.x,
      y: body.position.y,
      radius: info.plant.radius,
      rotationDeg: info.rotationDeg,
    } satisfies RecipePhysicsPlacement;
  });

  Matter.Engine.clear(engine);

  return {
    placements,
    diagnostics: {
      requested: expanded.length,
      placed: placements.length,
      rejected: rejected + (bodies.length - validBodies.length),
      unresolvedOverlaps,
      seed: options.seed,
    },
  };
}
