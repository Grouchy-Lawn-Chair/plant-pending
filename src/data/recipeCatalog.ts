import type { RecipePhysicsLayer } from '../engine/recipePhysicsEngine';

export interface AppRecipePlant {
  plantId: number;
  name: string;
  weight: number;
  layer: RecipePhysicsLayer;
  widthInches: number;
  clump?: number;
}

export interface AppRecipe {
  id: string;
  name: string;
  plants: AppRecipePlant[];
}

const p = (plantId: number, name: string, weight: number, layer: RecipePhysicsLayer, widthInches: number, clump?: number): AppRecipePlant => ({
  plantId, name, weight, layer, widthInches, clump,
});

export const recipeCatalog: AppRecipe[] = [
  { id: 'gardenia-provencal-courtyard', name: 'A Contemporary Provencal Courtyard', plants: [p(811, 'Deer Grass', 55, 'back', 48, 1.1), p(860, 'Fruity Germander', 45, 'front', 24, 0.9)] },
  { id: 'gardenia-soft-autumn-colors', name: 'Soft Autumn Colors', plants: [p(506, "Sedum 'Autumn Fire'", 35, 'front', 18, 0.8), p(781, "Coast Rosemary 'Blue Gem'", 35, 'back', 36, 1.1), p(343, 'Silver Carpet', 30, 'front', 24, 0.75)] },
  { id: 'gardenia-brilliant-summer-border', name: 'Brilliant Summer Border', plants: [p(729, "Bottlebrush 'Little John'", 30, 'back', 36, 1.2), p(285, 'Bright Lights™ Horizon™ Sunset African Daisy', 45, 'middle', 24, 0.85), p(792, "Cordyline 'Electric Pink'", 25, 'accent', 60, 1.6)] },
  { id: 'gardenia-successful-marriage', name: 'A Successful Marriage', plants: [p(399, 'Northern Lights Tufted Hair Grass', 45, 'middle', 12, 1), p(860, 'Fruity Germander', 30, 'front', 24, 0.9), p(277, 'Blue Fescue', 25, 'front', 10, 0.8)] },
  { id: 'gardenia-mediterranean-border', name: 'A Pretty Mediterranean Border Idea', plants: [p(860, 'Fruity Germander', 16, 'front', 24), p(937, "Lily of the Nile 'Storm Cloud'", 14, 'back', 60), p(277, 'Blue Fescue', 14, 'front', 10), p(285, 'Bright Lights™ Horizon™ Sunset African Daisy', 14, 'front', 24), p(729, "Bottlebrush 'Little John'", 14, 'accent', 36), p(781, "Coast Rosemary 'Blue Gem'", 14, 'back', 36), p(312, "Coreopsis 'Nana'", 14, 'middle', 24)] },
  { id: 'gardenia-backyard-retreat', name: 'Backyard Retreat with Achillea, Festuca and Grasses', plants: [p(574, "Yarrow 'Little Moonshine'", 35, 'middle', 24, 0.9), p(277, 'Blue Fescue', 30, 'front', 10, 0.8), p(399, 'Northern Lights Tufted Hair Grass', 35, 'back', 12, 1.1)] },
  { id: 'gardenia-desert-pollinator', name: 'Native Desert Pollinator Garden', plants: [p(444, "Lomandra 'Lime Tuff'", 20, 'accent', 30, 1.5), p(729, "Bottlebrush 'Little John'", 25, 'back', 36), p(399, 'Northern Lights Tufted Hair Grass', 30, 'middle', 12), p(312, "Coreopsis 'Nana'", 25, 'front', 24)] },
  { id: 'gardenia-butterfly-friendly', name: 'Butterfly-Friendly Garden Design', plants: [p(312, "Coreopsis 'Nana'", 25, 'front', 24), p(781, "Coast Rosemary 'Blue Gem'", 20, 'back', 36), p(370, "Feather Reed Grass 'Karl Foerster'", 15, 'back', 36), p(506, "Sedum 'Autumn Fire'", 20, 'middle', 18), p(277, 'Blue Fescue', 20, 'front', 10)] },
  { id: 'gardenia-grasses-sage', name: 'A Fabulous Planting Idea with Grasses and Sage', plants: [p(399, 'Northern Lights Tufted Hair Grass', 60, 'middle', 12, 0.75), p(781, "Coast Rosemary 'Blue Gem'", 40, 'back', 36, 1.1)] },
  { id: 'gardenia-salvia-caradonna', name: "Salvia 'Caradonna' Plant Profile", plants: [p(781, "Coast Rosemary 'Blue Gem'", 100, 'middle', 36, 0.9)] },
  { id: 'gardenia-summer-fall-border', name: 'Summer-to-Fall Perennial Border', plants: [p(729, "Bottlebrush 'Little John'", 20, 'accent', 36), p(781, "Coast Rosemary 'Blue Gem'", 20, 'back', 36), p(285, 'Bright Lights™ Horizon™ Sunset African Daisy', 20, 'middle', 24), p(277, 'Blue Fescue', 20, 'front', 10), p(374, 'Firehouse™ Verbena', 20, 'front', 22)] },
  { id: 'elegant-privacy-hedge-border', name: 'Elegant Privacy Hedge Border', plants: [p(277, 'Blue Fescue', 30, 'front', 10, 0.65), p(781, "Coast Rosemary 'Blue Gem'", 30, 'middle', 36, 0.72), p(729, "Bottlebrush 'Little John'", 25, 'accent', 36, 1.45), p(444, "Lomandra 'Lime Tuff'", 15, 'back', 30, 0.9)] },
  { id: 'modern-meadow', name: 'Modern Meadow', plants: [p(811, 'Deer Grass', 14, 'back', 48, 1.1), p(574, "Yarrow 'Little Moonshine'", 14, 'middle', 24, 0.9), p(860, 'Fruity Germander', 26, 'front', 24, 0.8), p(399, 'Northern Lights Tufted Hair Grass', 14, 'middle', 12, 0.95), p(343, 'Silver Carpet', 10, 'front', 24, 0.75), p(312, "Coreopsis 'Nana'", 11, 'middle', 24, 0.8), p(506, "Sedum 'Autumn Fire'", 11, 'middle', 18, 0.8)] },
  { id: 'hummingbird-oasis', name: 'Hummingbird Oasis', plants: [p(781, "Coast Rosemary 'Blue Gem'", 22, 'back', 36, 1.2), p(312, "Coreopsis 'Nana'", 32, 'middle', 24, 0.9), p(860, 'Fruity Germander', 28, 'middle', 24, 0.85), p(374, 'Firehouse™ Verbena', 18, 'front', 22, 0.75)] },
  { id: 'fire-pit', name: 'Fire Pit', plants: [p(781, "Coast Rosemary 'Blue Gem'", 22, 'accent', 36, 1.5), p(312, "Coreopsis 'Nana'", 28, 'middle', 24, 0.8), p(729, "Bottlebrush 'Little John'", 14, 'back', 36, 1.1), p(506, "Sedum 'Autumn Fire'", 12, 'front', 18, 0.75), p(860, 'Fruity Germander', 14, 'middle', 24, 0.85), p(343, 'Silver Carpet', 10, 'front', 24, 0.75)] },
  { id: 'fenceline-flow', name: 'Fenceline Flow', plants: [p(444, "Lomandra 'Lime Tuff'", 28, 'middle', 30, 0.8), p(792, "Cordyline 'Electric Pink'", 20, 'accent', 60, 1.8), p(399, 'Northern Lights Tufted Hair Grass', 27, 'front', 12, 0.7), p(343, 'Silver Carpet', 25, 'front', 24, 0.75)] },
  { id: 'delightful-drought-tolerant', name: 'Delightful and Drought-Tolerant', plants: [p(781, "Coast Rosemary 'Blue Gem'", 18, 'back', 36, 1.4), p(399, 'Northern Lights Tufted Hair Grass', 30, 'middle', 12, 0.9), p(312, "Coreopsis 'Nana'", 24, 'middle', 24, 0.8), p(860, 'Fruity Germander', 28, 'front', 24, 0.8)] },
];
