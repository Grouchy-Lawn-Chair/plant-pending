import { describe, expect, it } from 'vitest';
import { pointInPolygon, runRecipePhysics } from './recipePhysicsEngine';

const rectangle = [
  { x: 0, y: 0 },
  { x: 600, y: 0 },
  { x: 600, y: 360 },
  { x: 0, y: 360 },
];

const plants = [
  { key: 'back', plantId: 1, radius: 22, layer: 'back' as const, weight: 25, spacing: 'natural' as const, grouping: 'individual' as const },
  { key: 'middle', plantId: 2, radius: 17, layer: 'middle' as const, weight: 35, spacing: 'natural' as const, grouping: 'medium-drift' as const },
  { key: 'front', plantId: 3, radius: 12, layer: 'front' as const, weight: 30, spacing: 'tight' as const, grouping: 'large-drift' as const },
  { key: 'accent', plantId: 4, radius: 20, layer: 'accent' as const, weight: 10, spacing: 'loose' as const, grouping: 'individual' as const },
];

const countsByPlant = (result: ReturnType<typeof runRecipePhysics>) =>
  result.placements.reduce<Record<number, number>>((counts, item) => {
    counts[item.plantId] = (counts[item.plantId] || 0) + 1;
    return counts;
  }, {});

describe('recipe physics engine', () => {
  it('is deterministic for the same seed', () => {
    const first = runRecipePhysics({ polygon: rectangle, plants, seed: 42, density: 0.45 });
    const second = runRecipePhysics({ polygon: rectangle, plants, seed: 42, density: 0.45 });
    expect(second.placements).toEqual(first.placements);
    expect(second.diagnostics.cycles).toEqual(first.diagnostics.cycles);
  });

  it('changes arrangement but preserves species counts for a different seed', () => {
    const first = runRecipePhysics({ polygon: rectangle, plants, seed: 42, density: 0.7 });
    const second = runRecipePhysics({ polygon: rectangle, plants, seed: 99, density: 0.7 });
    expect(second.placements.map(item => [item.x, item.y])).not.toEqual(first.placements.map(item => [item.x, item.y]));
    expect(countsByPlant(second)).toEqual(countsByPlant(first));
  });

  it('keeps every accepted plant center inside the polygon', () => {
    const result = runRecipePhysics({ polygon: rectangle, plants, seed: 7, density: 0.6 });
    expect(result.placements.length).toBeGreaterThan(0);
    result.placements.forEach(item => expect(pointInPolygon(item, rectangle)).toBe(true));
  });

  it('uses fill-settle-prune-refill cycles to approach dense coverage', () => {
    const result = runRecipePhysics({ polygon: rectangle, plants, seed: 55, density: 1, iterations: 300, passes: 2 });
    expect(result.diagnostics.targetCoverage).toBe(90);
    expect(result.diagnostics.cycles.length).toBeGreaterThan(0);
    expect(result.diagnostics.estimatedCoverage).toBeGreaterThanOrEqual(75);
    expect(result.diagnostics.cycles.at(-1)?.coverage).toBe(result.diagnostics.estimatedCoverage);
  });

  it('creates deterministic drift centers and seeded group gaps', () => {
    const first = runRecipePhysics({ polygon: rectangle, plants, seed: 314, density: 0.65 });
    const second = runRecipePhysics({ polygon: rectangle, plants, seed: 314, density: 0.65 });
    const third = runRecipePhysics({ polygon: rectangle, plants, seed: 315, density: 0.65 });
    expect(first.diagnostics.driftCenters).toEqual(second.diagnostics.driftCenters);
    expect(first.diagnostics.driftCenters).not.toEqual(third.diagnostics.driftCenters);
    expect(first.diagnostics.driftCenters.some(item => item.grouping === 'medium-drift')).toBe(true);
  });

  it('keeps back plants closer to the marked back edge than front plants', () => {
    const result = runRecipePhysics({ polygon: rectangle, plants, seed: 23, density: 0.55, backEdges: [0], frontEdges: [2] });
    const back = result.placements.filter(item => item.layer === 'back');
    const front = result.placements.filter(item => item.layer === 'front');
    const averageY = (items: typeof result.placements) => items.reduce((sum, item) => sum + item.y, 0) / Math.max(1, items.length);
    expect(averageY(back)).toBeLessThan(averageY(front));
  });
});
