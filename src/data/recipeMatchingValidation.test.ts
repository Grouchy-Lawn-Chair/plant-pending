import { describe, expect, it } from 'vitest';
import { plantRecipes } from './plantRecipes';

describe('reviewed recipe data', () => {
  it('keeps all 41 recipes with unique IDs', () => {
    expect(plantRecipes).toHaveLength(41);
    expect(new Set(plantRecipes.map(recipe => recipe.id)).size).toBe(41);
  });

  it('uses complete final production records', () => {
    plantRecipes.forEach(recipe => {
      expect(recipe.plants.length).toBeGreaterThan(0);
      expect(recipe.plants.reduce((sum, plant) => sum + plant.coveragePercent, 0)).toBe(100);
      expect(new Set(recipe.plants.map(plant => plant.greenAcresPlantId)).size).toBe(recipe.plants.length);
      recipe.plants.forEach(plant => {
        expect(Number(plant.greenAcresPlantId)).toBeGreaterThan(0);
        expect(plant.greenAcresName.trim().length).toBeGreaterThan(0);
        expect(plant.matureWidthInches).toBeGreaterThan(0);
        expect(['front','middle','back','accent']).toContain(plant.layer);
        expect(plant.clump).toBeGreaterThanOrEqual(0);
        expect(plant.clump).toBeLessThanOrEqual(1);
      });
    });
  });

  it('preserves the four-part Elegant Privacy Hedge Border recipe', () => {
    const recipe=plantRecipes.find(item=>item.id==='elegant-privacy-hedge-border');
    expect(recipe?.plants).toHaveLength(4);
    expect(recipe?.plants.some(plant=>plant.greenAcresName.includes('Arborvitae'))).toBe(true);
    expect(recipe?.plants.some(plant=>plant.greenAcresName.includes('Hydrangea'))).toBe(true);
    expect(recipe?.plants.some(plant=>plant.greenAcresName.includes('Rose'))).toBe(true);
    expect(recipe?.plants.some(plant=>plant.greenAcresName.includes('Thrift'))).toBe(true);
  });

  it('preserves the four shade-compatible Shady Corner roles', () => {
    const recipe=plantRecipes.find(item=>item.id==='monrovia-2023-shady-corner');
    expect(recipe?.plants).toHaveLength(4);
    expect(recipe?.plants.map(plant=>plant.greenAcresName)).toEqual(expect.arrayContaining([
      "Japanese Forest Grass 'All Gold'",
      'Gold Dust Plant',
      'Lenten Rose',
      'Japanese Tassel Fern',
    ]));
  });
});
