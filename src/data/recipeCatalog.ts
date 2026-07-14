import type { RecipePhysicsLayer } from '../engine/recipePhysicsEngine';
import { plantRecipes } from './plantRecipes';

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
  plants: AppRecipePlant[];
}

/**
 * Production-facing recipe catalog.
 *
 * The app receives only the final Green Acres plant selected for each recipe.
 * Source plants, rejected candidates, substitution labels, match scores, and
 * research notes are intentionally excluded from this runtime model.
 */
export const recipeCatalog: AppRecipe[] = plantRecipes.map(recipe => ({
  id: recipe.id,
  name: recipe.name,
  sourcePdf: recipe.sourcePdf,
  sourcePage: recipe.sourcePage,
  plants: recipe.plants.map(item => ({
    plantId: Number(item.greenAcresPlantId),
    name: item.greenAcresName,
    weight: item.coveragePercent,
    layer: item.layer,
    widthInches: item.matureWidthInches || 24,
    clump: 0.65,
  })),
}));
