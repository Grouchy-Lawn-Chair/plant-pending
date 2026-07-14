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

const p = (
  plantId: number,
  name: string,
  weight: number,
  layer: RecipePhysicsLayer,
  widthInches: number,
  clump?: number,
): AppRecipePlant => ({ plantId, name, weight, layer, widthInches, clump });

const gardeniaRecipes: AppRecipe[] = [
  { id: 'gardenia-provencal-courtyard', name: 'A Contemporary Provencal Courtyard', plants: [p(811, 'Deer Grass', 55, 'back', 48, 1.1), p(860, 'Fruity Germander', 45, 'front', 24, 0.9)] },
  { id: 'gardenia-soft-autumn-colors', name: 'Soft Autumn Colors', plants: [p(506, "Sedum 'Autumn Fire'", 35, 'front', 18, 0.8), p(781, "Coast Rosemary 'Blue Gem'", 35, 'back', 36, 1.1), p(343, 'Silver Carpet', 30, 'front', 24, 0.75)] },
  { id: 'gardenia-brilliant-summer-border', name: 'Brilliant Summer Border', plants: [p(729, "Bottlebrush 'Little John'", 30, 'back', 36, 1.2), p(285, 'Bright Lights™ Horizon™ Sunset African Daisy', 45, 'middle', 24, 0.85), p(792, "Cordyline 'Electric Pink'", 25, 'accent', 60, 1.6)] },
  { id: 'gardenia-successful-marriage', name: 'A Successful Marriage', plants: [p(399, 'Northern Lights Tufted Hair Grass', 45, 'middle', 12, 1), p(860, 'Fruity Germander', 30, 'front', 24, 0.9), p(277, 'Blue Fescue', 25, 'front', 10, 0.8)] },
  { id: 'gardenia-mediterranean-border', name: 'A Pretty Mediterranean Border Idea', plants: [p(860, 'Fruity Germander', 16, 'front', 24), p(937, "Lily of the Nile 'Storm Cloud'", 14, 'back', 60), p(277, 'Blue Fescue', 14, 'front', 10), p(285, 'Bright Lights™ Horizon™ Sunset African Daisy', 14, 'front', 24), p(729, "Bottlebrush 'Little John'", 14, 'accent', 36), p(781, "Coast Rosemary 'Blue Gem'", 14, 'back', 36), p(312, "Coreopsis 'Nana'", 14, 'middle', 24)] },
  { id: 'gardenia-backyard-retreat', name: 'Backyard Retreat with Achillea, Festuca and Grasses', plants: [p(574, "Yarrow 'Little Moonshine'", 35, 'middle', 24, 0.9), p(277, 'Blue Fescue', 30, 'front', 10, 0.8), p(399, 'Northern Lights Tufted Hair Grass', 35, 'back', 12, 1.1)] },
  { id: 'gardenia-desert-pollinator', name: 'Native Desert Pollinator Garden', plants: [p(444, "Lomandra 'Lime Tuff'", 20, 'accent', 30, 1.5), p(729, "Bottlebrush 'Little John'", 25, 'back', 36), p(399, 'Northern Lights Tufted Hair Grass', 30, 'middle', 12), p(312, "Coreopsis 'Nana'", 25, 'front', 24)] },
  { id: 'gardenia-butterfly-friendly', name: 'Butterfly-Friendly Garden Design', plants: [p(312, "Coreopsis 'Nana'", 25, 'front', 24), p(781, "Coast Rosemary 'Blue Gem'", 20, 'back', 36), p(370, "Feather Reed Grass 'Karl Foerster'", 15, 'back', 36), p(506, "Sedum 'Autumn Fire'", 20, 'middle', 18), p(277, 'Blue Fescue', 20, 'front', 10)] },
  { id: 'gardenia-grasses-sage', name: 'A Fabulous Planting Idea with Grasses and Sage', plants: [p(399, 'Northern Lights Tufted Hair Grass', 60, 'middle', 12, 0.75), p(781, "Coast Rosemary 'Blue Gem'", 40, 'back', 36, 1.1)] },
  { id: 'gardenia-summer-fall-border', name: 'Summer-to-Fall Perennial Border', plants: [p(729, "Bottlebrush 'Little John'", 20, 'accent', 36), p(781, "Coast Rosemary 'Blue Gem'", 20, 'back', 36), p(285, 'Bright Lights™ Horizon™ Sunset African Daisy', 20, 'middle', 24), p(277, 'Blue Fescue', 20, 'front', 10), p(374, 'Firehouse™ Verbena', 20, 'front', 22)] },
];

const reviewedMonroviaRecipes: AppRecipe[] = plantRecipes.map(recipe => ({
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

export const recipeCatalog: AppRecipe[] = [
  ...reviewedMonroviaRecipes,
  ...gardeniaRecipes,
];
