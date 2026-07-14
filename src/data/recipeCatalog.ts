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
  { id: 'gardenia-provencal-courtyard', name: 'A Contemporary Provencal Courtyard', plants: [p(811, 'Deer Grass', 55, 'back', 48, 1.1), p(860, 'Fruity Germander', 45, 'front', 30, 0.9)] },
  { id: 'gardenia-soft-autumn-colors', name: 'Soft Autumn Colors', plants: [p(506, "Sedum 'Autumn Fire'", 35, 'front', 24, 0.8), p(781, "Coast Rosemary 'Blue Gem'", 35, 'back', 48, 1.1), p(343, 'Silver Carpet', 30, 'front', 24, 0.75)] },
  { id: 'gardenia-brilliant-summer-border', name: 'Brilliant Summer Border', plants: [p(729, "Bottlebrush 'Little John'", 30, 'back', 36, 1.2), p(285, 'Bright Lights Horizon Sunset African Daisy', 45, 'middle', 24, 0.85), p(792, "Cordyline 'Electric Pink'", 25, 'accent', 36, 1.6)] },
  { id: 'gardenia-successful-marriage', name: 'A Successful Marriage', plants: [p(399, 'Northern Lights Tufted Hair Grass', 45, 'middle', 24, 1), p(860, 'Fruity Germander', 30, 'front', 30, 0.9), p(277, 'Blue Fescue', 25, 'front', 18, 0.8)] },
  { id: 'gardenia-mediterranean-border', name: 'A Pretty Mediterranean Border Idea', plants: [p(860, 'Fruity Germander', 16, 'front', 30), p(937, "Lily of the Nile 'Storm Cloud'", 14, 'back', 36), p(277, 'Blue Fescue', 14, 'front', 18), p(285, 'Bright Lights Horizon Sunset African Daisy', 14, 'front', 24), p(729, "Bottlebrush 'Little John'", 14, 'accent', 36), p(781, "Coast Rosemary 'Blue Gem'", 14, 'back', 48), p(312, "Coreopsis 'Nana'", 14, 'middle', 24)] },
  { id: 'gardenia-backyard-retreat', name: 'Backyard Retreat with Achillea, Festuca and Grasses', plants: [p(574, "Yarrow 'Little Moonshine'", 35, 'middle', 24, 0.9), p(277, 'Blue Fescue', 30, 'front', 18, 0.8), p(399, 'Northern Lights Tufted Hair Grass', 35, 'back', 24, 1.1)] },
  { id: 'gardenia-desert-pollinator', name: 'Native Desert Pollinator Garden', plants: [p(444, "Lomandra 'Lime Tuff'", 20, 'accent', 36, 1.5), p(729, "Bottlebrush 'Little John'", 25, 'back', 36), p(399, 'Northern Lights Tufted Hair Grass', 30, 'middle', 24), p(312, "Coreopsis 'Nana'", 25, 'front', 24)] },
  { id: 'gardenia-butterfly-friendly', name: 'Butterfly-Friendly Garden Design', plants: [p(312, "Coreopsis 'Nana'", 25, 'front', 24), p(781, "Coast Rosemary 'Blue Gem'", 20, 'back', 48), p(370, "Feather Reed Grass 'Karl Foerster'", 15, 'back', 30), p(506, "Sedum 'Autumn Fire'", 20, 'middle', 24), p(277, 'Blue Fescue', 20, 'front', 18)] },
  { id: 'gardenia-grasses-sage', name: 'A Fabulous Planting Idea with Grasses and Sage', plants: [p(399, 'Northern Lights Tufted Hair Grass', 60, 'middle', 24, 0.75), p(781, "Coast Rosemary 'Blue Gem'", 40, 'back', 48, 1.1)] },
  { id: 'gardenia-salvia-caradonna', name: "Salvia 'Caradonna' Plant Profile", plants: [p(781, "Coast Rosemary 'Blue Gem'", 100, 'middle', 48, 0.9)] },
  { id: 'gardenia-summer-fall-border', name: 'Summer-to-Fall Perennial Border', plants: [p(729, "Bottlebrush 'Little John'", 20, 'accent', 36), p(781, "Coast Rosemary 'Blue Gem'", 20, 'back', 48), p(285, 'Bright Lights Horizon Sunset African Daisy', 20, 'middle', 24), p(277, 'Blue Fescue', 20, 'front', 18), p(374, 'Firehouse Verbena', 20, 'front', 30)] },
  { id: 'elegant-privacy-hedge-border', name: 'Elegant Privacy Hedge Border', plants: [p(475, 'Rose Sea Thrift', 30, 'front', 12, 0.65), p(683, "Hydrangea 'Little Lime Punch'", 30, 'middle', 48, 0.72), p(912, 'Eau de Parfum Blush Rose', 25, 'accent', 48, 1.45), p(657, "Emerald Green Arborvitae 'Smaragd'", 15, 'back', 48, 0.9)] },
  { id: 'modern-meadow', name: 'Modern Meadow', plants: [p(399, 'Northern Lights Tufted Hair Grass', 28, 'back', 24, 0.95), p(311, 'Butterfly Weed', 22, 'middle', 24, 0.9), p(781, "Coast Rosemary 'Blue Gem'", 20, 'middle', 48, 1.1), p(312, "Coreopsis 'Nana'", 30, 'front', 24, 0.8)] },
  { id: 'hummingbird-oasis', name: 'Hummingbird Oasis', plants: [p(749, "Rose of Sharon 'Blue Chiffon'", 22, 'back', 48, 1.2), p(412, 'Lantana', 17, 'middle', 36, 0.9), p(374, 'Firehouse Verbena', 31, 'front', 30, 0.75), p(781, "Coast Rosemary 'Blue Gem'", 30, 'middle', 48, 1.05)] },
  { id: 'fire-pit', name: 'Fire Pit', plants: [p(721, 'Dwarf Korean Lilac', 12, 'accent', 48, 1.5), p(312, "Coreopsis 'Nana'", 28, 'middle', 24, 0.8), p(662, "Dwarf Yaupon Holly 'Schillings'", 14, 'back', 36, 1.1), p(506, "Sedum 'Autumn Fire'", 12, 'front', 24, 0.75), p(860, 'Fruity Germander', 24, 'middle', 30, 0.85), p(277, 'Blue Fescue', 10, 'front', 18, 0.75)] },
  { id: 'fenceline-flow', name: 'Fenceline Flow', plants: [p(525, 'Hosta', 28, 'middle', 36, 0.8), p(37, 'Japanese Maple', 20, 'accent', 72, 1.8), p(384, 'Japanese Sedge', 27, 'front', 24, 0.7), p(371, 'Coral Bells', 25, 'front', 21, 0.75)] },
  { id: 'delightful-drought-tolerant', name: 'Delightful and Drought-Tolerant', plants: [p(94, 'Chaste Tree', 18, 'back', 60, 1.4), p(399, 'Northern Lights Tufted Hair Grass', 30, 'middle', 24, 0.9), p(312, "Coreopsis 'Nana'", 24, 'middle', 24, 0.8), p(860, 'Fruity Germander', 28, 'front', 30, 0.8)] },
];
