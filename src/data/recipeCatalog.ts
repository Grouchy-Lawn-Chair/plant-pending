import type { RecipeLayoutBehavior, RecipePhysicsLayer } from '../engine/recipePhysicsEngine';
import { plantRecipes } from './plantRecipes';
import { getRecipeDesignProfile } from './recipeDesignProfiles';

export interface AppRecipePlant { plantId:number; name:string; weight:number; layer:RecipePhysicsLayer; widthInches:number; clump:number; }
export interface AppRecipe { id:string; name:string; sourcePdf?:string; sourcePage?:number; pattern:string; layoutBehavior:RecipeLayoutBehavior; defaultDensity:number; allowedOverlap:number; attractionStrength:number; clumpStrength:number; designIntent:string; plants:AppRecipePlant[]; }

/** Runtime catalog exposes only final plants and generation settings. */
export const recipeCatalog:AppRecipe[]=plantRecipes.map(recipe=>{
  const design=getRecipeDesignProfile(recipe.id);
  return {
    id:recipe.id,
    name:recipe.name,
    sourcePdf:recipe.sourcePdf,
    sourcePage:recipe.sourcePage,
    pattern:design?.pattern??recipe.pattern??'natural-border',
    layoutBehavior:design?.layoutBehavior??'natural',
    defaultDensity:design?.defaultDensity??50,
    allowedOverlap:design?.allowedOverlap??0.08,
    attractionStrength:design?.attractionStrength??1,
    clumpStrength:design?.clumpStrength??1,
    designIntent:design?.designIntent??'Use plant layers and mature sizes to create a balanced planting layout.',
    plants:recipe.plants.map(item=>({plantId:Number(item.greenAcresPlantId),name:item.greenAcresName,weight:item.coveragePercent,layer:item.layer,widthInches:item.matureWidthInches,clump:item.clump})),
  };
});
