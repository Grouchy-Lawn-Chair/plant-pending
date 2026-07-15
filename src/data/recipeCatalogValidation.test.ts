import { describe, expect, it } from 'vitest';
import { plantRecipes } from './plantRecipes';
import {
  EXPECTED_GARDENIA_RECIPE_COUNT,
  EXPECTED_MONROVIA_RECIPE_COUNT,
  EXPECTED_RECIPE_COUNT,
  recipeSourceManifest,
} from './recipeSourceManifest';

const validLayers = new Set(['front', 'middle', 'back', 'accent']);

describe('recipe catalog contract', () => {
  it('defines the complete expected source manifest', () => {
    const monrovia = recipeSourceManifest.filter(recipe => recipe.sourceType === 'monrovia');
    const gardenia = recipeSourceManifest.filter(recipe => recipe.sourceType === 'gardenia');

    expect(recipeSourceManifest).toHaveLength(EXPECTED_RECIPE_COUNT);
    expect(monrovia).toHaveLength(EXPECTED_MONROVIA_RECIPE_COUNT);
    expect(gardenia).toHaveLength(EXPECTED_GARDENIA_RECIPE_COUNT);
    expect(new Set(recipeSourceManifest.map(recipe => recipe.id)).size).toBe(EXPECTED_RECIPE_COUNT);
  });

  it('contains one production recipe for every expected source entry', () => {
    const expected = new Set(recipeSourceManifest.map(recipe => recipe.id));
    const actual = new Set(plantRecipes.map(recipe => recipe.id));

    expect([...actual].filter(id => !expected.has(id))).toEqual([]);
    expect([...expected].filter(id => !actual.has(id))).toEqual([]);
    expect(plantRecipes).toHaveLength(EXPECTED_RECIPE_COUNT);
  });

  it('keeps production recipe rows final-plant only and generation ready', () => {
    const ids = new Set<string>();

    plantRecipes.forEach(recipe => {
      expect(ids.has(recipe.id)).toBe(false);
      ids.add(recipe.id);
      expect(recipe.plants.length).toBeGreaterThan(0);

      recipe.plants.forEach(plant => {
        expect(Number.isFinite(Number(plant.greenAcresPlantId))).toBe(true);
        expect(Number(plant.greenAcresPlantId)).toBeGreaterThan(0);
        expect(plant.greenAcresName.trim().length).toBeGreaterThan(0);
        expect(plant.matureWidthInches).toBeGreaterThan(0);
        expect(plant.coveragePercent).toBeGreaterThan(0);
        expect(validLayers.has(plant.layer)).toBe(true);
      });
    });
  });
});
