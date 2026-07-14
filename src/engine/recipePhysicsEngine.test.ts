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

describe('recipe physics engine', () => {
  it('is deterministic for the same seed', () => {
    const first = runRecipePhysics({ polygon: rectangle, plants, seed: 42, density: 0.45 });
    const second = runRecipePhysics({ polygon: rectangle, plants, seed: 42, density: 0.45 });
    expect(second.placements).toEqual(first.placements);
  });

  it('changes the arrangement for a different seed', () => {
    const first = runRecipePhysics({ polygon: rectangle, plants, seed: 42, density: 0.45 });
    const second = runRecipePhysics({ polygon: rectangle, plants, seed: 99, density: 0.45 });
    expect(second.placements.map(item => [item.x, item.y])).not.toEqual(first.placements.map(item => [item.x, item.y]));
  });

  it('keeps every accepted plant center inside the polygon', () => {
    const result = runRecipePhysics({ polygon: rectangle, plants, seed: 7, density: 0.6 });
    expect(result.placements.length).toBeGreaterThan(0);
    result.placements.forEach(item => expect(pointInPolygon(item, rectangle)).toBe(true));
  });

  it('resolves almost all physical overlaps', () => {
    const result = runRecipePhysics({ polygon: rectangle, plants, seed: 55, density: 0.55, iterations: 240 });
    expect(result.diagnostics.unresolvedOverlaps).toBeLessThanOrEqual(1);
  });

  it('puts back plants above front plants when no edges are marked', () => {
    const result = runRecipePhysics({ polygon: rectangle, plants, seed: 23, density: 0.5 });
    const back = result.placements.filter(item => item.layer === 'back');
    const front = result.placements.filter(item => item.layer === 'front');
    const average = (items: typeof result.placements) => items.reduce((sum, item) => sum + item.y, 0) / Math.max(1, items.length);
    expect(average(back)).toBeLessThan(average(front));
  });
});
