import type { RecipeLayoutBehavior, RecipePhysicsLayer } from '../engine/recipePhysicsEngine';
import { plantRecipes } from './plantRecipes';
import { getRecipeDesignProfile } from './recipeDesignProfiles';

export interface AppRecipePlant {
  plantId: number;
  name: string;
  weight: number;
  layer: RecipePhysicsLayer;
  widthInches: number;
  clump: number;
}

export interface AppRecipe {
  id: string;
  name: string;
  sourcePdf?: string;
  sourcePage?: number;
  pattern: string;
  layoutBehavior: RecipeLayoutBehavior;
  defaultDensity: number;
  allowedOverlap: number;
  attractionStrength: number;
  clumpStrength: number;
  designIntent: string;
  plants: AppRecipePlant[];
}

/**
 * Production-facing recipe catalog.
 *
 * The app receives only the final Green Acres plant selected for each recipe.
 * Source plants, rejected candidates, substitution labels, match scores, and
 * research notes are intentionally excluded from this runtime model.
 */
export const recipeCatalog: AppRecipe[] = plantRecipes.map(recipe => {
  const design = getRecipeDesignProfile(recipe.id);

  return {
    id: recipe.id,
    name: recipe.name,
    sourcePdf: recipe.sourcePdf,
    sourcePage: recipe.sourcePage,
    pattern: design?.pattern ?? 'natural-border',
    layoutBehavior: design?.layoutBehavior ?? 'natural',
    defaultDensity: design?.defaultDensity ?? 50,
    allowedOverlap: design?.allowedOverlap ?? 0.08,
    attractionStrength: design?.attractionStrength ?? 1,
    clumpStrength: design?.clumpStrength ?? 1,
    designIntent: design?.designIntent ?? 'Use the plant layers and mature sizes to create a balanced planting layout.',
    plants: recipe.plants.map(item => ({
      plantId: Number(item.greenAcresPlantId),
      name: item.greenAcresName,
      weight: item.coveragePercent,
      layer: item.layer,
      widthInches: item.matureWidthInches || 24,
      clump: 0.65,
    })),
  };
});
