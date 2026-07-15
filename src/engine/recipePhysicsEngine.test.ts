import { describe, expect, it } from 'vitest';
import { pointInPolygon, runRecipePhysics } from './recipePhysicsEngine';

const rectangle = [
  { x: 0, y: 0 },
  { x: 600, y: 0 },
  { x: 600, y: 360 },
  { x: 0, y: 360 },
];

const plants = [
  { key: 'back', plantId: 1, radius: 22, layer: 'back' as const, weight: 25 },
  { key: 'middle', plantId: 2, radius: 17, layer: 'middle' as const, weight: 35 },
  { key: 'front', plantId: 3, radius: 12, layer: 'front' as const, weight: 30 },
  { key: 'accent', plantId: 4, radius: 20, layer: 'accent' as const, weight: 10 },
];

const countByPlant = (result: ReturnType<typeof runRecipePhysics>) => new Map(
  plants.map(plant => [plant.plantId, result.placements.filter(item => item.plantId === plant.plantId).length]),
);

const averageDistanceToTop = (items: ReturnType<typeof runRecipePhysics>['placements']) =>
  items.reduce((sum, item) => sum + item.y, 0) / Math.max(1, items.length);

describe('recipe physics engine', () => {
  it('is deterministic for the same seed', () => {
    const first = runRecipePhysics({ polygon: rectangle, plants, seed: 42, density: 0.45 });
    const second = runRecipePhysics({ polygon: rectangle, plants, seed: 42, density: 0.45 });
    expect(second.placements).toEqual(first.placements);
  });

  it('changes the arrangement for a different seed without changing plant counts or sizes', () => {
    const options = { polygon: rectangle, plants, targetCount: 40, density: 0.45, frontEdges: [2], backEdges: [0], passes: 3 };
    const first = runRecipePhysics({ ...options, seed: 42 });
    const second = runRecipePhysics({ ...options, seed: 99 });
    expect(second.placements.map(item => [item.x, item.y])).not.toEqual(first.placements.map(item => [item.x, item.y]));
    expect(second.diagnostics.requested).toBe(40);
    expect(first.diagnostics.requested).toBe(40);
    expect(second.placements).toHaveLength(40);
    expect(first.placements).toHaveLength(40);
    expect(countByPlant(second)).toEqual(countByPlant(first));
    plants.forEach(plant => {
      expect(second.placements.filter(item => item.plantId === plant.plantId).every(item => item.radius === plant.radius)).toBe(true);
    });
  });

  it('does not silently cap an explicit requested count to estimated capacity', () => {
    const result = runRecipePhysics({ polygon: rectangle, plants, seed: 4, targetCount: 60, allowedOverlap: 0.1, passes: 4 });
    expect(result.diagnostics.requested).toBe(60);
    expect(result.placements).toHaveLength(60);
    expect(result.diagnostics.rejected).toBe(0);
  });

  it('keeps every accepted plant center inside the polygon', () => {
    const result = runRecipePhysics({ polygon: rectangle, plants, seed: 7, density: 0.6 });
    expect(result.placements.length).toBeGreaterThan(0);
    result.placements.forEach(item => expect(pointInPolygon(item, rectangle)).toBe(true));
  });

  it('puts back plants in a tight band near the selected back edge', () => {
    const result = runRecipePhysics({ polygon: rectangle, plants, seed: 23, targetCount: 40, backEdges: [0], frontEdges: [2], attractionStrength: 1, iterations: 600, passes: 3 });
    const back = result.placements.filter(item => item.layer === 'back');
    const front = result.placements.filter(item => item.layer === 'front');
    expect(averageDistanceToTop(back)).toBeLessThan(70);
    expect(averageDistanceToTop(back)).toBeLessThan(averageDistanceToTop(front));
  });
});
