import type { RecipePhysicsLayer } from '../engine/recipePhysicsEngine';
import { plantRecipes } from './plantRecipes';

export interface AppRecipePlant {
  plantId: number;
  name: string;
  weight: number;
  layer: RecipePhysicsLayer;
  widthInches: number;
  clump?: number;
  sourceName?: string;
  matchStatus?: 'exact' | 'close' | 'substitute';
  matchScore?: number;
  riskNotes?: string;
  notes?: string;
}

export interface AppRecipe {
  id: string;
  name: string;
  sourcePdf?: string;
  sourcePage?: number;
  plants: AppRecipePlant[];
}

/**
 * App-facing adapter only. All recipe definitions live in plantRecipes.ts.
 * Do not add recipe data to this file.
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
    sourceName: item.sourceName,
    matchStatus: item.matchStatus,
    matchScore: item.matchScore,
    riskNotes: item.riskNotes,
    notes: item.notes,
  })),
}));
