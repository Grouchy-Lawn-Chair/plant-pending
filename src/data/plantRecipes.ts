export type RecipeLayer='front'|'middle'|'back'|'accent';
export interface PlantRecipeItem{coveragePercent:number;layer:RecipeLayer;matureWidthInches:number;greenAcresPlantId:string;greenAcresName:string;clump:number}
export interface PlantRecipe{id:string;name:string;sourcePdf:string;sourcePage:number;pattern:string;status:'reviewed';plants:PlantRecipeItem[]}

import { springRecipes } from './springRecipes';
import { fallRecipes } from './fallRecipes';
import { weekendRecipes } from './weekendRecipes';
import { habitatRecipes } from './habitatRecipes';
import { best2025Recipes } from './best2025Recipes';
import { gardeniaRecipes } from './gardeniaRecipes';

/** Final production recipes. Contains only approved Green Acres plants. */
export const plantRecipes:PlantRecipe[]=[...springRecipes,...fallRecipes,...weekendRecipes,...habitatRecipes,...best2025Recipes,...gardeniaRecipes];
export const getPlantRecipe=(id:string)=>plantRecipes.find(recipe=>recipe.id===id);
